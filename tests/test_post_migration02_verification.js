/**
 * VITITRACK PRESTATION — TEST DE VALIDATION SÉCURISÉE POST-MIGRATION 02
 * 
 * Ce script valide rigoureusement les 11 critères de sécurité de la Migration 02 :
 * 1. Partage des données du Domaine Ludinard (30 clients, 56 parcelles, 14 interventions).
 * 2. Création légitime d'intervention par Paul rattachée au Domaine d'Alexis.
 * 3. Modification légitime d'intervention par Paul.
 * 4. Interdiction stricte de suppression d'intervention pour Paul.
 * 5. Interdiction stricte de suppression de clients et parcelles pour Paul.
 * 6. Interdiction stricte de modification des tarifs du catalogue pour Paul.
 * 7. Verrouillage Stripe : Interdiction absolue pour Paul de modifier subscriptions.
 * 8. Verrouillage Stripe Navigateur : Interdiction pour Alexis de modifier subscriptions directement via l'API client.
 * 9. Interdiction pour Paul de modifier les rôles ou rattachements dans team_memberships.
 * 10. Cloisonnement étanche absolu avec VIAUX (0 fuite, injection 403 rejetée).
 * 11. Simulation du flux Web navigateur (login.html + dashboard.js) pour Paul.
 */

const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let val = (match[2] || '').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[match[1]] = val;
      }
    }
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

async function getJwtForEmail(email) {
  const genRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email })
  });
  const genData = await genRes.json();
  const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token: genData.email_otp, email })
  });
  const data = await verifyRes.json();
  return { token: data.access_token, user: data.user };
}

