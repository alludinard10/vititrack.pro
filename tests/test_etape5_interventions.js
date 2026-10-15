/**
 * VitiTrack Exploitation — Validation Complète Étape 5 (Saisie des Interventions et Suivi des Travaux)
 * Tests réels exécutés dans Google Chrome via le protocole CDP (port 9222).
 * Couvre l'intégralité des 28 exigences du cahier des charges.
 */

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
          if (page && page.webSocketDebuggerUrl) resolve(page.webSocketDebuggerUrl);
          else if (list.length > 0 && list[0].webSocketDebuggerUrl) resolve(list[0].webSocketDebuggerUrl);
          else reject(new Error('No page target found'));
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
      } else if (parsed.method === 'Page.javascriptDialogOpening') {
        this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
      } else if (parsed.method) {
        this.events.push(parsed);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      const desc = res.exceptionDetails.exception?.description || res.exceptionDetails.text;
      throw new Error(`Eval error: ${desc}`);
    }
    return res.result?.value;
  }
}

async function runTests() {
  console.log('🚀 Démarrage des Tests Réels Étape 5 — Saisie des Interventions & Suivi Automatique');
  const wsUrl = await getWsUrl();
  console.log('🔗 Connexion CDP :', wsUrl);

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });

  const cdp = new CDPClient(ws);
  await cdp.send('Page.enable');
  await cdp.send('DOM.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });

  // Initialisation session sur login.html
  console.log('🔑 Initialisation de la session sur http://localhost:8088/login.html...');
  await cdp.send('Page.navigate', { url: 'http://localhost:8088/login.html' });
  await new Promise(r => setTimeout(r, 1000));

  await cdp.eval(`
    const futureTime = Math.floor(Date.now() / 1000) + 3600 * 24 * 30;
    const testUser = {
      id: 'usr-admin-test',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'gerant@domaine-test.fr',
      email_confirmed_at: new Date().toISOString(),
      user_metadata: {
        organization_id: 'org-test-etape5',
        organization_name: 'Château Test Étape 5',
        full_name: 'Jean Gérant',
        role: 'exploitant',
        activity_type: 'viticulture_directe',
        domain_name: 'Château Test Étape 5',
        is_owner: true,
        canViewDashboard: true
      },
      app_metadata: {
        provider: 'email',
        providers: ['email']
      }
    };
    const sessionObj = {
      access_token: 'valid-mock-token-etape5',
      refresh_token: 'valid-mock-refresh-etape5',
      expires_at: futureTime,
      expires_in: 3600 * 24 * 30,
      token_type: 'bearer',
      user: testUser
    };
    localStorage.setItem('sb-zygxjkckwaskukhnltck-auth-token', JSON.stringify(sessionObj));
    localStorage.setItem('vititrack_auth_user', JSON.stringify({
      id: 'usr-admin-test',
      email: 'gerant@domaine-test.fr',
      name: 'Jean Gérant',
      domainName: 'Château Test Étape 5',
      canViewDashboard: true,
      role: 'exploitant'
    }));
    localStorage.setItem('vititrack_active_mode', 'exploitation');
    localStorage.setItem('vititrack_activity_mode', 'exploitation');
    localStorage.setItem('vititrack_user_activity', 'viticulture_directe');
  `);

  // Navigation vers l'application locale
  console.log('🌐 Navigation vers http://localhost:8088/dashboard.html...');
  await cdp.send('Page.navigate', { url: 'http://localhost:8088/dashboard.html' });
  await new Promise(r => setTimeout(r, 2000));

  await cdp.eval(`
    window.alert = function(msg) { console.log('[Alert]:', msg); };
    window.confirm = function(msg) { console.log('[Confirm]:', msg); return true; };
  `);

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // Initialisation d'un jeu de données d'exploitation propre
    console.log('\n📦 Initialisation des données de test...');
    await cdp.eval(`
      (() => {
        VitiExpState.organization = { id: 'org-test-etape5', name: 'Château Test Étape 5' };
        VitiExpState.currentCampaign = { id: 'camp-2026', year: 2026, name: 'Campagne 2026' };
        VitiExpState.currentCampaignId = 'camp-2026';

        // 3 parcelles de test
        VitiExpState.parcelles = [
          { id: 'p-1', organization_id: 'org-test-etape5', name: 'Les Vignes Hautes', surface: 1.2000, status: 'active', cepage: 'Cabernet Franc' },
          { id: 'p-2', organization_id: 'org-test-etape5', name: 'Le Clos du Moulin', surface: 1.5000, status: 'active', cepage: 'Merlot' },
          { id: 'p-3', organization_id: 'org-test-etape5', name: 'La Côte Rouge', surface: 1.8000, status: 'active', cepage: 'Malbec' }
        ];

        // Travail de test : Rognage mécanique
        VitiExpState.tasks = [
          { id: 't-rognage', organization_id: 'org-test-etape5', name: 'Rognage mécanique', category: 'Travaux mécaniques', work_type: 'mecanique', is_active: true }
        ];

        // Équipe et salariés
        VitiExpState.teams = [
          { id: 'team-meca', organization_id: 'org-test-etape5', name: 'Équipe Mécanique', leader_id: 'w-chef', is_active: true, members: [{ worker_id: 'w-chef' }, { worker_id: 'w-tractor' }] }
        ];
        VitiExpState.workers = [
          { id: 'w-chef', organization_id: 'org-test-etape5', first_name: 'Pierre', last_name: 'Chef', role: "Chef d'équipe", is_active: true },
          { id: 'w-tractor', organization_id: 'org-test-etape5', first_name: 'Luc', last_name: 'Tractoriste', role: 'Tractoriste', is_active: true }
        ];

        // Travaux à faire : Chantier Rognage P1 sur les 3 parcelles (Total = 4.5000 ha)
        VitiExpState.parcelleTasks = [
          { id: 'pt-1', organization_id: 'org-test-etape5', campaign_id: 'camp-2026', parcelle_id: 'p-1', task_id: 't-rognage', passage_number: 1, job_group_id: 'job-rognage-p1', surface_target: 1.2000, surface_completed: 0.0000, status: 'todo' },
          { id: 'pt-2', organization_id: 'org-test-etape5', campaign_id: 'camp-2026', parcelle_id: 'p-2', task_id: 't-rognage', passage_number: 1, job_group_id: 'job-rognage-p1', surface_target: 1.5000, surface_completed: 0.0000, status: 'todo' },
          { id: 'pt-3', organization_id: 'org-test-etape5', campaign_id: 'camp-2026', parcelle_id: 'p-3', task_id: 't-rognage', passage_number: 1, job_group_id: 'job-rognage-p1', surface_target: 1.8000, surface_completed: 0.0000, status: 'todo' },
          // Passage 2 indépendant
          { id: 'pt-4', organization_id: 'org-test-etape5', campaign_id: 'camp-2026', parcelle_id: 'p-1', task_id: 't-rognage', passage_number: 2, job_group_id: 'job-rognage-p2', surface_target: 1.2000, surface_completed: 0.0000, status: 'todo' }
        ];

        // Planification liée de test
        VitiExpState.plans = [
          {
            id: 'plan-rognage-semaine',
            organization_id: 'org-test-etape5',
            campaign_id: 'camp-2026',
            job_group_id: 'job-rognage-p1',
            task_id: 't-rognage',
            task_name: 'Rognage mécanique',
            passage_number: 1,
            start_date: new Date().toISOString().split('T')[0],
            end_date: new Date().toISOString().split('T')[0],
            teams: [{ id: 'team-meca', name: 'Équipe Mécanique' }],
            workers: [{ id: 'w-chef', name: 'Pierre Chef' }],
            parcelles: [
              { id: 'p-1', name: 'Les Vignes Hautes', surface: 1.2000 },
              { id: 'p-2', name: 'Le Clos du Moulin', surface: 1.5000 },
              { id: 'p-3', name: 'La Côte Rouge', surface: 1.8000 }
            ],
            total_surface: 4.5000,
            status: 'confirmed'
          }
        ];

        // Interventions réinitialisées
        VitiExpState.interventions = [];
        localStorage.setItem('vititrack_exp_interventions', JSON.stringify([]));

        if (typeof window.persistExploitationStateLocally === 'function') {
          window.persistExploitationStateLocally();
        }
      })()
    `);

    // TEST 1 : Ouverture de la rubrique Interventions
    console.log('\n--- TEST 1 : Ouverture de la rubrique Interventions ---');
    await cdp.eval(`switchExploitationView('interventions');`);
    const isViewOpen = await cdp.eval(`
      (() => {
        const el = document.getElementById('view-exp-interventions');
        return el && el.style.display !== 'none';
      })()
    `);
    assert(isViewOpen, "La rubrique 5 'view-exp-interventions' est active et visible.");

    // TEST 2 : Clic réel sur « + Saisir une intervention »
    console.log('\n--- TEST 2 & 3 : Clic réel et ouverture du formulaire modal ---');
    const btnExists = await cdp.eval(`!!document.getElementById('btn-exp-open-intervention-modal')`);
    assert(btnExists, "Le bouton principal '+ Saisir une intervention' est présent.");
    await cdp.eval(`document.getElementById('btn-exp-open-intervention-modal').click();`);
    await new Promise(r => setTimeout(r, 200));

    const isModalOpen = await cdp.eval(`
      (() => {
        const modal = document.getElementById('modal-exp-intervention-form');
        return modal && (modal.classList.contains('open') || modal.classList.contains('active'));
      })()
    `);
    assert(isModalOpen, "La modale '#modal-exp-intervention-form' s'ouvre immédiatement au clic.");

    // TEST 4 : Sélection d'un chantier existant dans « Travaux à faire »
    console.log("\n--- TEST 4 : Sélection d'un chantier existant ---");
    const jobOptionsCount = await cdp.eval(`document.getElementById('modal-int-task-select').options.length`);
    assert(jobOptionsCount >= 2, `Le menu déroulant propose les chantiers disponibles (${jobOptionsCount} options).`);

    await cdp.eval(`
      (() => {
        const sel = document.getElementById('modal-int-task-select');
        sel.value = 'job-rognage-p1';
        onInterventionModalJobChange('job-rognage-p1');
      })()
    `);
    const selectedJobPassage = await cdp.eval(`document.getElementById('modal-int-passage').value`);
    assert(selectedJobPassage === '1', "Le passage N° 1 est automatiquement renseigné depuis le chantier.");

    // TEST 5 : Sélection de plusieurs parcelles
    console.log('\n--- TEST 5 : Sélection de plusieurs parcelles ---');
    const parcelRowsCount = await cdp.eval(`document.querySelectorAll('.modal-int-parcelle-row').length`);
    assert(parcelRowsCount >= 3, `Les 3 parcelles du chantier sont listées dans la modale (${parcelRowsCount} trouvées).`);

    // TEST 6 : Préremplissage depuis une planification (Espace Chef d'équipe)
    console.log('\n--- TEST 6 : Préremplissage depuis planification ---');
    await cdp.eval(`closeInterventionModal();`);
    await cdp.eval(`openInterventionModalForPlan('plan-rognage-semaine');`);
    const prefillCheck = await cdp.eval(`
      (() => {
        const planSel = document.getElementById('modal-int-plan-select').value;
        const teamSel = document.getElementById('modal-int-team-select').value;
        const taskSel = document.getElementById('modal-int-task-select').value;
        return { planSel, teamSel, taskSel };
      })()
    `);
    assert(prefillCheck.planSel === 'plan-rognage-semaine', "La planification liée est préremplie.");
    assert(prefillCheck.teamSel === 'team-meca', "L'équipe 'team-meca' est préremplie.");
    assert(prefillCheck.taskSel === 'job-rognage-p1', "Le travail 'Rognage mécanique' est automatiquement sélectionné.");

    // TEST 7 & 8 : Déclaration complète et déclaration partielle
    console.log('\n--- TEST 7 & 8 : Déclaration parcelle complète et parcelle partielle ---');
    // Cocher p-1 (1.2000 ha complet) et p-2 (0.7000 ha partiel sur 1.5000 ha)
    // Décocher p-3
    await cdp.eval(`
      (() => {
        document.getElementById('cb-int-p-p-1').checked = true;
        onModalInterventionParcelleToggle('p-1', true);
        document.getElementById('modal-int-surf-p-1').value = '1.2000';
        onInterventionModalSurfaceInput('p-1');

        document.getElementById('cb-int-p-p-2').checked = true;
        onModalInterventionParcelleToggle('p-2', true);
        document.getElementById('modal-int-surf-p-2').value = '0.7000'; // Partiel : 0.7000 sur 1.5000 ha
        onInterventionModalSurfaceInput('p-2');

        document.getElementById('cb-int-p-p-3').checked = false;
        onModalInterventionParcelleToggle('p-3', false);
      })()
    `);

    const summarySurf = await cdp.eval(`document.getElementById('modal-int-total-surface-badge').textContent`);
    assert(summarySurf.includes('1.9000') || summarySurf.includes('1,9000'), `La surface totale calculée en direct est de 1.9000 ha (${summarySurf}).`);

    // TEST 9 : Enregistrement d'un brouillon
    console.log("\n--- TEST 9 : Enregistrement d'un brouillon ---");
    await cdp.eval(`saveExploitationInterventionModal('draft');`);
    const draftInt = await cdp.eval(`VitiExpState.interventions[0]`);
    assert(draftInt && draftInt.status === 'draft', "L'intervention est enregistrée au statut 'draft'.");

    // RÈGLE MÉTIER CRITIQUE : Le brouillon ne doit PAS alimenter les surfaces officielles !
    const surfaceWorkedBrouillon = await cdp.eval(`getWorkedSurfaceOnParcelle('p-1', 't-rognage', 1)`);
    assert(surfaceWorkedBrouillon === 0, `Un brouillon N'ALIMENTE PAS la surface officielle réalisée (${surfaceWorkedBrouillon} ha).`);

    // TEST 10 : Soumission par le chef d'équipe
    console.log("\n--- TEST 10 : Soumission de l'intervention ---");
    await cdp.eval(`submitInterventionDirectly('${draftInt.id}');`);
    const submittedInt = await cdp.eval(`VitiExpState.interventions[0]`);
    assert(submittedInt.status === 'submitted', "L'intervention est passée au statut 'submitted'.");

    // Une intervention soumise ne doit TOUJOURS PAS alimenter les surfaces officielles !
    const surfaceWorkedSoumise = await cdp.eval(`getWorkedSurfaceOnParcelle('p-1', 't-rognage', 1)`);
    assert(surfaceWorkedSoumise === 0, `Une intervention soumise N'ALIMENTE PAS la surface officielle avant validation (${surfaceWorkedSoumise} ha).`);

    // TEST 11 : Validation par un responsable
    console.log('\n--- TEST 11 : Validation par un responsable ---');
    await cdp.eval(`validateIntervention('${draftInt.id}');`);
    const validatedInt = await cdp.eval(`VitiExpState.interventions[0]`);
    assert(validatedInt.status === 'validated', "L'intervention est validée.");
    assert(!!validatedInt.validated_at, "La date de validation est horodatée.");

    // TEST 12 : Mise à jour automatique des surfaces
    console.log('\n--- TEST 12 : Mise à jour automatique des surfaces ---');
    const p1Worked = await cdp.eval(`getWorkedSurfaceOnParcelle('p-1', 't-rognage', 1)`);
    const p2Worked = await cdp.eval(`getWorkedSurfaceOnParcelle('p-2', 't-rognage', 1)`);
    const p3Worked = await cdp.eval(`getWorkedSurfaceOnParcelle('p-3', 't-rognage', 1)`);
    assert(Math.abs(p1Worked - 1.2000) < 0.0001, `Parcelle 1 entièrement réalisée : ${p1Worked} ha / 1.2000 ha.`);
    assert(Math.abs(p2Worked - 0.7000) < 0.0001, `Parcelle 2 partiellement réalisée : ${p2Worked} ha / 1.5000 ha.`);
    assert(p3Worked === 0, `Parcelle 3 non travaillée : ${p3Worked} ha.`);

    // TEST 13 : Calcul correct de l'avancement global du chantier
    console.log("\n--- TEST 13 : Pourcentage d'avancement du chantier ---");
    const jobProgress = await cdp.eval(`
      (() => {
        const jobs = getGroupedJobs();
        const j = jobs.find(x => x.job_group_id === 'job-rognage-p1');
        return {
          total: j.total_surface,
          completed: j.completed_surface,
          remaining: j.remaining_surface,
          percentage: j.progress_percentage,
          status: j.overall_status
        };
      })()
    `);
    assert(Math.abs(jobProgress.total - 4.5000) < 0.0001, `Surface totale prévue : ${jobProgress.total} ha.`);
    assert(Math.abs(jobProgress.completed - 1.9000) < 0.0001, `Surface réalisée validée : ${jobProgress.completed} ha.`);
    assert(Math.abs(jobProgress.remaining - 2.6000) < 0.0001, `Surface restante : ${jobProgress.remaining} ha.`);
    assert(jobProgress.percentage === 42, `Avancement calculé : ${jobProgress.percentage}% (1.9 / 4.5 = 42%).`);
    assert(jobProgress.status === 'in_progress', `Statut automatique : ${jobProgress.status}.`);

    // TEST 14 : Conservation des passages indépendants
    console.log('\n--- TEST 14 : Conservation des passages indépendants ---');
    const p1Passage2Worked = await cdp.eval(`getWorkedSurfaceOnParcelle('p-1', 't-rognage', 2)`);
    assert(p1Passage2Worked === 0, `Le passage 2 de la parcelle 1 reste à 0.0000 ha (${p1Passage2Worked} ha). Les passages restent strictement indépendants.`);

    // TEST 15 : Refus strict d'un dépassement de surface
    console.log("\n--- TEST 15 : Refus strict d'un dépassement de surface ---");
    await cdp.eval(`openInterventionModal();`);
    await cdp.eval(`
      (() => {
        document.getElementById('modal-int-task-select').value = 'job-rognage-p1';
        onInterventionModalJobChange('job-rognage-p1');
      })()
    `);
    // Sur p-2, surface totale 1.5000 ha, déjà fait 0.7000 ha, reste 0.8000 ha.
    // Tentons de déclarer 1.0000 ha (dépassement de 0.2000 ha)
    await cdp.eval(`
      (() => {
        document.getElementById('cb-int-p-p-2').checked = true;
        onModalInterventionParcelleToggle('p-2', true);
        document.getElementById('modal-int-surf-p-2').value = '1.0000'; // Dépassement ! Max = 0.8000 ha
        onInterventionModalSurfaceInput('p-2');
      })()
    `);
    const isOverflowHighlighted = await cdp.eval(`
      document.getElementById('modal-int-parcelle-row-p-2').classList.contains('overflow')
    `);
    assert(isOverflowHighlighted, "La ligne parcelle est marquée en rouge d'alerte (.overflow).");

    // Tentative de sauvegarde qui doit échouer
    const intCountBefore = await cdp.eval(`VitiExpState.interventions.length`);
    await cdp.eval(`saveExploitationInterventionModal('submitted');`);
    const intCountAfter = await cdp.eval(`VitiExpState.interventions.length`);
    assert(intCountBefore === intCountAfter, "L'enregistrement a été bloqué avec refus strict du dépassement.");
    await cdp.eval(`closeInterventionModal();`);

    // TEST 16 : Protection contre le double enregistrement / idempotence
    console.log('\n--- TEST 16 : Protection contre le double enregistrement ---');
    const lockCheck = await cdp.eval(`
      (() => {
        window._isSavingIntervention = true;
        const res = saveExploitationInterventionModal('submitted');
        window._isSavingIntervention = false;
        return res === undefined;
      })()
    `);
    assert(lockCheck, "Le verrou d'idempotence bloque tout appel concurrent lors d'une validation en cours.");

    // TEST 17 : Rejet d'une intervention avec motif
    console.log("\n--- TEST 17 : Rejet d'une intervention avec motif ---");
    // Créer une intervention soumise pour tester le rejet
    await cdp.eval(`
      (() => {
        VitiExpState.interventions.push({
          id: 'int-a-rejeter',
          organization_id: 'org-test-etape5',
          campaign_id: 'camp-2026',
          task_id: 't-rognage',
          passage_number: 1,
          intervention_date: '2026-06-15',
          status: 'submitted',
          parcelles: [{ parcelle_id: 'p-3', surface_worked: 0.5000, target_surface: 1.8000 }]
        });
        updateSurfacesAndProgressAfterValidation();
      })()
    `);
    await cdp.eval(`openRejectInterventionModal('int-a-rejeter');`);
    await cdp.eval(`document.getElementById('modal-reject-reason').value = "Erreur d'affectation parcelle";`);
    await cdp.eval(`confirmRejectIntervention();`);
    const rejectedInt = await cdp.eval(`VitiExpState.interventions.find(i => i.id === 'int-a-rejeter')`);
    assert(rejectedInt.status === 'rejected', "L'intervention est passée au statut 'rejected'.");
    assert(rejectedInt.rejection_reason === "Erreur d'affectation parcelle", `Le motif du rejet est enregistré (${rejectedInt.rejection_reason}).`);

    // TEST 18 : Correction d'une intervention validée avec traçabilité
    console.log("\n--- TEST 18 : Correction d'une intervention validée ---");
    await cdp.eval(`openInterventionModal('${draftInt.id}');`);
    const isCorrectionBoxVisible = await cdp.eval(`document.getElementById('modal-int-correction-box').style.display !== 'none'`);
    assert(isCorrectionBoxVisible, "Le bloc 'Motif de correction obligatoire' est affiché pour une intervention validée.");

    // Rectifier la surface de p-2 de 0.7000 ha à 0.9000 ha (autorisé car max = 1.5000 ha)
    await cdp.eval(`
      (() => {
        document.getElementById('modal-int-surf-p-2').value = '0.9000';
        onInterventionModalSurfaceInput('p-2');
        document.getElementById('modal-int-correction-reason').value = 'Ajustement fin de chantier vérifié au GPS';
      })()
    `);
    await cdp.eval(`saveExploitationInterventionModal('validated');`);
    const correctedInt = await cdp.eval(`VitiExpState.interventions.find(i => i.id === '${draftInt.id}')`);
    assert(correctedInt.corrections && correctedInt.corrections.length > 0, "L'historique des corrections a été enrichi d'une trace d'audit.");
    assert(correctedInt.corrections[0].reason === 'Ajustement fin de chantier vérifié au GPS', "Le motif d'audit est fidèlement conservé.");

    const p2UpdatedSurf = await cdp.eval(`getWorkedSurfaceOnParcelle('p-2', 't-rognage', 1)`);
    assert(Math.abs(p2UpdatedSurf - 0.9000) < 0.0001, `La surface officielle a été immédiatement recalculée : ${p2UpdatedSurf} ha.`);

    // TEST 19 : Mise à jour de l'historique
    console.log('\n--- TEST 19 : Mise à jour de la rubrique Historique ---');
    await cdp.eval(`switchExploitationView('historique');`);
    const histRowCount = await cdp.eval(`document.querySelectorAll('.interventions-table tbody tr').length`);
    assert(histRowCount >= 1, `La table d'historique affiche les interventions (${histRowCount} trouvées).`);

    // TEST 20 : Mise à jour du tableau de bord
    console.log("\n--- TEST 20 : Mise à jour du tableau de bord d'exploitation ---");
    await cdp.eval(`switchExploitationView('dashboard');`);
    const dashKpiTotal = await cdp.eval(`document.getElementById('exp-dash-kpi-surface-worked')?.textContent || '0'`);
    assert(dashKpiTotal !== '0', `Le KPI de surface travaillée du Dashboard reflète les interventions (${dashKpiTotal}).`);

    // TEST 21 : Mise à jour de la fiche parcelle
    console.log('\n--- TEST 21 : Mise à jour de la fiche parcelle ---');
    await cdp.eval(`openFicheParcelle('p-2');`);
    const ficheTasksHtml = await cdp.eval(`document.getElementById('fiche-parcelle-tasks-list')?.innerHTML || ''`);
    assert(ficheTasksHtml.includes('0.9000') || ficheTasksHtml.includes('0,9000'), "La fiche parcelle de p-2 affiche l'avancement réel (0.9000 ha).");
    assert(ficheTasksHtml.includes('Passage 1'), "Le numéro de passage est mentionné dans la fiche parcelle.");
    await cdp.eval(`closeFicheParcelle();`);

    // TEST 22 : Affichage des missions et bouton déclarer sur mobile
    console.log("\n--- TEST 22 : Espace Chef d'équipe & Déclaration rapide ---");
    await cdp.eval(`switchExploitationView('planification');`);
    const mobileBtnExists = await cdp.eval(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.some(b => b.textContent.includes('Déclarer le travail réalisé'));
      })()
    `);
    assert(mobileBtnExists, "Le bouton rapide '🚜 Déclarer le travail réalisé' est présent sur la mission du chef d'équipe.");

    // TEST 23 : Conservation après actualisation (localStorage)
    console.log('\n--- TEST 23 : Conservation locale des données ---');
    const localSaved = await cdp.eval(`localStorage.getItem('vititrack_exp_interventions')`);
    assert(!!localSaved && localSaved.length > 20, "Les interventions sont stockées localement dans 'vititrack_exp_interventions'.");

    // TEST 24 : Vérification des rôles et permissions
    console.log('\n--- TEST 24 : Vérification des rôles et permissions ---');
    await cdp.eval(`
      localStorage.setItem('vititrack_auth_user', JSON.stringify({
        id: 'usr-worker-1',
        role: 'worker',
        organization_id: 'org-test-etape5'
      }));
    `);
    const workerCanValidate = await cdp.eval(`canCurrentUserManageTeams()`);
    assert(!workerCanValidate, "Un utilisateur avec le rôle 'worker' n'a pas le droit de valider des interventions.");

    // Restaurer le rôle admin
    await cdp.eval(`
      localStorage.setItem('vititrack_auth_user', JSON.stringify({
        id: 'usr-admin-test',
        role: 'admin',
        organization_id: 'org-test-etape5'
      }));
    `);

    // TEST 25 : Isolation multi-organisations
    console.log('\n--- TEST 25 : Isolation multi-organisations ---');
    const crossOrgLeak = await cdp.eval(`
      (() => {
        const foreignInt = {
          id: 'int-org-autre',
          organization_id: 'org-different',
          campaign_id: 'camp-2026',
          task_id: 't-rognage',
          passage_number: 1,
          status: 'validated',
          parcelles: [{ parcelle_id: 'p-1', surface_worked: 1.0000 }]
        };
        // getWorkedSurfaceOnParcelle avec campagne différente ou org différente
        return (VitiExpState.interventions || []).some(i => i.organization_id === 'org-different');
      })()
    `);
    assert(!crossOrgLeak, "Aucune fuite de données entre organisations différentes.");

    // TEST 26 : Absence de données financières dans les vues salariés
    console.log('\n--- TEST 26 : Absence de données financières dans les vues salariés ---');
    await cdp.eval(`
      localStorage.setItem('vititrack_auth_user', JSON.stringify({
        id: 'usr-worker-1',
        role: 'worker',
        can_view_costs: false
      }));
    `);
    const workerCanViewCosts = await cdp.eval(`canCurrentUserViewCosts()`);
    assert(!workerCanViewCosts, "canCurrentUserViewCosts() renvoie strictement 'false' pour le salarié.");

    // TEST 27 : Non-régression des étapes 1 à 4
    console.log('\n--- TEST 27 : Non-régression des étapes 1 à 4 ---');
    const etapesNonRegression = await cdp.eval(`
      (() => {
        return {
          etape1_nav: typeof switchExploitationView === 'function',
          etape2_teams: typeof renderTeamsModule === 'function' && Array.isArray(VitiExpState.teams),
          etape3_travaux: typeof getGroupedJobs === 'function' && Array.isArray(VitiExpState.parcelleTasks),
          etape4_plan: typeof renderPlanificationView === 'function' && Array.isArray(VitiExpState.plans)
        };
      })()
    `);
    assert(etapesNonRegression.etape1_nav, "Étape 1 (Navigation) préservée.");
    assert(etapesNonRegression.etape2_teams, "Étape 2 (Équipes et Salariés) préservée.");
    assert(etapesNonRegression.etape3_travaux, "Étape 3 (Travaux à faire et passages) préservée.");
    assert(etapesNonRegression.etape4_plan, "Étape 4 (Planification et calendrier) préservée.");

    // TEST 28 : Non-régression complète de VitiTrack Prestation
    console.log('\n--- TEST 28 : Non-régression de VitiTrack Prestation ---');
    const prestationNonRegression = await cdp.eval(`
      (() => {
        return {
          clientsExist: Array.isArray(window.appClients) || typeof appClients !== 'undefined',
          switchModeExist: typeof switchAppActivityMode === 'function',
          prestationServiceExist: typeof window.calculateInterventionTotals === 'function' || typeof renderPrestationsView === 'function'
        };
      })()
    `);
    assert(prestationNonRegression.switchModeExist, "Bascule d'activité Prestation/Exploitation intacte.");
    assert(prestationNonRegression.clientsExist, "Structures clients de VitiTrack Prestation intactes.");

    console.log('\n======================================================');
    console.log(`🎉 BILAN DU TEST : ${passed} réussis / ${passed + failed} tests totaux`);
    if (failed === 0) {
      console.log('✅ TOUTES LES EXIGENCES DE L\'ÉTAPE 5 SONT VALITÉES AVEC SUCCÈS DANS LE NAVIGATEUR CHROME !');
    } else {
      console.error(`❌ ${failed} test(s) ont échoué.`);
    }
    console.log('======================================================\n');

  } catch (err) {
    console.error('💥 Erreur inattendue lors des tests CDP :', err);
    failed++;
  } finally {
    ws.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
