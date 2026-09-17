// VitiTrack Pro — Supabase Edge Function: stripe-webhook
// Reçoit et traite les événements Stripe en temps réel pour synchroniser les abonnements
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import Stripe from "https://esm.sh/stripe@14.10.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Méthode non autorisée", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Signature Stripe manquante", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const body = await req.text();
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("❌ Erreur validation signature webhook Stripe :", (err as Error).message);
    return new Response(`Erreur de webhook : ${(err as Error).message}`, { status: 400 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log(`🔔 [Stripe Webhook] Événement reçu : ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      // 1. Session Checkout terminée avec succès -> Activation de l'abonnement
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const userId = session.metadata?.supabase_user_id;
        const planId = session.metadata?.plan_id || "pro";

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const currentPeriodStart = new Date(subscription.current_period_start * 1000).toISOString();
          const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

          await adminSupabase.from("subscriptions").upsert({
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            plan_id: planId,
            status: subscription.status, // 'active' ou 'trialing'
            current_period_start: currentPeriodStart,
            current_period_end: currentPeriodEnd,
            cancel_at_period_end: subscription.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

          console.log(`✅ [Stripe] Abonnement ${subscriptionId} activé pour l'utilisateur ${userId}`);
        }
        break;
      }

      // 2. Mise à jour de l'abonnement (changement de formule, résiliation programmée...)
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const status = subscription.status;
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
        const cancelAtPeriodEnd = subscription.cancel_at_period_end;

        await adminSupabase
          .from("subscriptions")
          .update({
            status: status,
            current_period_end: currentPeriodEnd,
            cancel_at_period_end: cancelAtPeriodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        console.log(`ℹ️ [Stripe] Abonnement ${subscription.id} mis à jour : statut=${status}`);
        break;
      }

      // 3. Résiliation immédiate de l'abonnement
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await adminSupabase
          .from("subscriptions")
          .update({
            status: "canceled",
            canceled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        console.log(`⚠️ [Stripe] Abonnement ${subscription.id} résilié.`);
        break;
      }

      // 4. Paiement de facture réussi (renouvellement mensuel)
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        const customerId = invoice.customer as string;

        // Enregistrer la facture dans payment_invoices si lié à un utilisateur
        const { data: subData } = await adminSupabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (subData?.user_id) {
          await adminSupabase.from("payment_invoices").upsert({
            user_id: subData.user_id,
            stripe_invoice_id: invoice.id,
            stripe_customer_id: customerId,
            amount_paid_ht: (invoice.subtotal || 0) / 100,
            amount_paid_ttc: (invoice.total || 0) / 100,
            currency: invoice.currency,
            status: "paid",
            invoice_pdf_url: invoice.invoice_pdf,
            hosted_invoice_url: invoice.hosted_invoice_url,
            period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
            period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
          }, { onConflict: "stripe_invoice_id" });
        }
        break;
      }

      // 5. Échec de paiement de facture
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        await adminSupabase
          .from("subscriptions")
          .update({
            status: "past_due",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", customerId);

        console.warn(`🚨 [Stripe] Échec de paiement facture pour le client ${customerId}`);
        break;
      }

      default:
        console.log(`ℹ️ [Stripe Webhook] Événement ignoré : ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ Erreur traitement webhook Stripe :", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
