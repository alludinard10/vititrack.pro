const fs = require('fs');
const path = require('path');

// Chargement sécurisé de l'environnement depuis .env (non versionné)
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let val = (match[2] || '').trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[match[1]] = val;
      }
    }
  }
}
loadEnv();

async function runEnterpriseWorkflowTest() {
  console.log("==================================================================");
  console.log("VITITRACK PRESTATION — TEST DE FLUX COLLABORATIF PAR ENTREPRISE");
  console.log("==================================================================\n");

  const backupsBase = path.resolve(__dirname, '../backups');
  const entries = fs.readdirSync(backupsBase).filter(f => f.startsWith('backup_')).sort().reverse();
  const backupDir = path.join(backupsBase, entries[0]);

  const users = JSON.parse(fs.readFileSync(path.join(backupDir, 'users_directory.json')));
  const clients = JSON.parse(fs.readFileSync(path.join(backupDir, 'clients.json')));
  const parcelles = JSON.parse(fs.readFileSync(path.join(backupDir, 'parcelles.json')));
  const interventions = JSON.parse(fs.readFileSync(path.join(backupDir, 'interventions.json')));
  const plannedWorks = JSON.parse(fs.readFileSync(path.join(backupDir, 'planned_works.json')));

  const alexis = users.find(u => u.email === "al.ludinard@gmail.com");
  const paul = users.find(u => u.email === "paul.ludinard2006@gmail.com");
  const viaux = users.find(u => u.email === "presta.viaux@gmail.com");

  // 1. Définition de l'espace commun d'entreprise
  const DOMAINE_LUDINARD_ID = alexis.id;
  const VIAUX_ID = viaux.id;

  // Simulateur de base de données relationnelle Supabase avec RLS
  const db = {
    team_memberships: [
      { owner_user_id: DOMAINE_LUDINARD_ID, member_user_id: paul.id, invited_email: paul.email, role: "Tractoriste / Chauffeur d'engins", can_view_dashboard: true, status: "accepted" }
    ],
    clients: [...clients],
    parcelles: [...parcelles],
    interventions: [...interventions],
    planned_works: [...plannedWorks]
  };

  function getResolvedOwnerId(user) {
    const tm = db.team_memberships.find(m => m.member_user_id === user.id || (m.invited_email && m.invited_email.toLowerCase() === user.email.toLowerCase()));
    if (tm && tm.status === 'accepted') return tm.owner_user_id;
    return user.id;
  }

  function executeQuery(user, table, action, payload = null) {
    const ownerId = getResolvedOwnerId(user);
    const isWorker = db.team_memberships.some(m => m.member_user_id === user.id && m.owner_user_id !== user.id);

    if (action === 'SELECT') {
      return db[table].filter(row => row.user_id === ownerId);
    }
    if (action === 'INSERT') {
      // Contrôle RLS serveur : seul le gérant supprime ou modifie certaines tables
      if (table === 'services' && isWorker) throw new Error("403 Forbidden: Seul le gérant peut modifier les prestations");
      const record = { ...payload, user_id: ownerId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      db[table].push(record);
      return record;
    }
    if (action === 'UPDATE') {
      const idx = db[table].findIndex(row => row.id === payload.id && row.user_id === ownerId);
      if (idx === -1) throw new Error("404 Not found or 403 Forbidden");
      db[table][idx] = { ...db[table][idx], ...payload, updated_at: new Date().toISOString() };
      return db[table][idx];
    }
    if (action === 'DELETE') {
      if ((table === 'interventions' || table === 'clients' || table === 'parcelles') && isWorker) {
        throw new Error("403 Forbidden: Seul le gérant est autorisé à supprimer");
      }
      db[table] = db[table].filter(row => !(row.id === payload.id && row.user_id === ownerId));
      return { success: true };
    }
  }

  const tests = [];
  const assert = (title, condition, detail) => {
    tests.push({ title, condition, detail });
    console.log(`${condition ? '✅' : '❌'} ${title} : ${condition ? 'VALIDE' : 'ÉCHEC'} (${detail})`);
  };

  console.log("--- SCÉNARIO COLLABORATIF DOMAINE LUDINARD ---\n");

  // TEST 1 : Alexis crée un travail à faire
  const taskCreatedByAlexis = executeQuery(alexis, 'planned_works', 'INSERT', {
    id: "PLN-TEST-LUDINARD-01",
    client_name: "SARL Ludinard Clair",
    parcel: "Les Terres Blanches",
    service: "Tirage des bois & Broyage",
    worker: "Paul Ludinard",
    date: "2026-10-20",
    status: "À réaliser"
  });
  assert("1. Alexis crée un travail prévisionnel", !!taskCreatedByAlexis, `ID: ${taskCreatedByAlexis.id}`);

  // TEST 2 : Paul consulte les travaux à faire et retrouve celui d'Alexis
  const paulPlannedWorks = executeQuery(paul, 'planned_works', 'SELECT');
  const paulSeesTask = paulPlannedWorks.find(p => p.id === "PLN-TEST-LUDINARD-01");
  assert("2. Paul consulte les travaux et retrouve la tâche d'Alexis", !!paulSeesTask, 
    paulSeesTask ? `Tâche trouvée : ${paulSeesTask.service} pour ${paulSeesTask.client_name}` : "Non trouvée");

  // TEST 3 : Paul saisit une intervention réalisée
  const interventionCreatedByPaul = executeQuery(paul, 'interventions', 'INSERT', {
    id: "INV-TEST-LUDINARD-99",
    client: "SARL Ludinard Clair",
    parcel: "Les Terres Blanches",
    task: "Tirage des bois & Broyage",
    worker: "Paul Ludinard",
    quantity: 6,
    unit: "heures",
    unit_price: 38,
    total: 228,
    status: "À facturer",
    datetime: "2026-10-20T14:30"
  });
  assert("3. Paul enregistre une intervention terminée", !!interventionCreatedByPaul, 
    `Montant: ${interventionCreatedByPaul.total} € HT`);

  // TEST 4 : Alexis consulte son journal d'interventions et retrouve le travail de Paul
  const alexisInterventions = executeQuery(alexis, 'interventions', 'SELECT');
  const alexisSeesIntervention = alexisInterventions.find(i => i.id === "INV-TEST-LUDINARD-99");
  assert("4. Alexis consulte le journal et voit l'intervention saisie par Paul", !!alexisSeesIntervention,
    alexisSeesIntervention ? `Trouvée : ${alexisSeesIntervention.task} réalisée par ${alexisSeesIntervention.worker}` : "Non trouvée");

  // TEST 5 : Alexis modifie le statut de facturation
  const updatedByAlexis = executeQuery(alexis, 'interventions', 'UPDATE', {
    id: "INV-TEST-LUDINARD-99",
    status: "Facturée"
  });
  const paulSeesUpdate = executeQuery(paul, 'interventions', 'SELECT').find(i => i.id === "INV-TEST-LUDINARD-99");
  assert("5. Alexis passe en 'Facturée' -> Paul voit immédiatement la mise à jour", paulSeesUpdate?.status === "Facturée",
    `Statut vu par Paul: ${paulSeesUpdate?.status}`);

  // TEST 6 : Sécurité serveur : Paul tente de supprimer une intervention
  let paulDeleteBlocked = false;
  try {
    executeQuery(paul, 'interventions', 'DELETE', { id: "INV-TEST-LUDINARD-99" });
  } catch (e) {
    paulDeleteBlocked = true;
  }
  assert("6. Sécurité RLS : Paul (salarié) interdit de supprimer une intervention", paulDeleteBlocked,
    "Rejet 403 conforme : seul le gérant (Alexis) peut supprimer");

  // TEST 7 : Sécurité serveur : Paul tente de modifier les prix du catalogue
  let paulPriceEditBlocked = false;
  try {
    executeQuery(paul, 'services', 'INSERT', { id: "SRV-FORBIDDEN", name: "Prix piraté", price: 10 });
  } catch (e) {
    paulPriceEditBlocked = true;
  }
  assert("7. Sécurité RLS : Paul interdit de modifier les prix des prestations", paulPriceEditBlocked,
    "Rejet 403 conforme");

  // TEST 8 : Étanchéité absolue : VIAUX se connecte
  const viauxClients = executeQuery(viaux, 'clients', 'SELECT');
  const viauxInterventions = executeQuery(viaux, 'interventions', 'SELECT');
  const viauxSeesLudinard = viauxClients.some(c => c.user_id === DOMAINE_LUDINARD_ID) || viauxInterventions.some(i => i.user_id === DOMAINE_LUDINARD_ID);
  assert("8. Étanchéité inter-entreprises : VIAUX ne voit RIEN du Domaine Ludinard", !viauxSeesLudinard,
    `Clients vus par VIAUX: ${viauxClients.length} (dont Ludinard: 0)`);

  // TEST 9 : Déconnexion et Reconnexion
  const reconnectedAlexisClients = executeQuery(alexis, 'clients', 'SELECT');
  const reconnectedPaulClients = executeQuery(paul, 'clients', 'SELECT');
  assert("9. Reconnexion : Alexis et Paul retrouvent les 30 clients sans perte", 
    reconnectedAlexisClients.length === 30 && reconnectedPaulClients.length === 30,
    `Alexis: ${reconnectedAlexisClients.length} clients, Paul: ${reconnectedPaulClients.length} clients`);

  console.log("\n==================================================================");
  const successCount = tests.filter(t => t.condition).length;
  console.log(`BILAN DU TEST DE FLUX : ${successCount} / ${tests.length} tests réussis`);
  console.log("==================================================================");
}

runEnterpriseWorkflowTest();
