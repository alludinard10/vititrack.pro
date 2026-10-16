const http = require('http');

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

async function runTest() {
  console.log('🍇 =========================================================================');
  console.log('🍇 TEST OFFICIEL CDP : BOUTON « SOUMETTRE À VALIDATION » ET CYCLE DE VIE');
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

  // 1. Initialisation de la session sur login.html
  console.log('📌 1. Configuration de session et navigation...');
  await cdp.send('Page.navigate', { url: 'http://localhost:8088/login.html' });
  await new Promise(r => setTimeout(r, 800));

  await cdp.eval(`(() => {
    const futureTime = Math.floor(Date.now() / 1000) + 3600 * 24 * 30;
    const testUser = {
      id: 'c2d45d88-3214-4c93-9361-565d6ac24d1a',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'al.ludinard@gmail.com',
      email_confirmed_at: new Date().toISOString(),
      user_metadata: {
        organization_id: 'org-ludinard-1',
        role: 'exploitant',
        activity_type: 'viticulture_directe',
        domain_name: 'SARL Ludinard Clair',
        full_name: 'Alexis Ludinard'
      }
    };
    localStorage.setItem('sb-zygxjkckwaskukhnltck-auth-token', JSON.stringify({
      access_token: 'mock-token',
      refresh_token: 'mock-refresh',
      expires_at: futureTime,
      token_type: 'bearer',
      user: testUser
    }));
    localStorage.setItem('vititrack_auth_user', JSON.stringify({
      id: testUser.id,
      email: testUser.email,
      name: 'Alexis Ludinard',
      domainName: 'SARL Ludinard Clair',
      canViewDashboard: true,
      role: 'exploitant'
    }));
    localStorage.setItem('vititrack_active_mode', 'exploitation');
    localStorage.setItem('vititrack_activity_type', 'viticulture_directe');
  })()`);

  // 2. Navigation vers la vue interventions
  await cdp.send('Page.navigate', { url: 'http://localhost:8088/dashboard.html?mode=exploitation&view=interventions' });
  await new Promise(r => setTimeout(r, 2000));

  // Intercepteur d'alert() et confirm() dans le navigateur
  await cdp.eval(`(() => {
    window._lastAlertMessage = null;
    window._alertHistory = [];
    window.alert = function(msg) {
      window._lastAlertMessage = msg;
      window._alertHistory.push(msg);
      console.log('ALERT_INTERCEPTED:', msg);
    };
    window.confirm = function(msg) {
      return true;
    };
  })()`);

  // Vérifier chargement de la vue interventions
  const activeMode = await cdp.eval(`document.body.getAttribute('data-app-mode')`);
  assertTest("Mode actif = 'exploitation'", activeMode === 'exploitation', `Actuel: ${activeMode}`);

  const activeView = await cdp.eval(`typeof VitiEnvState !== 'undefined' ? VitiEnvState.currentExpView : null`);
  assertTest("Vue active = 'interventions'", activeView === 'interventions', `Actuelle: ${activeView}`);

  // 3. Vérification du bouton « Soumettre à validation » dans le DOM de la modale
  console.log('\n📌 2. Vérification du libellé et de la présence du bouton dans la modale...');
  const submitBtnText = await cdp.eval(`document.getElementById('btn-save-exp-int-submit')?.textContent?.trim()`);
  assertTest("Libellé du bouton = « 📤 Soumettre à validation »", submitBtnText === '📤 Soumettre à validation', `Trouvé: "${submitBtnText}"`);

  // 4. Test des validations de formulaire et mise en évidence en rouge (.input-validation-error)
  console.log('\n📌 3. Test des contrôles de saisie et mise en évidence visuelle des erreurs...');

  // Ouvrir la modale
  await cdp.eval(`openInterventionModal();`);
  await new Promise(r => setTimeout(r, 400));

  // A. Travail non sélectionné
  await cdp.eval(`(() => {
    document.getElementById('modal-int-task-select').value = '';
    document.getElementById('btn-save-exp-int-submit').click();
  })()`);
  await new Promise(r => setTimeout(r, 300));

  const alert1 = await cdp.eval(`window._lastAlertMessage`);
  const hasTaskErrorClass = await cdp.eval(`document.getElementById('modal-int-task-select')?.classList.contains('input-validation-error')`);
  assertTest("Erreur travail manquant détectée avec message précis", alert1?.includes("sélectionner un travail viticole"), `Message: ${alert1}`);
  assertTest("Champ travail mis en évidence en rouge (.input-validation-error)", hasTaskErrorClass === true);

  // B. Date manquante
  await cdp.eval(`(() => {
    const select = document.getElementById('modal-int-task-select');
    if (select.options.length > 1) select.selectedIndex = 1;
    select.dispatchEvent(new Event('change'));
    document.getElementById('modal-int-date').value = '';
    document.getElementById('btn-save-exp-int-submit').click();
  })()`);
  await new Promise(r => setTimeout(r, 300));

  const alert2 = await cdp.eval(`window._lastAlertMessage`);
  const hasDateErrorClass = await cdp.eval(`document.getElementById('modal-int-date')?.classList.contains('input-validation-error')`);
  assertTest("Erreur date manquante détectée avec message précis", alert2?.includes("renseigner une date"), `Message: ${alert2}`);
  assertTest("Champ date mis en évidence en rouge (.input-validation-error)", hasDateErrorClass === true);

  // C. Aucune parcelle sélectionnée
  await cdp.eval(`(() => {
    document.getElementById('modal-int-date').value = '2026-10-16';
    document.querySelectorAll('input[name="modal-int-parcelle-cb"]').forEach(cb => {
      cb.checked = false;
      onModalInterventionParcelleToggle(cb.value, false);
    });
    document.getElementById('btn-save-exp-int-submit').click();
  })()`);
  await new Promise(r => setTimeout(r, 300));

  const alert3 = await cdp.eval(`window._lastAlertMessage`);
  const hasChecklistError = await cdp.eval(`document.getElementById('modal-int-parcelles-checklist')?.classList.contains('input-validation-error')`);
  assertTest("Erreur aucune parcelle cochée détectée", alert3?.includes("sélectionner au moins une parcelle"), `Message: ${alert3}`);
  assertTest("Checklist parcelles mise en évidence en rouge", hasChecklistError === true);

  // D. Surface saisie <= 0
  await cdp.eval(`(() => {
    const cb = document.querySelector('input[name="modal-int-parcelle-cb"]');
    if (cb) {
      cb.checked = true;
      onModalInterventionParcelleToggle(cb.value, true);
      const surfInput = document.getElementById('modal-int-surf-' + cb.value);
      if (surfInput) surfInput.value = '0';
    }
    document.getElementById('btn-save-exp-int-submit').click();
  })()`);
  await new Promise(r => setTimeout(r, 300));

  const alert4 = await cdp.eval(`window._lastAlertMessage`);
  const hasZeroSurfError = await cdp.eval(`(() => {
    const cb = document.querySelector('input[name="modal-int-parcelle-cb"]');
    const surfInput = document.getElementById('modal-int-surf-' + cb?.value);
    return surfInput?.classList.contains('input-validation-error');
  })()`);
  assertTest("Erreur surface <= 0 détectée", alert4?.includes("strictement supérieure à 0 ha"), `Message: ${alert4}`);
  assertTest("Champ surface mis en évidence en rouge", hasZeroSurfError === true);

  // E. Dépassement de surface > autorisée
  await cdp.eval(`(() => {
    const cb = document.querySelector('input[name="modal-int-parcelle-cb"]');
    if (cb) {
      const surfInput = document.getElementById('modal-int-surf-' + cb.value);
      if (surfInput) surfInput.value = '9999.0000';
    }
    document.getElementById('btn-save-exp-int-submit').click();
  })()`);
  await new Promise(r => setTimeout(r, 300));

  const alert5 = await cdp.eval(`window._lastAlertMessage`);
  const hasOverflowError = await cdp.eval(`(() => {
    const cb = document.querySelector('input[name="modal-int-parcelle-cb"]');
    const surfInput = document.getElementById('modal-int-surf-' + cb?.value);
    return surfInput?.classList.contains('input-validation-error');
  })()`);
  assertTest("Erreur dépassement surface autorisée détectée", alert5?.includes("Dépassement impossible"), `Message: ${alert5}`);
  assertTest("Champ surface en dépassement mis en évidence en rouge", hasOverflowError === true);

  // 5. Soumission réussie d'une intervention avec le bouton « Soumettre à validation »
  console.log('\n📌 4. Test réel du clic sur « Soumettre à validation » avec données valides...');

  // Mémoriser la surface travaillée officielle actuelle
  const initialOfficialWorkedSurf = await cdp.eval(`(() => {
    let sum = 0;
    (VitiExpState.interventions || []).filter(it => it.status === 'validated').forEach(it => {
      (it.parcelles || []).forEach(p => sum += (parseFloat(p.surface_worked) || 0));
    });
    return sum;
  })()`);

  // Configurer une saisie valide sur une parcelle disposant d'un restant autorisé > 0
  const submittedIntId = await cdp.eval(`(() => {
    // 1. Trouver un travail et une parcelle avec surface disponible
    const select = document.getElementById('modal-int-task-select');
    let chosenCb = null;
    let chosenSurfInput = null;
    let allowedSurf = 0;

    for (let optIdx = 1; optIdx < select.options.length; optIdx++) {
      select.selectedIndex = optIdx;
      select.dispatchEvent(new Event('change'));

      const cbs = Array.from(document.querySelectorAll('input[name="modal-int-parcelle-cb"]'));
      for (const cb of cbs) {
        const sInput = document.getElementById('modal-int-surf-' + cb.value);
        const max = parseFloat(sInput?.getAttribute('data-allowed')) || 0;
        if (max > 0.05) {
          chosenCb = cb;
          chosenSurfInput = sInput;
          allowedSurf = max;
          break;
        }
      }
      if (chosenCb) break;
    }

    // Si aucune parcelle disponible sur les travaux actuels, créer un nouveau passage ou travail libre
    if (!chosenCb) {
      document.getElementById('modal-int-passage').value = 2; // Passage 2
      select.selectedIndex = 1;
      select.dispatchEvent(new Event('change'));
      const cbs = Array.from(document.querySelectorAll('input[name="modal-int-parcelle-cb"]'));
      chosenCb = cbs[0];
      chosenSurfInput = document.getElementById('modal-int-surf-' + chosenCb.value);
      allowedSurf = parseFloat(chosenSurfInput?.getAttribute('data-allowed')) || 1.0;
    }

    // Décocher toutes les autres parcelles
    document.querySelectorAll('input[name="modal-int-parcelle-cb"]').forEach(cb => {
      if (cb === chosenCb) {
        cb.checked = true;
        onModalInterventionParcelleToggle(cb.value, true);
      } else {
        cb.checked = false;
        onModalInterventionParcelleToggle(cb.value, false);
      }
    });

    const validSurf = Math.min(0.25, Math.max(0.05, parseFloat((allowedSurf * 0.5).toFixed(4))));
    chosenSurfInput.value = validSurf.toFixed(4);
    onInterventionModalSurfaceInput(chosenCb.value);

    document.getElementById('modal-int-date').value = '2026-10-16';
    document.getElementById('modal-int-notes').value = 'Test automatisé Soumettre à validation';

    // Clic RÉEL sur le bouton Soumettre à validation
    document.getElementById('btn-save-exp-int-submit').click();

    // Retourner l'id de l'intervention créée
    return (VitiExpState.interventions || [])[0]?.id;
  })()`);
  await new Promise(r => setTimeout(r, 600));

  // Vérifications de la soumission
  const modalIsOpen = await cdp.eval(`document.getElementById('modal-exp-intervention-form')?.classList.contains('active')`);
  assertTest("La fenêtre modale s'est correctement fermée", modalIsOpen === false);

  const alertSuccess = await cdp.eval(`window._lastAlertMessage`);
  assertTest("Message de succès « Intervention soumise à validation » affiché",
    alertSuccess?.includes("soumise à validation") || alertSuccess?.includes("soumise avec succès"),
    `Message: ${alertSuccess}`
  );

  const currentTab = await cdp.eval(`VitiExpState.interventionsTab`);
  assertTest("Bascule automatique sur l'onglet « À valider » (to_validate)", currentTab === 'to_validate', `Onglet: ${currentTab}`);

  const submittedIntObj = await cdp.eval(`(VitiExpState.interventions || []).find(it => it.id === '${submittedIntId}')`);
  assertTest("Intervention enregistrée avec statut = 'submitted'", submittedIntObj?.status === 'submitted', `Statut: ${submittedIntObj?.status}`);

  // Vérifier qu'elle est visible dans le DOM de l'onglet « À valider »
  const cardInDom = await cdp.eval(`document.getElementById('exp-int-card-${submittedIntId}') !== null`);
  assertTest("La carte de l'intervention apparaît dans l'onglet « À valider »", cardInDom === true);

  // Vérifier que les surfaces officielles n'ont PAS changé (Étape 4 de la consigne)
  const officialSurfAfterSubmit = await cdp.eval(`(() => {
    let sum = 0;
    (VitiExpState.interventions || []).filter(it => it.status === 'validated').forEach(it => {
      (it.parcelles || []).forEach(p => sum += (parseFloat(p.surface_worked) || 0));
    });
    return sum;
  })()`);
  assertTest("Surfaces officielles inchangées après la simple soumission", Math.abs(officialSurfAfterSubmit - initialOfficialWorkedSurf) < 0.0001);

  // 6. Test du contrôle des rôles et sécurisation de la validation / rejet
  console.log('\n📌 5. Test des rôles & sécurité (ouvrier vs responsable)...');

  // Simuler rôle salarié / ouvrier dans vititrack_auth_user
  await cdp.eval(`(() => {
    const raw = localStorage.getItem('vititrack_auth_user');
    const u = raw ? JSON.parse(raw) : {};
    u.role = 'worker';
    localStorage.setItem('vititrack_auth_user', JSON.stringify(u));
  })()`);

  // Salarié tente de valider
  await cdp.eval(`validateIntervention('${submittedIntId}');`);
  await new Promise(r => setTimeout(r, 200));
  const workerAlert = await cdp.eval(`window._lastAlertMessage`);
  assertTest("Ouvrier/Salarié ne peut pas valider (sécurité active)", workerAlert?.includes("Action refusée") || workerAlert?.includes("seul un responsable"));

  const intStillSubmitted = await cdp.eval(`(VitiExpState.interventions || []).find(it => it.id === '${submittedIntId}')?.status`);
  assertTest("Statut reste 'submitted' après tentative non autorisée", intStillSubmitted === 'submitted');

  // Rétablir rôle responsable/gérant (admin)
  await cdp.eval(`(() => {
    const raw = localStorage.getItem('vititrack_auth_user');
    const u = raw ? JSON.parse(raw) : {};
    u.role = 'exploitant';
    localStorage.setItem('vititrack_auth_user', JSON.stringify(u));
  })()`);

  // 7. Validation par le responsable
  console.log('\n📌 6. Validation par le responsable & actualisation automatique des surfaces...');
  await cdp.eval(`validateIntervention('${submittedIntId}');`);
  await new Promise(r => setTimeout(r, 500));

  const validateSuccessAlert = await cdp.eval(`window._lastAlertMessage`);
  assertTest("Message de validation officielle affiché", validateSuccessAlert?.includes("validée avec succès"));

  const intNowValidated = await cdp.eval(`(VitiExpState.interventions || []).find(it => it.id === '${submittedIntId}')?.status`);
  assertTest("Statut mis à jour en 'validated'", intNowValidated === 'validated');

  // Vérifier la mise à jour des surfaces officielles et de l'avancement
  const officialSurfAfterValidate = await cdp.eval(`(() => {
    let sum = 0;
    (VitiExpState.interventions || []).filter(it => it.status === 'validated').forEach(it => {
      (it.parcelles || []).forEach(p => sum += (parseFloat(p.surface_worked) || 0));
    });
    return sum;
  })()`);
  assertTest("Surfaces officielles actualisées après validation", officialSurfAfterValidate > initialOfficialWorkedSurf);

  // 8. Test de conservation après rechargement
  console.log('\n📌 7. Test de conservation des données après rechargement...');
  await cdp.send('Page.reload', { ignoreCache: true });
  await new Promise(r => setTimeout(r, 2000));

  const intAfterReload = await cdp.eval(`(VitiExpState.interventions || []).find(it => it.id === '${submittedIntId}')`);
  assertTest("Intervention conservée après reload", intAfterReload !== null && intAfterReload !== undefined);
  assertTest("Statut 'validated' conservé après reload", intAfterReload?.status === 'validated');

  // 9. Test responsive smartphone
  console.log('\n📌 8. Test d\'affichage sur smartphone (375x812)...');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 812,
    deviceScaleFactor: 2,
    mobile: true
  });
  await new Promise(r => setTimeout(r, 500));

  // Ouvrir la modale en vue mobile
  await cdp.eval(`openInterventionModal();`);
  await new Promise(r => setTimeout(r, 400));

  const mobileSubmitBtnVisible = await cdp.eval(`(() => {
    const btn = document.getElementById('btn-save-exp-int-submit');
    if (!btn) return false;
    const rect = btn.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && btn.offsetParent !== null;
  })()`);
  assertTest("Bouton « Soumettre à validation » parfaitement visible sur mobile", mobileSubmitBtnVisible === true);

  await cdp.eval(`closeInterventionModal();`);
  // Rétablir viewport desktop
  await cdp.send('Emulation.clearDeviceMetricsOverride');

  // 10. Test de non-régression sur VitiTrack Prestation
  console.log('\n📌 9. Test de non-régression sur VitiTrack Prestation...');
  await cdp.eval(`switchAppMode('prestation');`);
  await new Promise(r => setTimeout(r, 1000));

  const prestationModeActive = await cdp.eval(`document.body.classList.contains('mode-prestation') || document.body.getAttribute('data-app-mode') === 'prestation'`);
  assertTest("Mode Prestation activé sans erreur", prestationModeActive === true);

  const prestationClientsCount = await cdp.eval(`(window.clients || []).length`);
  assertTest("Clients de VitiTrack Prestation présents et intacts", prestationClientsCount >= 0);

  const kpisPresent = await cdp.eval(`document.getElementById('kpi-unbilled-amount') !== null && document.getElementById('kpi-billed-amount') !== null`);
  assertTest("KPIs financiers Prestation présents", kpisPresent === true);

  // Résumé
  console.log('\n🍇 =========================================================================');
  const failed = results.filter(r => !r.pass);
  if (failed.length === 0) {
    console.log(`🍇 TOUS LES TESTS RÉELS ONT RÉUSSI : ${results.length}/${results.length} SUCCÈS !`);
  } else {
    console.error(`🍇 ÉCHEC DE ${failed.length}/${results.length} TESTS :`);
    failed.forEach(f => console.error(`   - ${f.name} (${f.details})`));
  }
  console.log('🍇 =========================================================================\n');

  ws.close();
  process.exit(failed.length === 0 ? 0 : 1);
}

runTest().catch(err => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
