/**
 * VitiTrack Pro — Supabase Configuration & Client Initialization
 * Permet la connexion temps réel avec le backend Supabase en mode zéro-build (CDN).
 */

const SUPABASE_URL = "https://zygxjkckwaskukhnltck.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5Z3hqa2Nrd2Fza3VraG5sdGNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NTk5MzcsImV4cCI6MjEwNTEzNTkzN30.myxRc_bkrD3oewB4rv6T1jsIfCcp8JFbbn9Hr_Qk-eA";

let supabaseClient = null;
let isSupabaseOnline = false;

// Initialisation du client Supabase
(function initSupabase() {
  try {
    if (window.supabase && typeof window.supabase.createClient === "function") {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      });
      window.supabaseClient = supabaseClient;
      console.log("🍇 [VitiTrack Pro] Supabase SDK initialisé avec succès.");
    } else {
      console.warn("⚠️ [VitiTrack Pro] SDK Supabase non détecté sur window.supabase. Le mode hors-ligne sera utilisé.");
    }
  } catch (err) {
    console.error("❌ [VitiTrack Pro] Erreur lors de l'initialisation Supabase :", err);
  }
})();

// Vérification de la disponibilité du backend Supabase
async function testSupabaseConnection() {
  if (!window.supabaseClient) {
    updateSupabaseBadge(false, "SDK non chargé");
    return false;
  }
  try {
    // Ping rapide sur la table clients
    const { error } = await window.supabaseClient.from("clients").select("id").limit(1);
    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist") || error.code === "PGRST204" || error.code === "PGRST205") {
        // Table n'existe pas encore
        updateSupabaseBadge(false, "Tables à initialiser");
        console.warn("ℹ️ [VitiTrack Pro] Les tables Supabase doivent être créées dans l'éditeur SQL Supabase.");
        return false;
      }
      console.warn("⚠️ [VitiTrack Pro] Connexion Supabase en attente :", error.message);
      updateSupabaseBadge(false, "Hors ligne / RLS");
      return false;
    }
    isSupabaseOnline = true;
    window.isSupabaseOnline = true;
    updateSupabaseBadge(true, "Cloud Supabase connecté");
    return true;
  } catch (e) {
    console.warn("⚠️ [VitiTrack Pro] Impossible de joindre Supabase :", e);
    isSupabaseOnline = false;
    window.isSupabaseOnline = false;
    updateSupabaseBadge(false, "Mode Local (Hors-ligne)");
    return false;
  }
}

// Mise à jour de l'indicateur visuel dans l'interface
function updateSupabaseBadge(online, label) {
  const badgeEl = document.getElementById("sync-status-badge");
  const textEl = document.getElementById("sync-status-text");
  if (badgeEl && textEl) {
    badgeEl.className = `status-indicator ${online ? "online" : "warning"}`;
    textEl.textContent = label;
  }
}

window.isSupabaseOnline = isSupabaseOnline;
window.testSupabaseConnection = testSupabaseConnection;
window.updateSupabaseBadge = updateSupabaseBadge;

const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5Z3hqa2Nrd2Fza3VraG5sdGNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTU1OTkzNywiZXhwIjoyMTA1MTM1OTM3fQ.0o5Qy4eM9aUMYRGxRbtz_dqHVayRe7LBqdLaiF9S5m8";

// Création ou mise à jour directe d'un compte utilisateur sans envoi d'email (zéro blocage de quota)
async function upsertConfirmedUser(email, password, metadata = {}) {
  const serviceKey = SUPABASE_SERVICE_ROLE_KEY;
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: cleanEmail,
        password: password,
        email_confirm: true,
        user_metadata: metadata
      })
    });

    const resJson = await response.json();
    if (response.ok) {
      return { user: resJson, created: true };
    }

    // Si déjà enregistré (HTTP 422), on met à jour son mot de passe et ses métadonnées
    if (response.status === 422 || (resJson.message && resJson.message.toLowerCase().includes("already"))) {
      const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=100`, {
        headers: {
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`
        }
      });
      const listData = await listRes.json();
      const existing = (listData.users || []).find(u => (u.email || "").toLowerCase() === cleanEmail);
      if (existing) {
        const updateBody = {
          user_metadata: { ...existing.user_metadata, ...metadata }
        };
        if (password) {
          updateBody.password = password;
        }
        const updateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existing.id}`, {
          method: "PUT",
          headers: {
            "apikey": serviceKey,
            "Authorization": `Bearer ${serviceKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(updateBody)
        });
        const updateData = await updateRes.json();
        return { user: updateData, updated: true };
      }
    }

    const errMsg = resJson.msg || resJson.message || "Erreur lors de la configuration du compte Supabase.";
    throw new Error(errMsg);
  } catch (err) {
    console.error("❌ [VitiTrack Pro] Erreur upsertConfirmedUser :", err);
    throw err;
  }
}

async function createConfirmedUser(email, password, metadata = {}) {
  const res = await upsertConfirmedUser(email, password, metadata);
  return res ? res.user : null;
}

// Récupération des membres d'équipe enregistrés sur Supabase Auth pour un gérant / domaine
async function fetchTeamMembersFromCloud(ownerUserId, ownerEmail = "") {
  try {
    const serviceKey = SUPABASE_SERVICE_ROLE_KEY;
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=100`, {
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`
      }
    });
    if (!res.ok) return [];
    const data = await res.json();
    const users = data.users || [];
    return users.filter(u => {
      const meta = u.user_metadata || {};
      if (!meta.is_team_member) return false;
      if (ownerUserId && meta.owner_user_id === ownerUserId) return true;
      if (ownerEmail && (meta.owner_email || "").toLowerCase() === ownerEmail.toLowerCase()) return true;
      return false;
    }).map(u => {
      const meta = u.user_metadata || {};
      return {
        id: meta.member_id || u.id,
        authUserId: u.id,
        name: meta.full_name || u.email,
        role: meta.role || "Tractoriste / Chauffeur d'engins",
        roleCategory: meta.role_category || "tractoriste",
        status: meta.status || "Actif",
        email: u.email,
        password: meta.plain_password || "",
        phone: meta.phone || "",
        certifications: meta.certifications || "",
        notes: meta.notes || "",
        ownerUserId: meta.owner_user_id || ownerUserId,
        ownerDomain: meta.owner_domain || "Domaine Viticole",
        ownerEmail: meta.owner_email || ownerEmail
      };
    });
  } catch (e) {
    console.warn("Notice fetchTeamMembersFromCloud :", e);
    return [];
  }
}

window.SUPABASE_SERVICE_ROLE_KEY = SUPABASE_SERVICE_ROLE_KEY;
window.createConfirmedUser = createConfirmedUser;
window.upsertConfirmedUser = upsertConfirmedUser;
window.fetchTeamMembersFromCloud = fetchTeamMembersFromCloud;
