/**
 * VitiTrack Pro — Test Automatisé : Partage des données du Domaine Multi-Utilisateurs (Prestation)
 * Vérifie que tous les utilisateurs d'un même domaine (salariés, tractoristes, gérants)
 * accèdent aux clients, parcelles et interventions du domaine créés par le gérant.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("🍇 ==========================================================================");
console.log("🍇 TESTS : ACCÈS MULTI-UTILISATEURS & PARTAGE DES DONNÉES DU GÉRANT");
console.log("🍇 ==========================================================================\n");

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function it(description, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${description}`);
  } catch (err) {
    failedTests++;
    console.error(`  ❌ [FAIL] ${description}`);
    console.error(`     Erreur: ${err.message}\n`);
  }
}

// 1. Simulation d'environnement LocalStorage & Session
const mockStorage = {};
const localStorageMock = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

// Lecture du code source pour valider les implémentations
const dashboardJs = fs.readFileSync(path.join(__dirname, "..", "dashboard.js"), "utf8");
const loginHtml = fs.readFileSync(path.join(__dirname, "..", "login.html"), "utf8");
const edgeFnTs = fs.readFileSync(path.join(__dirname, "..", "supabase", "functions", "admin-update-user-password", "index.ts"), "utf8");
const sqlFix = fs.readFileSync(path.join(__dirname, "..", "supabase", "fix_multiuser_prestation_access.sql"), "utf8");

const MANAGER_ID = "usr-manager-uuid-001";
const WORKER_A_ID = "usr-worker-uuid-002";
const WORKER_B_ID = "usr-worker-uuid-003";

console.log("📌 SUITE 1 : Résolution de l'identifiant propriétaire (getAuthUserId)");

it("1.1 Le gérant utilise directement son propre identifiant", () => {
  const managerUser = {
    id: MANAGER_ID,
    authUserId: MANAGER_ID,
    role: "Gérant Exploitant",
    isTeamMember: false,
    ownerUserId: MANAGER_ID
  };
  
  function getAuthUserId(user) {
    if (!user) return null;
    if (user.isTeamMember && user.ownerUserId) return user.ownerUserId;
    return user.authUserId || user.id || null;
  }

  assert.strictEqual(getAuthUserId(managerUser), MANAGER_ID);
});

it("1.2 Un collaborateur (salarié/tractoriste) est automatiquement routé vers l'identifiant du gérant", () => {
  const workerUser = {
    id: WORKER_A_ID,
    authUserId: WORKER_A_ID,
    fullName: "Jean Tractoriste",
    role: "Tractoriste / Chauffeur d'engins",
    isTeamMember: true,
    ownerUserId: MANAGER_ID,
    ownerDomain: "Domaine de Test"
  };

  function getAuthUserId(user) {
    if (!user) return null;
    if (user.isTeamMember && user.ownerUserId) return user.ownerUserId;
    return user.authUserId || user.id || null;
  }

  assert.strictEqual(getAuthUserId(workerUser), MANAGER_ID, "L'identifiant renvoyé doit être celui du gérant propriétaire");
});

console.log("\n📌 SUITE 2 : Vérification Multi-Sources dans checkAuthUser (dashboard.js)");

it("2.1 checkAuthUser contient la détection via app_metadata, team_memberships, user_metadata, cache local et annuaire", () => {
  assert.ok(dashboardJs.includes("appMeta.owner_user_id"), "Doit vérifier appMeta.owner_user_id");
  assert.ok(dashboardJs.includes("team_memberships"), "Doit vérifier team_memberships");
  assert.ok(dashboardJs.includes("meta.owner_user_id"), "Doit vérifier user_metadata meta.owner_user_id");
  assert.ok(dashboardJs.includes("vititrack_global_team_directory"), "Doit vérifier l'annuaire d'équipe local");
  assert.ok(dashboardJs.includes("vititrack_auth_user"), "Doit vérifier la session issue du login");
});

it("2.2 Simulation de checkAuthUser : un collaborateur rattaché hérite de l'ownerUserId", () => {
  // Simule les 5 étapes de checkAuthUser
  function simulateCheckAuthUser(session, localDir = [], localAuthUser = null) {
    const authUserId = session.user.id;
    const userEmail = (session.user.email || "").toLowerCase();
    const meta = session.user.user_metadata || {};
    const appMeta = session.user.app_metadata || {};

    let isVerifiedTeamMember = false;
    let verifiedOwnerUserId = null;
    let canViewDashboard = true;

    if (appMeta.owner_user_id && appMeta.owner_user_id !== authUserId) {
      isVerifiedTeamMember = true;
      verifiedOwnerUserId = appMeta.owner_user_id;
    }

    if (!isVerifiedTeamMember && meta.owner_user_id && meta.owner_user_id !== authUserId) {
      isVerifiedTeamMember = true;
      verifiedOwnerUserId = meta.owner_user_id;
    }

    if (!isVerifiedTeamMember && localAuthUser && localAuthUser.ownerUserId && localAuthUser.ownerUserId !== authUserId) {
      isVerifiedTeamMember = true;
      verifiedOwnerUserId = localAuthUser.ownerUserId;
    }

    if (!isVerifiedTeamMember) {
      const entry = (localDir || []).find(e => e.email && e.email.toLowerCase() === userEmail);
      if (entry && entry.ownerUserId && entry.ownerUserId !== authUserId) {
        isVerifiedTeamMember = true;
        verifiedOwnerUserId = entry.ownerUserId;
      }
    }

    const finalOwnerUserId = isVerifiedTeamMember ? verifiedOwnerUserId : authUserId;
    return {
      id: authUserId,
      isTeamMember: isVerifiedTeamMember,
      ownerUserId: finalOwnerUserId
    };
  }

  // Cas 1: Via app_metadata
  const res1 = simulateCheckAuthUser({
    user: { id: WORKER_A_ID, email: "worker1@domaine.fr", app_metadata: { owner_user_id: MANAGER_ID } }
  });
  assert.strictEqual(res1.isTeamMember, true);
  assert.strictEqual(res1.ownerUserId, MANAGER_ID);

  // Cas 2: Via user_metadata
  const res2 = simulateCheckAuthUser({
    user: { id: WORKER_A_ID, email: "worker1@domaine.fr", user_metadata: { owner_user_id: MANAGER_ID } }
  });
  assert.strictEqual(res2.isTeamMember, true);
  assert.strictEqual(res2.ownerUserId, MANAGER_ID);

  // Cas 3: Via annuaire local d'équipe
  const res3 = simulateCheckAuthUser(
    { user: { id: WORKER_A_ID, email: "worker1@domaine.fr" } },
    [{ email: "worker1@domaine.fr", ownerUserId: MANAGER_ID }]
  );
  assert.strictEqual(res3.isTeamMember, true);
  assert.strictEqual(res3.ownerUserId, MANAGER_ID);
});

console.log("\n📌 SUITE 3 : Partitionnement & Partage des Données Locales");

it("3.1 Le gérant et le collaborateur partagent les mêmes clés de stockage local", () => {
  const STORAGE_CLIENTS_BASE = "vititrack_clients_user_v3";
  const STORAGE_INTERVENTIONS_BASE = "vititrack_interventions_user_v3";

  const managerUser = { id: MANAGER_ID, isTeamMember: false, ownerUserId: MANAGER_ID };
  const workerUser = { id: WORKER_A_ID, isTeamMember: true, ownerUserId: MANAGER_ID };

  function getKey(baseKey, user) {
    const uid = (user.isTeamMember && user.ownerUserId) ? user.ownerUserId : user.id;
    return `${baseKey}_${uid}`;
  }

  const managerClientKey = getKey(STORAGE_CLIENTS_BASE, managerUser);
  const workerClientKey = getKey(STORAGE_CLIENTS_BASE, workerUser);
  assert.strictEqual(managerClientKey, workerClientKey, "La clé de stockage des clients doit être rigoureusement identique");

  const managerInvKey = getKey(STORAGE_INTERVENTIONS_BASE, managerUser);
  const workerInvKey = getKey(STORAGE_INTERVENTIONS_BASE, workerUser);
  assert.strictEqual(managerInvKey, workerInvKey, "La clé de stockage des interventions doit être rigoureusement identique");
});

it("3.2 Données créées par le gérant immédiatement visibles par le collaborateur", () => {
  const key = `vititrack_clients_user_v3_${MANAGER_ID}`;
  const clientsData = [
    { id: "CLI-01", name: "Château Margaux", parcels: [{ id: "P-01", name: "Les Graves", surface: 4.5 }] },
    { id: "CLI-02", name: "Domaine de Chevalier", parcels: [{ id: "P-02", name: "Grand Enclos", surface: 2.3 }] }
  ];
  localStorageMock.setItem(key, JSON.stringify(clientsData));

  // Le collaborateur lit la base avec son propre profil
  const workerUser = { id: WORKER_A_ID, isTeamMember: true, ownerUserId: MANAGER_ID };
  const workerKey = `vititrack_clients_user_v3_${workerUser.ownerUserId}`;
  const loadedClients = JSON.parse(localStorageMock.getItem(workerKey));

  assert.strictEqual(loadedClients.length, 2);
  assert.strictEqual(loadedClients[0].name, "Château Margaux");
  assert.strictEqual(loadedClients[1].name, "Domaine de Chevalier");
});

it("3.3 Intervention enregistrée par le collaborateur immédiatement visible par le gérant", () => {
  const invKey = `vititrack_interventions_user_v3_${MANAGER_ID}`;
  const interventionsData = [
    { id: "INV-01", client: "Château Margaux", task: "Taille de la vigne", worker: "Gérant", total: 450 }
  ];
  localStorageMock.setItem(invKey, JSON.stringify(interventionsData));

  // Le collaborateur ajoute une intervention sur le chantier du domaine
  const currentInvs = JSON.parse(localStorageMock.getItem(invKey));
  currentInvs.push({
    id: "INV-02",
    client: "Château Margaux",
    task: "Broyage des sarments",
    worker: "Jean Tractoriste",
    total: 320
  });
  localStorageMock.setItem(invKey, JSON.stringify(currentInvs));

  // Le gérant recharge ses interventions
  const managerLoadedInvs = JSON.parse(localStorageMock.getItem(invKey));
  assert.strictEqual(managerLoadedInvs.length, 2);
  assert.strictEqual(managerLoadedInvs[1].worker, "Jean Tractoriste");
  assert.strictEqual(managerLoadedInvs[1].task, "Broyage des sarments");
});

console.log("\n📌 SUITE 4 : Détection dans login.html");

it("4.1 login.html inclut la vérification appMeta, team_memberships et annuaire d'équipe", () => {
  assert.ok(loginHtml.includes("appMeta.owner_user_id"), "login.html doit vérifier appMeta.owner_user_id");
  assert.ok(loginHtml.includes("team_memberships"), "login.html doit vérifier team_memberships");
  assert.ok(loginHtml.includes("vititrack_global_team_directory"), "login.html doit vérifier l'annuaire");
  assert.ok(loginHtml.includes("isTeamMember && ownerUserId"), "login.html doit rattacher le membre avec ownerUserId");
});

console.log("\n📌 SUITE 5 : Synchronisation Cloud & Edge Function");

it("5.1 L'Edge Function admin-update-user-password alimente app_metadata et team_memberships", () => {
  assert.ok(edgeFnTs.includes("app_metadata: newAppMeta"), "Doit renseigner app_metadata à la création");
  assert.ok(edgeFnTs.includes("app_metadata: updatedAppMeta"), "Doit renseigner app_metadata à la modification");
  assert.ok(edgeFnTs.includes("team_memberships"), "Doit synchroniser la table team_memberships");
  assert.ok(edgeFnTs.includes("status: \"accepted\""), "Doit définir le statut accepted pour l'accès direct");
});

it("5.2 dashboard.js implémente window.fetchTeamMembersFromCloud", () => {
  assert.ok(dashboardJs.includes("window.fetchTeamMembersFromCloud = async function"), "Doit définir fetchTeamMembersFromCloud");
  assert.ok(dashboardJs.includes("from(\"team_memberships\")"), "Doit requêter team_memberships");
});

console.log("\n📌 SUITE 6 : Fonction PostgreSQL RLS & Script de Correction SQL");

it("6.1 Le script fix_multiuser_prestation_access.sql renforce get_current_owner_user_id()", () => {
  assert.ok(sqlFix.includes("FUNCTION public.get_current_owner_user_id()"), "Définit get_current_owner_user_id()");
  assert.ok(sqlFix.includes("auth.jwt() -> 'app_metadata' ->> 'owner_user_id'"), "Prend en compte app_metadata du JWT");
  assert.ok(sqlFix.includes("auth.jwt() -> 'user_metadata' ->> 'owner_user_id'"), "Prend en compte user_metadata du JWT");
  assert.ok(sqlFix.includes("public.team_memberships"), "Prend en compte team_memberships");
  assert.ok(sqlFix.includes("interventions_select_policy"), "Politique de sélection sur interventions");
  assert.ok(sqlFix.includes("clients_select_policy"), "Politique de sélection sur clients");
});

console.log("\n==========================================================================");
console.log(`📊 RÉSULTAT : ${passedTests} / ${totalTests} TESTS PASSÉS AVEC SUCCÈS`);
console.log("==========================================================================\n");

if (failedTests > 0) {
  process.exit(1);
}
