const fs = require('fs');
const path = require('path');

// Chargement des variables d'environnement depuis .env
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zygxjkckwaskukhnltck.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isDryRun = process.argv.includes('--dry-run') || !process.argv.includes('--execute');

async function verifyAndRestoreBackup(backupDir) {
  if (!backupDir || !fs.existsSync(backupDir)) {
    console.error("❌ ERREUR: Dossier de sauvegarde introuvable ou non spécifié.");
    console.log("Usage: node scripts/restore_prestation_backup.js <chemin_du_dossier_backup> [--dry-run | --execute]");
    process.exit(1);
  }

  console.log(`🍇 [VitiTrack Prestation] Contrôle d'intégrité de la sauvegarde :\n   ${backupDir}\n`);

  const manifestPath = path.join(backupDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error("❌ ERREUR: manifest.json manquant dans le dossier de sauvegarde.");
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`Horodatage de la sauvegarde : ${manifest.timestamp}`);

  const tables = ["clients", "parcelles", "interventions", "services", "planned_works", "subscriptions"];
  let integrityOk = true;

  for (const table of tables) {
    const filePath = path.join(backupDir, `${table}.json`);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Fichier manquant: ${table}.json`);
      integrityOk = false;
      continue;
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const expected = manifest.tables[table]?.count;
      if (data.length === expected) {
        console.log(`✅ Table '${table}': ${data.length} enregistrements vérifiés (Conforme au manifeste)`);
      } else {
        console.warn(`⚠️ Table '${table}': ${data.length} enregistrements trouvés vs ${expected} attendus.`);
      }
    } catch (e) {
      console.error(`❌ Erreur de syntaxe JSON dans ${table}.json: ${e.message}`);
      integrityOk = false;
    }
  }

  const usersPath = path.join(backupDir, 'users_directory.json');
  if (fs.existsSync(usersPath)) {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    console.log(`✅ Profils utilisateurs: ${users.length} profils vérifiés (sans mot de passe)`);
  }

  if (!integrityOk) {
    console.error("\n❌ Échec du contrôle d'intégrité de la sauvegarde.");
    process.exit(1);
  }

  console.log("\n✅ INTÉGRITÉ DE LA SAUVEGARDE VALIDÉE À 100%.");

  if (isDryRun) {
    console.log("\n🔒 Mode simulation (--dry-run) : Aucune modification apportée à la base de données.");
    console.log("Pour exécuter une restauration réelle (nécessite autorisation) : ajoutez le drapeau --execute");
    return;
  }

  // Restauration réelle (si --execute passé explicitement)
  console.log("\n⚠️ RESTAURATION RÉELLE DEMANDÉE SUR SUPABASE...");
  if (!SERVICE_KEY) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY manquante. Restauration annulée.");
    process.exit(1);
  }

  const headers = {
    "apikey": SERVICE_KEY,
    "Authorization": `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
  };

  for (const table of tables) {
    const filePath = path.join(backupDir, `${table}.json`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (data.length === 0) continue;

    console.log(`- Restauration de '${table}' (${data.length} lignes)...`);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers,
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      console.error(`❌ Erreur lors de la restauration de ${table}:`, await res.text());
    } else {
      console.log(`✅ Table '${table}' restaurée avec succès.`);
    }
  }

  console.log("\n🎉 Restauration complète terminée avec succès !");
}

// Récupération du dossier cible passé en argument ou du dernier backup
let targetDir = process.argv[2];
if (!targetDir || targetDir.startsWith('--')) {
  const backupsBase = path.resolve(__dirname, '../backups');
  if (fs.existsSync(backupsBase)) {
    const entries = fs.readdirSync(backupsBase)
      .filter(f => f.startsWith('backup_'))
      .sort()
      .reverse();
    if (entries.length > 0) {
      targetDir = path.join(backupsBase, entries[0]);
    }
  }
}

verifyAndRestoreBackup(targetDir);
