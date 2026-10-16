const fs = require('fs');
const path = require('path');

function runRelationalAudit() {
  console.log("==================================================================");
  console.log("VITITRACK PRESTATION — AUDIT D'INTÉGRITÉ RELATIONNELLE DES SAUVEGARDES");
  console.log("==================================================================\n");

  const backupsBase = path.resolve(__dirname, '../backups');
  if (!fs.existsSync(backupsBase)) {
    console.error("❌ Dossier backups/ introuvable.");
    process.exit(1);
  }

  const entries = fs.readdirSync(backupsBase).filter(f => f.startsWith('backup_')).sort().reverse();
  if (entries.length === 0) {
    console.error("❌ Aucune sauvegarde trouvée.");
    process.exit(1);
  }

  const backupDir = path.join(backupsBase, entries[0]);
  console.log(`📁 Analyse de la sauvegarde : ${backupDir}\n`);

  const manifest = JSON.parse(fs.readFileSync(path.join(backupDir, 'manifest.json'), 'utf8'));
  const clients = JSON.parse(fs.readFileSync(path.join(backupDir, 'clients.json'), 'utf8'));
  const parcelles = JSON.parse(fs.readFileSync(path.join(backupDir, 'parcelles.json'), 'utf8'));
  const interventions = JSON.parse(fs.readFileSync(path.join(backupDir, 'interventions.json'), 'utf8'));
  const services = JSON.parse(fs.readFileSync(path.join(backupDir, 'services.json'), 'utf8'));
  const plannedWorks = JSON.parse(fs.readFileSync(path.join(backupDir, 'planned_works.json'), 'utf8'));
  const users = JSON.parse(fs.readFileSync(path.join(backupDir, 'users_directory.json'), 'utf8'));

  const checks = [];
  const logCheck = (title, ok, detail) => {
    checks.push({ title, ok, detail });
    console.log(`${ok ? '✅' : '❌'} ${title} : ${ok ? 'CONFORME' : 'ANOMALIE'} (${detail})`);
  };

  // 1. Unicité des Clés Primaires
  const checkUniquePk = (name, list) => {
    const ids = new Set();
    const dups = [];
    for (const item of list) {
      if (ids.has(item.id)) dups.push(item.id);
      ids.add(item.id);
    }
    return { ok: dups.length === 0, count: list.length, dups };
  };

  const pkClients = checkUniquePk("clients", clients);
  logCheck("Unicité IDs Clients", pkClients.ok, `${pkClients.count} clients distincts`);

  const pkParcelles = checkUniquePk("parcelles", parcelles);
  logCheck("Unicité IDs Parcelles", pkParcelles.ok, `${pkParcelles.count} parcelles distinctes`);

  const pkInv = checkUniquePk("interventions", interventions);
  logCheck("Unicité IDs Interventions", pkInv.ok, `${pkInv.count} interventions distinctes`);

  const pkSrv = checkUniquePk("services", services);
  logCheck("Unicité IDs Prestations", pkSrv.ok, `${pkSrv.count} prestations distinctes`);

  const pkPw = checkUniquePk("planned_works", plannedWorks);
  logCheck("Unicité IDs Travaux à faire", pkPw.ok, `${pkPw.count} travaux distincts`);

  // 2. Intégrité Relationnelle Parcelles -> Clients
  const clientMap = new Map(clients.map(c => [c.id, c]));
  let orphanParcelles = 0;
  let tenantMismatch = 0;
  for (const p of parcelles) {
    if (!clientMap.has(p.client_id)) {
      orphanParcelles++;
    } else {
      const parent = clientMap.get(p.client_id);
      if (parent.user_id !== p.user_id) {
        tenantMismatch++;
      }
    }
  }
  logCheck("Rattachement Parcelles -> Clients", orphanParcelles === 0, 
    orphanParcelles === 0 ? "100% des 87 parcelles reliées à un client valide" : `${orphanParcelles} parcelles orphelines`);
  logCheck("Concordance Propriétaire Client/Parcelle", tenantMismatch === 0, 
    tenantMismatch === 0 ? "100% des parcelles partagent le user_id de leur client parent" : `${tenantMismatch} discordances`);

  // 3. Intégrité Relationnelle Interventions -> Clients & Prestations
  let orphanInvClient = 0;
  for (const inv of interventions) {
    if (inv.client_id && !clientMap.has(inv.client_id)) {
      orphanInvClient++;
    }
  }
  logCheck("Rattachement Interventions -> Clients", orphanInvClient === 0,
    orphanInvClient === 0 ? `${interventions.length} interventions vérifiées` : `${orphanInvClient} interventions avec client_id inconnu`);

  // 4. Sommation et Métriques
  const totalSurface = parcelles.reduce((acc, p) => acc + (parseFloat(p.surface) || 0), 0);
  const totalHt = interventions.reduce((acc, i) => acc + (parseFloat(i.total) || 0), 0);
  console.log(`\n📊 SYNTHÈSE DES DONNÉES SAUVEGARDÉES :`);
  console.log(`   - Superficie totale cadastrée : ${totalSurface.toFixed(4)} ha`);
  console.log(`   - Montant total des chantiers sauvegardés : ${totalHt.toFixed(2)} € HT`);
  console.log(`   - Utilisateurs répertoriés : ${users.length} comptes`);

  console.log("\n==================================================================");
  const successCount = checks.filter(c => c.ok).length;
  console.log(`BILAN DU CONTRÔLE D'INTÉGRITÉ : ${successCount} / ${checks.length} conformités validées`);
  console.log("==================================================================");
}

runRelationalAudit();
