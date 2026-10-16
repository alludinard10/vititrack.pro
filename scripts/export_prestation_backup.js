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
        const key = match[1];
        let val = match[2] || '';
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val.trim();
      }
    }
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zygxjkckwaskukhnltck.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error("❌ ERREUR: SUPABASE_SERVICE_ROLE_KEY manquant dans .env. Sauvegarde interrompue.");
  process.exit(1);
}

const headers = {
  "apikey": SERVICE_KEY,
  "Authorization": `Bearer ${SERVICE_KEY}`
};

async function runBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(__dirname, `../backups/backup_${timestamp}`);
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log(`🍇 [VitiTrack Prestation] Début de la sauvegarde complète dans :\n   ${backupDir}\n`);

  const tables = [
    "clients",
    "parcelles",
    "interventions",
    "services",
    "planned_works",
    "subscriptions"
  ];

  const summary = {
    timestamp: new Date().toISOString(),
    environment: "production",
    supabase_url: SUPABASE_URL,
    tables: {},
    users_count: 0
  };

  // 1. Sauvegarde des tables métier
  for (const table of tables) {
    process.stdout.write(`- Extraction de '${table}'... `);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, { headers });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }
      const data = await res.json();
      
      // Assainissement (aucune donnée sensible / token)
      const sanitized = data.map(row => {
        const copy = { ...row };
        delete copy.password;
        delete copy.token;
        delete copy.jwt;
        return copy;
      });

      fs.writeFileSync(
        path.join(backupDir, `${table}.json`),
        JSON.stringify(sanitized, null, 2),
        'utf8'
      );

      summary.tables[table] = {
        count: sanitized.length,
        file: `${table}.json`
      };
      console.log(`✅ ${sanitized.length} enregistrements`);
    } catch (err) {
      console.log(`❌ Erreur: ${err.message}`);
      summary.tables[table] = { error: err.message };
    }
  }

  // 2. Sauvegarde des profils et rattachements utilisateurs (sans mot de passe ni secrets)
  process.stdout.write(`- Extraction des profils et rattachements utilisateurs... `);
  try {
    const resUsers = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=100`, { headers });
    if (!resUsers.ok) {
      throw new Error(`HTTP ${resUsers.status}: ${await resUsers.text()}`);
    }
    const usersData = await resUsers.json();
    const rawUsers = usersData.users || [];

    // Assainissement strict : conservation des métadonnées métier uniquement, zéro mot de passe ou hash
    const sanitizedUsers = rawUsers.map(u => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      email_confirmed_at: u.email_confirmed_at,
      app_metadata: {
        provider: u.app_metadata?.provider,
        role: u.app_metadata?.role,
        owner_user_id: u.app_metadata?.owner_user_id
      },
      user_metadata: {
        full_name: u.user_metadata?.full_name,
        role: u.user_metadata?.role,
        role_category: u.user_metadata?.role_category,
        can_view_dashboard: u.user_metadata?.can_view_dashboard,
        owner_domain: u.user_metadata?.owner_domain,
        owner_email: u.user_metadata?.owner_email,
        owner_user_id: u.user_metadata?.owner_user_id,
        is_team_member: u.user_metadata?.is_team_member,
        domain_name: u.user_metadata?.domain_name,
        certifications: u.user_metadata?.certifications,
        status: u.user_metadata?.status
      }
    }));

    fs.writeFileSync(
      path.join(backupDir, `users_directory.json`),
      JSON.stringify(sanitizedUsers, null, 2),
      'utf8'
    );

    summary.users_count = sanitizedUsers.length;
    console.log(`✅ ${sanitizedUsers.length} profils sécurisés`);
  } catch (err) {
    console.log(`❌ Erreur: ${err.message}`);
    summary.users_error = err.message;
  }

  // 3. Fichier de métadonnées et manifeste de contrôle
  fs.writeFileSync(
    path.join(backupDir, `manifest.json`),
    JSON.stringify(summary, null, 2),
    'utf8'
  );

  console.log(`\n🎉 Sauvegarde terminée avec succès dans : ${backupDir}`);
  console.log(`Manifeste :`, JSON.stringify(summary.tables, null, 2));
}

runBackup();
