// VitiTrack Pro — Supabase Edge Function: admin-update-user-password
// Permet à un gérant/administrateur de mettre à jour le mot de passe d'un collaborateur de son domaine en toute sécurité
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

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

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Configuration serveur incomplète (clés manquantes)." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Authentification de l'administrateur appelant via son JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé : token de session manquant." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Non autorisé : token vide." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: callerData, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerData || !callerData.user) {
      return new Response(JSON.stringify({ error: "Session administrateur invalide ou expirée." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminUser = callerData.user;
    const adminId = adminUser.id;
    const adminMeta = adminUser.user_metadata || {};
    const adminAppMeta = adminUser.app_metadata || {};

    // 2. Vérification des droits administrateur (Gérant / Propriétaire)
    const isAdmin =
      adminMeta.role === "Gérant Exploitant" ||
      adminMeta.role_category === "gerant" ||
      adminAppMeta.role === "owner" ||
      adminAppMeta.role === "admin" ||
      !adminMeta.is_team_member; // Un utilisateur propriétaire n'a pas is_team_member=true

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Action interdite : vous devez être gérant ou administrateur du domaine." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Extraction et validation des paramètres
    const body = await req.json();
    const { targetUserId, targetEmail, newPassword } = body || {};

    if (!targetUserId && !targetEmail) {
      return new Response(JSON.stringify({ error: "Identifiant ou e-mail de l'utilisateur cible manquant." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!newPassword || typeof newPassword !== "string" || newPassword.trim().length < 6) {
      return new Response(JSON.stringify({ error: "Le mot de passe doit comporter au moins 6 caractères." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Initialisation du client d'administration Supabase côté serveur
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // 5. Recherche de l'utilisateur cible
    let targetUser = null;
    if (targetUserId) {
      const { data: uData, error: uErr } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
      if (!uErr && uData && uData.user) {
        targetUser = uData.user;
      }
    }

    if (!targetUser && targetEmail) {
      const cleanEmail = targetEmail.trim().toLowerCase();
      const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 100,
      });
      if (!listErr && listData && Array.isArray(listData.users)) {
        targetUser = listData.users.find(u => (u.email || "").toLowerCase() === cleanEmail) || null;
      }
    }

    if (!targetUser) {
      if (body && body.createIfNotFound && targetEmail) {
        const targetDomain = body.ownerDomain || adminMeta.domain_name || adminMeta.owner_domain || "Domaine Viticole";
        const targetOwnerEmail = body.ownerEmail || adminUser.email || "";

        // Création d'un nouveau collaborateur directement dans Supabase Auth
        const newMemberMeta = {
          full_name: body.fullName || targetEmail.split("@")[0],
          role: body.role || "Tractoriste / Chauffeur d'engins",
          role_category: body.roleCategory || "tractoriste",
          is_team_member: true,
          can_view_dashboard: body.canViewDashboard === true,
          owner_user_id: adminId,
          owner_domain: targetDomain,
          owner_email: targetOwnerEmail,
          phone: body.phone || "",
          certifications: body.certifications || "",
          notes: body.notes || "",
          status: "Actif",
        };

        const newAppMeta = {
          owner_user_id: adminId,
          is_team_member: true,
          can_view_dashboard: body.canViewDashboard === true,
          role: body.role || "Tractoriste / Chauffeur d'engins",
          owner_domain: targetDomain,
          owner_email: targetOwnerEmail
        };

        const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: targetEmail.trim().toLowerCase(),
          password: newPassword.trim(),
          email_confirm: true,
          user_metadata: newMemberMeta,
          app_metadata: newAppMeta
        });

        if (createErr) {
          return new Response(JSON.stringify({ error: `Erreur création Supabase Auth : ${createErr.message}` }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Synchronisation immédiate et obligatoire dans la table team_memberships (statut accepted)
        if (createData?.user?.id) {
          const { error: tmErr } = await supabaseAdmin.from("team_memberships").upsert({
            owner_user_id: adminId,
            member_user_id: createData.user.id,
            role: body.role || "Tractoriste / Chauffeur d'engins",
            can_view_dashboard: body.canViewDashboard === true,
            status: "accepted",
            invited_by: adminId,
            invited_email: targetEmail.trim().toLowerCase(),
            accepted_at: new Date().toISOString()
          }, { onConflict: "member_user_id" });

          if (tmErr) {
            console.error("❌ Échec critique team_memberships lors de la création :", tmErr);
            // ROLLBACK SÉCURISÉ : Suppression immédiate du compte Auth pour éviter tout compte orphelin sans entreprise
            let rollbackSuccess = false;
            try {
              const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(createData.user.id);
              if (!delErr) {
                rollbackSuccess = true;
              } else {
                console.error("⚠️ Échec suppression compte orphelin :", delErr);
                // Récupération d'urgence : Désactivation du compte pour interdire toute connexion
                await supabaseAdmin.auth.admin.updateUserById(createData.user.id, {
                  ban_duration: "876000h",
                  user_metadata: { orphan_error: tmErr.message || "Rattachement entreprise échoué" }
                });
              }
            } catch (rollbackEx) {
              console.error("⚠️ Exception lors du rollback :", rollbackEx);
            }

            return new Response(JSON.stringify({ 
              error: `Échec du rattachement à l'entreprise : ${tmErr.message || tmErr}. Le compte a été ${rollbackSuccess ? "supprimé" : "désactivé"} par sécurité.` 
            }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            created: true,
            message: "Compte collaborateur créé avec succès dans Supabase Auth.",
            userId: createData.user?.id,
            email: createData.user?.email,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(JSON.stringify({ error: "Utilisateur cible introuvable sur Supabase Auth." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Vérification stricte d'appartenance à la même entreprise / même domaine
    const targetMeta = targetUser.user_metadata || {};
    const targetAppMeta = targetUser.app_metadata || {};

    const targetBelongsToAdmin =
      targetUser.id === adminId ||
      targetMeta.owner_user_id === adminId ||
      targetAppMeta.owner_user_id === adminId ||
      (targetMeta.owner_email && targetMeta.owner_email.toLowerCase() === (adminUser.email || "").toLowerCase());

    if (!targetBelongsToAdmin) {
      return new Response(JSON.stringify({ error: "Action interdite : cet utilisateur n'appartient pas à votre domaine." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7. Mise à jour sécurisée du mot de passe dans Supabase Auth
    // Nettoyage en passant de toute mention héritée de plain_password dans user_metadata
    const updatedMeta = { ...targetMeta };
    delete updatedMeta.plain_password;
    updatedMeta.is_team_member = true;
    updatedMeta.owner_user_id = adminId;
    if (body.ownerDomain || adminMeta.domain_name || adminMeta.owner_domain) {
      updatedMeta.owner_domain = body.ownerDomain || adminMeta.domain_name || adminMeta.owner_domain;
    }
    if (body.ownerEmail || adminUser.email) {
      updatedMeta.owner_email = body.ownerEmail || adminUser.email;
    }
    if (body.canViewDashboard !== undefined) updatedMeta.can_view_dashboard = body.canViewDashboard === true;
    if (body.role) updatedMeta.role = body.role;
    if (body.fullName) updatedMeta.full_name = body.fullName;

    const updatedAppMeta = {
      ...(targetUser.app_metadata || {}),
      owner_user_id: adminId,
      is_team_member: true,
      can_view_dashboard: updatedMeta.can_view_dashboard,
      role: updatedMeta.role,
      owner_domain: updatedMeta.owner_domain,
      owner_email: updatedMeta.owner_email
    };

    const { data: updateData, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
      password: newPassword.trim(),
      user_metadata: updatedMeta,
      app_metadata: updatedAppMeta
    });

    if (updateErr) {
      return new Response(JSON.stringify({ error: `Erreur Supabase Auth : ${updateErr.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Synchronisation immédiate dans la table team_memberships (statut accepted)
    const { error: tmUpdateErr } = await supabaseAdmin.from("team_memberships").upsert({
      owner_user_id: adminId,
      member_user_id: targetUser.id,
      role: updatedMeta.role || "Tractoriste / Chauffeur d'engins",
      can_view_dashboard: updatedMeta.can_view_dashboard !== false,
      status: "accepted",
      invited_by: adminId,
      invited_email: (targetUser.email || targetEmail).trim().toLowerCase(),
      accepted_at: new Date().toISOString()
    }, { onConflict: "member_user_id" });

    if (tmUpdateErr) {
      console.error("❌ Échec team_memberships lors de la mise à jour :", tmUpdateErr);
      return new Response(JSON.stringify({ 
        error: `Erreur lors du rattachement dans team_memberships : ${tmUpdateErr.message || tmUpdateErr}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Mot de passe mis à jour avec succès dans Supabase Auth.",
        userId: targetUser.id,
        email: targetUser.email,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: `Erreur serveur interne : ${err.message || err}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