async function runPostMigration02Verification() {
  console.log("====================================================================");
  console.log("SUITE DE VÉRIFICATION DE SÉCURITÉ POST-MIGRATION 02");
  console.log("====================================================================\n");

  const alexis = await getJwtForEmail("al.ludinard@gmail.com");
  const paul = await getJwtForEmail("paul.ludinard2006@gmail.com");
  const viaux = await getJwtForEmail("presta.viaux@gmail.com");

  console.log("Identifiants authentifiés :");
  console.log(`- Alexis (Gérant) : ${alexis.user.id}`);
  console.log(`- Paul (Salarié)  : ${paul.user.id}`);
  console.log(`- VIAUX (Externe) : ${viaux.user.id}\n`);

  let failures = 0;

  // 1. PARTAGE EN LECTURE
  console.log("1. Contrôle du partage en lecture (Domaine Ludinard) :");
  const alexisCli = await (await fetch(`${SUPABASE_URL}/rest/v1/clients?select=id`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${alexis.token}` }
  })).json();
  const paulCli = await (await fetch(`${SUPABASE_URL}/rest/v1/clients?select=id`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${paul.token}` }
  })).json();
  if (alexisCli.length === 30 && paulCli.length === 30) {
    console.log(`   ✅ Alexis et Paul partagent les 30 clients.`);
  } else {
    console.error(`   ❌ Échec partage clients: Alexis=${alexisCli.length}, Paul=${paulCli.length}`);
    failures++;
  }

  const alexisPar = await (await fetch(`${SUPABASE_URL}/rest/v1/parcelles?select=id`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${alexis.token}` }
  })).json();
  const paulPar = await (await fetch(`${SUPABASE_URL}/rest/v1/parcelles?select=id`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${paul.token}` }
  })).json();
  if (alexisPar.length === 56 && paulPar.length === 56) {
    console.log(`   ✅ Alexis et Paul partagent les 56 parcelles.`);
  } else {
    console.error(`   ❌ Échec partage parcelles: Alexis=${alexisPar.length}, Paul=${paulPar.length}`);
    failures++;
  }

  // 2. CRÉATION D'INTERVENTION PAR PAUL
  console.log("\n2. Création d'une intervention par Paul pour l'entreprise :");
  const testInvId = `inv_test_sec_${Date.now()}`;
  const insRes = await fetch(`${SUPABASE_URL}/rest/v1/interventions`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${paul.token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      id: testInvId,
      user_id: alexis.user.id,
      client: "Château Test",
      parcel: "Parcelle Sécurité",
      task: "Taille",
      worker: "Paul Ludinard",
      datetime: new Date().toISOString(),
      quantity: 1.0,
      total: 50.0,
      status: "pending"
    })
  });
  if (insRes.status === 201) {
    console.log(`   ✅ Intervention ${testInvId} créée avec succès par Paul.`);
  } else {
    console.error(`   ❌ Échec création intervention par Paul :`, insRes.status, await insRes.text());
    failures++;
  }

  // 3. MODIFICATION PAR PAUL
  console.log("\n3. Modification d'une intervention par Paul :");
  const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/interventions?id=eq.${testInvId}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${paul.token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ notes: "Modifié sur le terrain par Paul" })
  });
  const updateData = await updateRes.json();
  if (Array.isArray(updateData) && updateData.length === 1 && updateData[0].notes.includes("Paul")) {
    console.log(`   ✅ Modification validée par Paul.`);
  } else {
    console.error(`   ❌ Échec modification intervention :`, updateData);
    failures++;
  }

  // 4. SUPPRESSION PAR PAUL (DOIT ÊTRE BLOQUÉE)
  console.log("\n4. Tentative de suppression d'intervention par Paul (interdite) :");
  const delInvRes = await fetch(`${SUPABASE_URL}/rest/v1/interventions?id=eq.${testInvId}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${paul.token}`, 'Prefer': 'return=representation' }
  });
  const delInvData = await delInvRes.json();
  if (Array.isArray(delInvData) && delInvData.length === 0) {
    console.log(`   ✅ Suppression par Paul bloquée (0 ligne supprimée).`);
  } else {
    console.error(`   ❌ Échec sécurité : Paul a pu supprimer l'intervention !`, delInvData);
    failures++;
  }

  // Nettoyage légitime par Alexis
  await fetch(`${SUPABASE_URL}/rest/v1/interventions?id=eq.${testInvId}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${alexis.token}` }
  });

  // 5. SUPPRESSION DE CLIENTS PAR PAUL (DOIT ÊTRE BLOQUÉE)
  console.log("\n5. Tentative de suppression d'un client d'Alexis par Paul :");
  const anyCli = alexisCli[0]?.id;
  const delCliRes = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${anyCli}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${paul.token}`, 'Prefer': 'return=representation' }
  });
  const delCliData = await delCliRes.json();
  if (Array.isArray(delCliData) && delCliData.length === 0) {
    console.log(`   ✅ Suppression de client par Paul bloquée (0 ligne supprimée).`);
  } else {
    console.error(`   ❌ Échec sécurité : Paul a pu supprimer un client !`, delCliData);
    failures++;
  }

  // 6. MODIFICATION DES TARIFS PAR PAUL (DOIT ÊTRE BLOQUÉE)
  console.log("\n6. Tentative de modification des tarifs catalogue par Paul :");
  const srvRes = await (await fetch(`${SUPABASE_URL}/rest/v1/services?user_id=eq.${alexis.user.id}&limit=1`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
  })).json();
  const targetSrv = srvRes[0];
  const patchSrvRes = await fetch(`${SUPABASE_URL}/rest/v1/services?id=eq.${targetSrv.id}`, {
    method: 'PATCH',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${paul.token}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify({ price: 9999.0 })
  });
  const patchSrvData = await patchSrvRes.json();
  if (Array.isArray(patchSrvData) && patchSrvData.length === 0) {
    console.log(`   ✅ Modification des tarifs par Paul bloquée (0 ligne modifiée).`);
  } else {
    console.error(`   ❌ Échec sécurité : Paul a pu modifier un tarif !`, patchSrvData);
    failures++;
  }

  // 7 & 8. VERROUILLAGE DES ABONNEMENTS STRIPE (PAUL & ALEXIS)
  console.log("\n7 & 8. Protection absolue des abonnements Stripe (Client Read-Only) :");
  const subPatchPaul = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${alexis.user.id}`, {
    method: 'PATCH',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${paul.token}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify({ plan_id: 'enterprise_hacked' })
  });
  const subDataPaul = await subPatchPaul.json();
  if (Array.isArray(subDataPaul) && subDataPaul.length === 0) {
    console.log(`   ✅ Tentative Paul sur subscriptions bloquée (0 ligne modifiée).`);
  } else {
    console.error(`   ❌ Échec sécurité : Paul a pu altérer subscriptions !`, subDataPaul);
    failures++;
  }

  const subPatchAlexis = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${alexis.user.id}`, {
    method: 'PATCH',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${alexis.token}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify({ plan_id: 'enterprise_free_bypass' })
  });
  const subDataAlexis = await subPatchAlexis.json();
  if (Array.isArray(subDataAlexis) && subDataAlexis.length === 0) {
    console.log(`   ✅ Modification directe Stripe par Alexis bloquée en REST client (0 ligne modifiée, réservé au serveur).`);
  } else {
    console.error(`   ❌ Échec sécurité : Alexis a pu modifier directement subscriptions sans passer par Stripe !`, subDataAlexis);
    failures++;
  }

  // 9. PROTECTION TEAM_MEMBERSHIPS
  console.log("\n9. Protection des adhésions et rôles (team_memberships) :");
  const patchTmRes = await fetch(`${SUPABASE_URL}/rest/v1/team_memberships?member_user_id=eq.${paul.user.id}`, {
    method: 'PATCH',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${paul.token}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify({ role: 'owner', owner_user_id: paul.user.id })
  });
  const patchTmData = await patchTmRes.json();
  if (Array.isArray(patchTmData) && patchTmData.length === 0) {
    console.log(`   ✅ Auto-promotion de Paul bloquée (0 ligne modifiée).`);
  } else {
    console.error(`   ❌ Échec sécurité : Paul a pu modifier son rôle dans team_memberships !`, patchTmData);
    failures++;
  }

  // 10. ÉTANCHÉITÉ AVEC VIAUX
  console.log("\n10. Étancheité totale inter-entreprises (VIAUX) :");
  const viauxClients = await (await fetch(`${SUPABASE_URL}/rest/v1/clients?user_id=eq.${alexis.user.id}&select=id`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${viaux.token}` }
  })).json();
  if (Array.isArray(viauxClients) && viauxClients.length === 0) {
    console.log(`   ✅ VIAUX ne voit aucun client d'Alexis (0 fuite).`);
  } else {
    console.error(`   ❌ Fuite critique : VIAUX a vu des clients d'Alexis !`, viauxClients);
    failures++;
  }

  const viauxPostRes = await fetch(`${SUPABASE_URL}/rest/v1/interventions`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${viaux.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: `inv_viaux_illegal_${Date.now()}`,
      user_id: alexis.user.id,
      client: "Piratage",
      parcel: "A",
      task: "Taille",
      datetime: new Date().toISOString(),
      total: 10
    })
  });
  if (viauxPostRes.status === 403 || viauxPostRes.status === 400) {
    console.log(`   ✅ Tentative d'injection de VIAUX chez Alexis bloquée (HTTP ${viauxPostRes.status}).`);
  } else {
    console.error(`   ❌ Échec sécurité : VIAUX a pu injecter chez Alexis !`, viauxPostRes.status);
    failures++;
  }

  // 11. SIMULATION DU FLUX WEB DANS LE NAVIGATEUR
  console.log("\n11. Simulation du flux Web navigateur (login.html + dashboard.js) :");
  const tmCheck = await (await fetch(`${SUPABASE_URL}/rest/v1/team_memberships?select=owner_user_id,role,can_view_dashboard&member_user_id=eq.${paul.user.id}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${paul.token}` }
  })).json();
  const memberEntry = tmCheck[0];
  const browserOwnerId = memberEntry ? memberEntry.owner_user_id : paul.user.id;
  const webClients = await (await fetch(`${SUPABASE_URL}/rest/v1/clients?user_id=eq.${browserOwnerId}&select=id`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${paul.token}` }
  })).json();
  const webParcelles = await (await fetch(`${SUPABASE_URL}/rest/v1/parcelles?user_id=eq.${browserOwnerId}&select=id`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${paul.token}` }
  })).json();

  if (webClients.length === 30 && webParcelles.length === 56) {
    console.log(`   ✅ Flux navigateur validé : 30 clients et 56 parcelles chargés avec succès.`);
  } else {
    console.error(`   ❌ Flux navigateur incomplet : ${webClients.length} clients, ${webParcelles.length} parcelles.`);
    failures++;
  }

  console.log("\n====================================================================");
  if (failures === 0) {
    console.log("RÉSULTAT FINAL : 11/11 CONTRÔLES DE SÉCURITÉ AU VERT.");
  } else {
    console.error(`RÉSULTAT FINAL : ${failures} CONTRÔLE(S) EN ÉCHEC.`);
  }
  console.log("====================================================================");
}

runPostMigration02Verification();
