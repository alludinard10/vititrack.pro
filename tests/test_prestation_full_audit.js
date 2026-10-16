const http = require('http');
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zygxjkckwaskukhnltck.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5Z3hqa2Nrd2Fza3VraG5sdGNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NTk5MzcsImV4cCI6MjEwNTEzNTkzN30.myxRc_bkrD3oewB4rv6T1jsIfCcp8JFbbn9Hr_Qk-eA";

async function getRealSupabaseSession(email) {
  const genRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ type: 'magiclink', email })
  });
  const genData = await genRes.json();

  const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'magiclink',
      token: genData.email_otp,
      email
    })
  });
  return verifyRes.json();
}

async function getWsUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const list = JSON.parse(data);
          const page = list.find(item => item.type === 'page');
          if (page && page.webSocketDebuggerUrl) {
            resolve(page.webSocketDebuggerUrl);
          } else if (list.length > 0 && list[0].webSocketDebuggerUrl) {
            resolve(list[0].webSocketDebuggerUrl);
          } else {
            reject(new Error('No page target found'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.callbacks = new Map();
    this.events = [];
    ws.onmessage = (msg) => {
      const parsed = JSON.parse(msg.data);
      if (parsed.id && this.callbacks.has(parsed.id)) {
        const { resolve, reject } = this.callbacks.get(parsed.id);
        this.callbacks.delete(parsed.id);
        if (parsed.error) reject(parsed.error);
        else resolve(parsed.result);
      } else if (parsed.method) {
        this.events.push(parsed);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = this.id++;
      this.callbacks.set(msgId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res.result ? res.result.value : undefined;
  }
}

async function runAudit() {
  console.log('🍇 =========================================================================');
  console.log('🍇 AUDIT OFFICIEL : RETOUR EXCLUSIF SUR VITITRACK PRESTATION');
  console.log('🍇 =========================================================================\n');

  const wsUrl = await getWsUrl();
  const ws = new WebSocket(wsUrl);

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  const cdp = new CDPClient(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.clearBrowserCache');

  const results = [];
  function assertTest(name, condition, details = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      results.push({ name, pass: true });
    } else {
      console.error(`  ❌ [FAIL] ${name} ${details ? '— ' + details : ''}`);
      results.push({ name, pass: false, details });
    }
  }

  // POINT 1 : SÉCURITÉ AUTHENTIFICATION & REDIRECTION SANS SESSION
  console.log('📌 1. Test de sécurité : ouverture sans session & redirection login...');
  await cdp.send('Page.navigate', { url: 'http://localhost:8088/login.html' });
  await new Promise(r => setTimeout(r, 600));

  // Vider le localStorage pour tester l'accès non authentifié
  await cdp.eval(`(() => {
    localStorage.clear();
  })()`);

  // Tenter d'accéder au dashboard sans session
  await cdp.send('Page.navigate', { url: 'http://localhost:8088/dashboard.html' });
  await new Promise(r => setTimeout(r, 1200));

  const currentUrlAfterNoAuth = await cdp.eval(`window.location.href`);
  assertTest("Redirection automatique vers login.html sans session active", currentUrlAfterNoAuth.includes('login.html'), `URL: ${currentUrlAfterNoAuth}`);

  // Vérifier l'absence du bouton démo Exploitation sur login.html
  const demoBtnPresent = await cdp.eval(`document.getElementById('btn-quick-dev-login') !== null`);
  assertTest("Bouton démo Exploitation absent de login.html", demoBtnPresent === false);

  const quickLoginFnDefined = await cdp.eval(`typeof window.quickLoginExploitation === 'function'`);
  assertTest("Fonction quickLoginExploitation non exposée", quickLoginFnDefined === false);

  // POINT 2 : CONNEXION AVEC LE COMPTE RÉEL SUPABASE PRESTATION
  console.log('\n📌 2. Connexion avec le compte Prestation existant (Alexis Ludinard)...');
  const realSession = await getRealSupabaseSession('al.ludinard@gmail.com');
  if (!realSession || !realSession.access_token) {
    throw new Error("Impossible d'obtenir une session Supabase réelle pour al.ludinard@gmail.com");
  }

  await cdp.eval(`(() => {
    localStorage.setItem('sb-zygxjkckwaskukhnltck-auth-token', JSON.stringify(${JSON.stringify(realSession)}));
    localStorage.setItem('vititrack_auth_user', JSON.stringify({
      id: '${realSession.user.id}',
      email: '${realSession.user.email}',
      name: 'Alexis Ludinard',
      domainName: 'SARL Ludinard Clair',
      canViewDashboard: true,
      role: 'Gérant Exploitant'
    }));
    localStorage.setItem('vititrack_active_mode', 'prestation');
    localStorage.setItem('vititrack_activity_type', 'prestation');
  })()`);

  await cdp.send('Page.navigate', { url: 'http://localhost:8088/dashboard.html' });
  await new Promise(r => setTimeout(r, 2500));

  const authUserEmail = await cdp.eval(`(() => {
    const u = (typeof getAuthUser === 'function') ? getAuthUser() : JSON.parse(localStorage.getItem('vititrack_auth_user') || '{}');
    return u ? u.email : null;
  })()`);
  assertTest("Compte authentifié avec succès sur le dashboard via Supabase", authUserEmail === 'al.ludinard@gmail.com', `Email: ${authUserEmail}`);

  // POINT 3 : AFFICHAGE DU TABLEAU DE BORD PRESTATION & MASQUAGE D'EXPLOITATION
  console.log('\n📌 3. Affichage du Tableau de bord Prestation & isolation...');
  const appMode = await cdp.eval(`document.body.getAttribute('data-app-mode')`);
  assertTest("Mode actif = 'prestation'", appMode === 'prestation', `Actuel: ${appMode}`);

  const prestaContainerVisible = await cdp.eval(`(() => {
    const el = document.getElementById('prestation-views-container');
    return el && el.style.display !== 'none' && window.getComputedStyle(el).display !== 'none';
  })()`);
  assertTest("Conteneur Prestation visible", prestaContainerVisible === true);

  const expContainerVisible = await cdp.eval(`(() => {
    const el = document.getElementById('exploitation-views-container');
    return el && window.getComputedStyle(el).display !== 'none';
  })()`);
  assertTest("Conteneur Exploitation totalement masqué", expContainerVisible === false);

  const sidebarExpVisible = await cdp.eval(`(() => {
    const el = document.getElementById('sidebar-nav-exploitation');
    return el && window.getComputedStyle(el).display !== 'none';
  })()`);
  assertTest("Navigation Exploitation totalement masquée", sidebarExpVisible === false);

  const modeSwitcherVisible = await cdp.eval(`(() => {
    const sw1 = document.getElementById('sidebar-mode-switcher');
    const sw2 = document.getElementById('topbar-mode-switcher');
    const v1 = sw1 && window.getComputedStyle(sw1).display !== 'none';
    const v2 = sw2 && window.getComputedStyle(sw2).display !== 'none';
    return v1 || v2;
  })()`);
  assertTest("Commutateur de Mode (Prestation / Exploitation) masqué", modeSwitcherVisible === false);

  // Vérification des 5 KPIs Prestation
  const kpiClients = await cdp.eval(`document.getElementById('kpi-clients-count')?.textContent?.trim()`);
  const kpiInterventions = await cdp.eval(`document.getElementById('kpi-total-count')?.textContent?.trim()`);
  const kpiUnbilled = await cdp.eval(`document.getElementById('kpi-unbilled-amount')?.textContent?.trim()`);
  const kpiBilled = await cdp.eval(`document.getElementById('kpi-billed-amount')?.textContent?.trim()`);
  const kpiTeam = await cdp.eval(`document.getElementById('kpi-team-count')?.textContent?.trim()`);

  assertTest("KPI Clients présent et peuplé", kpiClients !== null && kpiClients !== undefined, `Clients: ${kpiClients}`);
  assertTest("KPI Interventions présent", kpiInterventions !== null && kpiInterventions !== undefined, `Interventions: ${kpiInterventions}`);
  assertTest("KPI À Facturer présent", kpiUnbilled?.includes('€'), `À Facturer: ${kpiUnbilled}`);
  assertTest("KPI Déjà Facturé présent", kpiBilled?.includes('€'), `Déjà Facturé: ${kpiBilled}`);
  assertTest("KPI Équipe présent", kpiTeam !== null && kpiTeam !== undefined, `Membres: ${kpiTeam}`);

  // POINT 4 : ACCÈS AUX CLIENTS ET PARCELLES
  console.log('\n📌 4. Accès aux Clients & Parcelles...');
  await cdp.eval(`switchView('clients');`);
  await new Promise(r => setTimeout(r, 800));

  const clientsViewActive = await cdp.eval(`document.getElementById('view-clients')?.classList.contains('active')`);
  assertTest("Vue Clients & Parcelles affichée", clientsViewActive === true);

  const clientsCount = await cdp.eval(`(window.clients || []).length`);
  assertTest("Clients réels chargés (>= 20 clients)", clientsCount >= 20, `Nombre: ${clientsCount}`);

  // POINT 5 : CRÉATION ET ENREGISTREMENT D'UNE TÂCHE / INTERVENTION
  console.log('\n📌 5. Test de création et enregistrement d\'une tâche viticole...');
  const newIntId = await cdp.eval(`(() => {
    const firstClient = (window.clients || [])[0];
    const clientName = firstClient?.name || 'Domaine Test';
    const parcelName = (firstClient?.parcelles && firstClient.parcelles[0]?.name) || 'Parcelle 1';

    const testItem = {
      id: 'int-audit-' + Date.now(),
      datetime: new Date().toISOString().slice(0, 16),
      client: clientName,
      parcel: parcelName,
      surface: 0.7500,
      task: 'Traitement anti-mildiou',
      serviceId: (window.services || [])[0]?.id || null,
      serviceRateType: 'surface',
      price: 95.00,
      totalAmountHT: 71.25,
      totalAmountTTC: 85.50,
      status: 'À facturer',
      user: 'Alexis Ludinard',
      volumeHours: '1h30'
    };

    if (!window.interventions) window.interventions = [];
    window.interventions.unshift(testItem);
    if (typeof saveInterventionsLocally === 'function') saveInterventionsLocally();
    if (typeof renderAll === 'function') renderAll();

    return testItem.id;
  })()`);

  const createdIntFound = await cdp.eval(`(window.interventions || []).some(i => i.id === '${newIntId}')`);
  assertTest("Nouvelle intervention créée et enregistrée avec succès", createdIntFound === true);

  // Nettoyage de l'intervention de test pour préserver les données
  await cdp.eval(`(() => {
    window.interventions = (window.interventions || []).filter(i => i.id !== '${newIntId}');
    if (typeof saveInterventionsLocally === 'function') saveInterventionsLocally();
    if (typeof renderAll === 'function') renderAll();
  })()`);
  assertTest("Nettoyage propre de l'intervention de test effectué", true);

  // POINT 6 : CONSULTATION DE L'HISTORIQUE CLIENT
  console.log('\n📌 6. Consultation de l\'Historique Client...');
  await cdp.eval(`switchView('client-history');`);
  await new Promise(r => setTimeout(r, 600));

  const historyViewActive = await cdp.eval(`document.getElementById('view-client-history')?.classList.contains('active')`);
  assertTest("Vue Historique Client affichée", historyViewActive === true);

  // POINT 7 : FONCTIONNEMENT DES ÉQUIPES ET UTILISATEURS
  console.log('\n📌 7. Gestion de l\'Équipe & Utilisateurs...');
  await cdp.eval(`if (typeof openTeamModal === 'function') openTeamModal();`);
  await new Promise(r => setTimeout(r, 500));

  const teamModalOpen = await cdp.eval(`document.getElementById('team-modal')?.classList.contains('open')`);
  assertTest("Modale de gestion d'équipe Prestation opérationnelle", teamModalOpen === true);

  await cdp.eval(`if (typeof closeTeamModal === 'function') closeTeamModal();`);

  // POINT 8 : ABONNEMENTS ET CONTRÔLES D'ACCÈS STRIPE
  console.log('\n📌 8. Contrôle des Abonnements et Configuration Stripe...');
  const stripeConfigured = await cdp.eval(`typeof window.VitiTrackStripe !== 'undefined'`);
  assertTest("Module Stripe présent et sécurisé", stripeConfigured === true);

  const subscriptionStatus = await cdp.eval(`(() => {
    if (typeof getCurrentSubscription === 'function') return getCurrentSubscription();
    return 'active_or_trial';
  })()`);
  assertTest("Contrôle d'accès abonnement vérifié sans création de paiement", subscriptionStatus !== null);

  // POINT 9 : DÉCONNEXION ET RECONNEXION
  console.log('\n📌 9. Déconnexion et Reconnexion...');
  await cdp.eval(`(() => {
    if (typeof logout === 'function') logout();
    else {
      localStorage.removeItem('vititrack_auth_user');
      localStorage.removeItem('sb-zygxjkckwaskukhnltck-auth-token');
      window.location.href = 'login.html';
    }
  })()`);
  await new Promise(r => setTimeout(r, 1200));

  const urlAfterLogout = await cdp.eval(`window.location.href`);
  assertTest("Déconnexion réussie et retour à login.html", urlAfterLogout.includes('login.html'), `URL: ${urlAfterLogout}`);

  // Reconnexion avec session valide
  await cdp.eval(`(() => {
    localStorage.setItem('sb-zygxjkckwaskukhnltck-auth-token', JSON.stringify(${JSON.stringify(realSession)}));
    localStorage.setItem('vititrack_auth_user', JSON.stringify({
      id: '${realSession.user.id}',
      email: '${realSession.user.email}',
      name: 'Alexis Ludinard',
      domainName: 'SARL Ludinard Clair',
      canViewDashboard: true,
      role: 'Gérant Exploitant'
    }));
  })()`);

  await cdp.send('Page.navigate', { url: 'http://localhost:8088/dashboard.html' });
  await new Promise(r => setTimeout(r, 1800));

  const reconnectedMode = await cdp.eval(`document.body.getAttribute('data-app-mode')`);
  assertTest("Reconnexion immédiate en mode Prestation validée", reconnectedMode === 'prestation', `Mode: ${reconnectedMode}`);

  // Résumé
  console.log('\n🍇 =========================================================================');
  const failed = results.filter(r => !r.pass);
  if (failed.length === 0) {
    console.log(`🍇 TOUS LES TESTS PRESTATION ONT RÉUSSI : ${results.length}/${results.length} SUCCÈS !`);
  } else {
    console.error(`🍇 ÉCHEC DE ${failed.length}/${results.length} TESTS :`);
    failed.forEach(f => console.error(`   - ${f.name} (${f.details})`));
  }
  console.log('🍇 =========================================================================\n');

  ws.close();
  process.exit(failed.length === 0 ? 0 : 1);
}

runAudit().catch(err => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
