/**
 * VitiTrack Pro — Intégration Sécurisée Stripe & Abonnements (Frontend)
 * Communique avec les Supabase Edge Functions sans jamais exposer de clé secrète.
 */

(function () {
  const SUPABASE_FUNCTIONS_URL = `${window.SUPABASE_URL || "https://zygxjkckwaskukhnltck.supabase.co"}/functions/v1`;

  /**
   * Lance le processus d'abonnement Stripe Checkout pour une formule donnée.
   * @param {'basic' | 'pro' | 'enterprise'} planId
   */
  async function startStripeCheckout(planId = "pro") {
    // 1. Vérifier si un utilisateur est connecté
    let session = null;
    if (window.supabaseClient) {
      const { data } = await window.supabaseClient.auth.getSession();
      session = data?.session;
    }

    if (!session || !session.access_token) {
      // Si pas connecté, sauvegarder le plan souhaité et rediriger vers login
      try {
        localStorage.setItem("vititrack_pending_plan", planId);
      } catch (e) {}
      window.location.href = `login.html?redirect=checkout&plan=${encodeURIComponent(planId)}`;
      return;
    }

    try {
      if (typeof showToast === "function") {
        showToast("Préparation de votre abonnement Stripe sécurisé...", "info");
      }

      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/create-checkout-session`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId: planId,
          returnUrl: window.location.origin + window.location.pathname.replace(/\/[^/]*$/, ""),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Impossible de créer la session de paiement.");
      }

      // Redirection sécurisée vers la page hébergée Stripe Checkout
      window.location.href = data.url;
    } catch (err) {
      console.error("❌ [VitiTrack Stripe] Erreur Checkout :", err);
      if (typeof showToast === "function") {
        showToast(err.message || "Erreur de connexion avec Stripe.", "error");
      } else {
        alert("Erreur Stripe : " + err.message);
      }
    }
  }

  /**
   * Ouvre le portail client Stripe (gestion CB, factures, résiliation).
   */
  async function openCustomerPortal() {
    let session = null;
    if (window.supabaseClient) {
      const { data } = await window.supabaseClient.auth.getSession();
      session = data?.session;
    }

    if (!session || !session.access_token) {
      window.location.href = "login.html";
      return;
    }

    try {
      if (typeof showToast === "function") {
        showToast("Ouverture de votre portail de facturation Stripe...", "info");
      }

      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/customer-portal`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Portail client non disponible pour ce compte.");
      }

      window.location.href = data.url;
    } catch (err) {
      console.error("❌ [VitiTrack Stripe] Erreur Portail :", err);
      if (typeof showToast === "function") {
        showToast(err.message || "Impossible d'ouvrir le portail de facturation.", "error");
      } else {
        alert(err.message);
      }
    }
  }

  /**
   * Récupère l'état de l'abonnement de l'utilisateur actif.
   */
  async function fetchUserSubscription() {
    try {
      if (!window.supabaseClient) return null;
      const { data: { user } } = await window.supabaseClient.auth.getUser();
      if (!user) return null;

      const { data, error } = await window.supabaseClient
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!error && data) {
        try {
          localStorage.setItem("vititrack_subscription", JSON.stringify(data));
        } catch (e) {}
        return data;
      }
    } catch (e) {
      console.warn("⚠️ [VitiTrack Stripe] Lecture abonnement Supabase :", e);
    }

    // Fallback local
    try {
      const local = localStorage.getItem("vititrack_subscription");
      if (local) return JSON.parse(local);
    } catch (e) {}

    return null;
  }

  /**
   * Traite les paramètres d'URL de retour de Stripe (?subscription=success / ?subscription=cancel)
   */
  function handleCheckoutReturn() {
    const params = new URLSearchParams(window.location.search);
    const subStatus = params.get("subscription");

    if (subStatus === "success") {
      setTimeout(() => {
        if (typeof showToast === "function") {
          showToast("🎉 Félicitations ! Votre abonnement VitiTrack Pro est maintenant actif.", "success");
        }
      }, 600);
      // Nettoyer l'URL
      cleanUrlParams(["subscription", "session_id"]);
      // Rafraîchir l'abonnement
      fetchUserSubscription().then(sub => {
        if (typeof updateSubscriptionUI === "function") updateSubscriptionUI(sub);
      });
    } else if (subStatus === "cancel") {
      setTimeout(() => {
        if (typeof showToast === "function") {
          showToast("ℹ️ La souscription a été interrompue. Vous pouvez reprendre à tout moment.", "info");
        }
      }, 600);
      cleanUrlParams(["subscription"]);
    }
  }

  function cleanUrlParams(keysToRemove = []) {
    const url = new URL(window.location.href);
    keysToRemove.forEach(k => url.searchParams.delete(k));
    window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ""));
  }

  // Exposition globale
  window.VitiTrackStripe = {
    startCheckout: startStripeCheckout,
    openPortal: openCustomerPortal,
    getSubscription: fetchUserSubscription,
    handleReturn: handleCheckoutReturn,
  };

  // Auto-détection au chargement
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", handleCheckoutReturn);
  } else {
    handleCheckoutReturn();
  }
})();
