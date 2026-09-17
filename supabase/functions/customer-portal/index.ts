// VitiTrack Pro — Supabase Edge Function: customer-portal
// Génère un lien sécurisé vers le Portail Client Stripe (gestion CB, factures, résiliation)
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    // 1. Authentification de l'utilisateur
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé : token manquant" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Non autorisé : token vide" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Session expirée", details: authError?.message }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Récupérer le stripe_customer_id
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: subData } = await adminSupabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!subData?.stripe_customer_id) {
      return new Response(JSON.stringify({ error: "Aucun compte client Stripe associé à cet utilisateur." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const origin = req.headers.get("origin") || "https://vititrack.pro";
    const returnUrl = `${origin}/dashboard.html`;

    // 3. Création de la session du Portail Client
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subData.stripe_customer_id,
      return_url: returnUrl,
    });

    return new Response(JSON.stringify({ url: portalSession.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erreur customer-portal :", error);
    return new Response(JSON.stringify({ error: (error as Error).message || "Erreur serveur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
