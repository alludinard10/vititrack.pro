// VitiTrack Pro — Supabase Edge Function: stripe-webhook
// Traitement idempotent et sécurisé des événements Stripe (Mode Test & Production)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import Stripe from "https://esm.sh/stripe@14.10.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

// Price ID officiel fourni pour VitiTrack Pro (Mode Test)
const STRIPE_PRICE_PRO_MONTHLY = Deno.env.get("STRIPE_PRICE_PRO_MONTHLY") || "price_1UGiQZIsJ4ka554qPJdI6ndP";

serve(async (req: Request) => {
  // 1. Accepter uniquement les requêtes POST
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "stripe-signature, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée. Seul POST est accepté." }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Récupérer le header Stripe-Signature
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    console.warn("⚠️ [Stripe Webhook] Requête rejetée : header stripe-signature manquant.");
    return new Response(JSON.stringify({ error: "Signature Stripe manquante." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3. Récupérer le corps brut de la requête (RAW BODY - Ne pas parser en JSON avant)
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Impossible de lire le corps de la requête." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 4. Vérifier la signature cryptographique avec STRIPE_WEBHOOK_SECRET
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("❌ [Stripe Webhook] Signature invalide :", (err as Error).message);
    return new Response(JSON.stringify({ error: `Signature Stripe invalide : ${(err as Error).message}` }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 5. Initialiser Supabase avec le rôle de service (accès sécurisé interne)
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log(`🔔 [Stripe Webhook] Événement valide reçu : ${event.type} [ID: ${event.id}]`);

  try {
    // 6. Idempotence : Vérifier si cet événement a déjà été traité
    const { data: existingEvent } = await adminSupabase
      .from("stripe_events")
      .select("id")
      .eq("stripe_event_id", event.id)
      .maybeSingle();

    if (existingEvent) {
      console.log(`ℹ️ [Stripe Webhook] Événement ${event.id} déjà traité précédemment. Réponse 200 immédiate.`);
      return new Response(JSON.stringify({ received: true, already_processed: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Enregistrer l'événement dans stripe_events pour garantir l'idempotence
    await adminSupabase.from("stripe_events").insert({
      stripe_event_id: event.id,
      event_type: event.type,
      processed_at: new Date().toISOString(),
    });

    // 7. Traitement des événements
    switch (event.type) {
      // -------------------------------------------------------------
      // ÉVÉNEMENT 1 : checkout.session.completed
      // -------------------------------------------------------------
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        let userId = session.metadata?.supabase_user_id || session.client_reference_id;

        // Si le user_id n'est pas dans metadata, chercher par customer ou email
        if (!userId && customerId) {
          userId = await findUserIdByCustomer(adminSupabase, customerId, session.customer_details?.email);
        }

        if (subscriptionId && userId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0]?.price.id || STRIPE_PRICE_PRO_MONTHLY;
          const currentPeriodStart = new Date(subscription.current_period_start * 1000).toISOString();
          const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

          await adminSupabase.from("subscriptions").upsert({
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            stripe_price_id: priceId,
            plan_id: detectPlanId(priceId),
            plan_name: detectPlanName(priceId),
            plan_price_ht: detectPlanPrice(priceId),
            status: subscription.status, // 'active' ou 'trialing'
            current_period_start: currentPeriodStart,
            current_period_end: currentPeriodEnd,
            cancel_at_period_end: subscription.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

          console.log(`✅ [Stripe Webhook] Abonnement activé : User=${userId} Sub=${subscriptionId} Price=${priceId}`);
        }
        break;
      }

      // -------------------------------------------------------------
      // ÉVÉNEMENT 2 & 3 : customer.subscription.created / updated
      // -------------------------------------------------------------
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const priceId = subscription.items.data[0]?.price.id || STRIPE_PRICE_PRO_MONTHLY;
        const currentPeriodStart = new Date(subscription.current_period_start * 1000).toISOString();
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
        const cancelAtPeriodEnd = subscription.cancel_at_period_end;
        const status = subscription.status;

        // Trouver le user_id
        let userId = subscription.metadata?.supabase_user_id;
        if (!userId && customerId) {
          userId = await findUserIdByCustomer(adminSupabase, customerId);
        }

        if (userId) {
          await adminSupabase.from("subscriptions").upsert({
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription.id,
            stripe_price_id: priceId,
            plan_id: detectPlanId(priceId),
            plan_name: detectPlanName(priceId),
            plan_price_ht: detectPlanPrice(priceId),
            status: status,
            current_period_start: currentPeriodStart,
            current_period_end: currentPeriodEnd,
            cancel_at_period_end: cancelAtPeriodEnd,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

          console.log(`✅ [Stripe Webhook] Abonnement synchronisé : User=${userId} Statut=${status}`);
        } else {
          // Si on a déjà la ligne avec le stripe_subscription_id
          await adminSupabase
            .from("subscriptions")
            .update({
              stripe_price_id: priceId,
              status: status,
              current_period_start: currentPeriodStart,
              current_period_end: currentPeriodEnd,
              cancel_at_period_end: cancelAtPeriodEnd,
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", subscription.id);
        }
        break;
      }

      // -------------------------------------------------------------
      // ÉVÉNEMENT 4 : customer.subscription.deleted
      // -------------------------------------------------------------
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

        console.log(`⚠️ [Stripe Webhook] Abonnement clôturé : Sub=${subscription.id}`);
        break;
      }

      // -------------------------------------------------------------
      // ÉVÉNEMENT 5 : invoice.paid
      // -------------------------------------------------------------
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        const customerId = invoice.customer as string;

        let userId = await findUserIdByCustomer(adminSupabase, customerId);

        // Si l'abonnement a une nouvelle période de fin
        if (subscriptionId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            const periodEnd = new Date(sub.current_period_end * 1000).toISOString();
            await adminSupabase
              .from("subscriptions")
              .update({
                status: sub.status,
                current_period_end: periodEnd,
                updated_at: new Date().toISOString(),
              })
              .eq("stripe_subscription_id", subscriptionId);
          } catch (e) {
            console.warn("Notice récupération subscription post-invoice :", e);
          }
        }

        // Historique de facture
        if (userId) {
          await adminSupabase.from("payment_invoices").upsert({
            user_id: userId,
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
        console.log(`💶 [Stripe Webhook] Facture acquittée : Invoice=${invoice.id} Montant=${invoice.total / 100}€`);
        break;
      }

      // -------------------------------------------------------------
      // ÉVÉNEMENT 6 : invoice.payment_failed
      // -------------------------------------------------------------
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

        console.warn(`🚨 [Stripe Webhook] Échec de paiement facture pour le client Stripe=${customerId}`);
        break;
      }

      default:
        console.log(`ℹ️ [Stripe Webhook] Événement ignoré : ${event.type}`);
    }

    // 8. Réponse HTTP 200 OK à Stripe pour confirmer la réception
    return new Response(JSON.stringify({ received: true, event_id: event.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ [Stripe Webhook] Erreur interne de traitement :", err);
    return new Response(JSON.stringify({ error: (err as Error).message || "Erreur serveur" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

// Helper : Trouver le user_id Supabase via customerId ou email
async function findUserIdByCustomer(adminSupabase: any, customerId: string, fallbackEmail?: string | null): Promise<string | null> {
  const { data: sub } = await adminSupabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (sub?.user_id) return sub.user_id;

  // Fallback : recherche via le customer Stripe
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted && customer.metadata?.supabase_user_id) {
      return customer.metadata.supabase_user_id;
    }
  } catch (e) {}

  return null;
}

// Helpers : Détection du plan à partir du Price ID
function detectPlanId(priceId: string): string {
  if (priceId === STRIPE_PRICE_PRO_MONTHLY) return "pro";
  if (priceId.includes("basic")) return "basic";
  if (priceId.includes("enterprise")) return "enterprise";
  return "pro";
}

function detectPlanName(priceId: string): string {
  const plan = detectPlanId(priceId);
  if (plan === "basic") return "Basic";
  if (plan === "enterprise") return "Entreprise";
  return "Professionnel";
}

function detectPlanPrice(priceId: string): number {
  const plan = detectPlanId(priceId);
  if (plan === "basic") return 29.00;
  if (plan === "enterprise") return 99.00;
  return 49.00;
}
