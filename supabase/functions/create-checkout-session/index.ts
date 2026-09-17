// VitiTrack Pro — Supabase Edge Function: create-checkout-session
// Crée une session Stripe Checkout sécurisée pour un abonnement mensuel
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import Stripe from "https://esm.sh/stripe@14.10.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Tarifs officiels VitiTrack Pro (en centimes HT)
const PLAN_CONFIG: Record<string, { name: string; amount: number; defaultPriceEnv: string }> = {
  basic: {
    name: "VitiTrack Pro — Formule Basic (jusqu'à 5 clients, 10 parcelles)",
    amount: 2900, // 29.00 € HT
    defaultPriceEnv: "STRIPE_PRICE_BASIC",
  },
  pro: {
    name: "VitiTrack Pro — Formule Professionnel (5 à 15 clients, 10 à 20 parcelles)",
    amount: 4900, // 49.00 € HT
    defaultPriceEnv: "STRIPE_PRICE_PRO",
  },
  enterprise: {
    name: "VitiTrack Pro — Formule Entreprise (Clients & Parcelles illimités)",
    amount: 9900, // 99.00 € HT
    defaultPriceEnv: "STRIPE_PRICE_ENTERPRISE",
  },
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    // 1. Authentification de l'utilisateur via le token Supabase JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé : token manquant" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Non autorisé : format Bearer manquant" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Le client Supabase valide le token directement auprès du service Auth
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("❌ [Checkout] Erreur auth getUser :", authError?.message || "Utilisateur introuvable");
      return new Response(JSON.stringify({ error: "Session invalide ou expirée" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { planId = "pro", returnUrl } = await req.json();
    const plan = PLAN_CONFIG[planId] || PLAN_CONFIG.pro;

    // 2. Client Supabase avec privilèges de service pour la gestion Stripe
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Vérifier si un stripe_customer_id existe déjà pour cet utilisateur
    const { data: subData } = await adminSupabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = subData?.stripe_customer_id;

    if (!customerId) {
      // Création du client dans Stripe
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.user_metadata?.domain_name || user.user_metadata?.full_name || user.email,
        metadata: {
          supabase_user_id: user.id,
          domain_name: user.user_metadata?.domain_name || "",
        },
      });
      customerId = customer.id;

      // Enregistrement initial dans Supabase
      await adminSupabase.from("subscriptions").upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        plan_id: planId,
        plan_name: plan.name.split("—")[1]?.trim() || planId,
        plan_price_ht: plan.amount / 100,
        status: "incomplete",
      }, { onConflict: "user_id" });
    }

    // 4. Détermination du Price ID Stripe
    let configuredPriceId = Deno.env.get(plan.defaultPriceEnv);
    if (planId === "pro") {
      configuredPriceId = Deno.env.get("STRIPE_PRICE_PRO_MONTHLY") || configuredPriceId || "price_1UGiQZIsJ4ka554qPJdI6ndP";
    }

    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
    if (configuredPriceId) {
      lineItems = [{ price: configuredPriceId, quantity: 1 }];
    } else {
      lineItems = [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: plan.name,
              description: "Abonnement mensuel SaaS VitiTrack Pro pour la gestion viticole.",
            },
            unit_amount: plan.amount,
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ];
    }

    const origin = returnUrl || req.headers.get("origin") || "https://vititrack.pro";
    const successUrl = `${origin}/dashboard.html?subscription=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/dashboard.html?subscription=cancel`;

    // 5. Création de la session Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: lineItems,
      allow_promotion_codes: true,
      billing_address_collection: "required",
      customer_update: {
        name: "auto",
        address: "auto",
      },
      tax_id_collection: { enabled: true }, // Collecte numéro TVA intracommunautaire pour facturation viticole
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan_id: planId,
        },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        supabase_user_id: user.id,
        plan_id: planId,
      },
    });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erreur create-checkout-session :", error);
    return new Response(JSON.stringify({ error: (error as Error).message || "Erreur serveur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
