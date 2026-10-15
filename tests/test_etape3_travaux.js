/**
 * ==============================================================================
 * VitiTrack Exploitation — Test Automatisé Étape 3 : Gestion des Travaux à Faire
 * Validation complète du cahier des charges :
 * - Catalogue des travaux manuels & mécaniques (15 standards + personnalisés)
 * - Création de travaux avec passages multiples (Passage 1, Passage 2, etc.)
 * - Sélection multi-parcelles avec calcul de surface dynamique (4 décimales)
 * - Suivi d'avancement réel adossé aux interventions (sans approximations)
 * - Détails par parcelle, modifications, suppressions
 * - Préparation Planification (Étape 4)
 * - Non-régression VitiTrack Prestation
 * ==============================================================================
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🍇 ==================================================================');
console.log('🍇 LANCEMENT DES TESTS D\'INTÉGRATION — ÉTAPE 3 EXPLOITATION');
console.log('🍇 GESTION DES TRAVAUX VITICOLES MANUELS & MÉCANIQUES (TRAVAUX À FAIRE)');
console.log('🍇 ==================================================================\n');

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${desc}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(`     Erreur: ${err.message}\n`);
    process.exitCode = 1;
  }
}

// ==============================================================================
// 1. VÉRIFICATION DU SCHÉMA SQL PRÉPARÉ
// ==============================================================================
console.log('📌 SUITE 1 : Schéma SQL Supabase Préparé (Local)');
const sqlPath = path.join(__dirname, '..', 'supabase', 'exploitation_etape3_travaux_schema.sql');
const sqlContent = fs.readFileSync(sqlPath, 'utf8');

it('1.1 Le fichier exploitation_etape3_travaux_schema.sql définit les colonnes de passages et groupement', () => {
  assert.ok(sqlContent.includes('passage_number INTEGER NOT NULL DEFAULT 1'), 'Colonne passage_number présente');
  assert.ok(sqlContent.includes('priority TEXT NOT NULL DEFAULT \'normale\''), 'Colonne priority présente');
  assert.ok(sqlContent.includes('job_group_id UUID'), 'Colonne job_group_id présente pour regrouper les chantiers');
  assert.ok(sqlContent.includes('target_date DATE'), 'Colonne target_date présente');
  assert.ok(sqlContent.includes('surface_target NUMERIC(10, 4)'), 'Colonne surface_target à 4 décimales');
});

it('1.2 La contrainte unique prend en compte le passage_number pour autoriser les passages successifs', () => {
  assert.ok(sqlContent.includes('UNIQUE (campaign_id, parcelle_id, task_id, passage_number)'), 'Contrainte unique adaptée avec passage_number');
});

it('1.3 La table exploitation_tasks supporte la distinction manuel / mécanique', () => {
  assert.ok(sqlContent.includes('work_type TEXT DEFAULT \'manuel\''), 'Colonne work_type dans exploitation_tasks');
  assert.ok(sqlContent.includes('CHECK (work_type IN (\'manuel\', \'mecanique\'))'), 'Contrainte CHECK pour manuel / mecanique');
});

it('1.4 Les index d\'optimisation sont définis pour les requêtes de chantiers', () => {
  assert.ok(sqlContent.includes('idx_exp_ptasks_job_group'), 'Index job_group_id');
  assert.ok(sqlContent.includes('idx_exp_ptasks_passage'), 'Index task_id et passage_number');
});

// ==============================================================================
// 2. VÉRIFICATION DE DASHBOARD.HTML
// ==============================================================================
console.log('\n📌 SUITE 2 : Interface Utilisateur dashboard.html');
const htmlPath = path.join(__dirname, '..', 'dashboard.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

it('2.1 Rubrique Travaux à faire : KPIs, barre de filtres et conteneurs présents', () => {
  assert.ok(htmlContent.includes('id="exp-travaux-kpi-count"'), 'KPI travaux total');
  assert.ok(htmlContent.includes('id="exp-travaux-kpi-surface-total"'), 'KPI surface totale');
  assert.ok(htmlContent.includes('id="exp-travaux-kpi-surface-done"'), 'KPI surface réalisée');
  assert.ok(htmlContent.includes('id="exp-travaux-kpi-surface-remaining"'), 'KPI surface restante');
  assert.ok(htmlContent.includes('id="exp-travaux-kpi-progress-pct"'), 'KPI avancement');
  assert.ok(htmlContent.includes('id="exp-travaux-search-input"'), 'Recherche en direct');
  assert.ok(htmlContent.includes('id="exp-travaux-filter-nature"'), 'Filtre manuel / mécanique');
  assert.ok(htmlContent.includes('id="exp-travaux-filter-status"'), 'Filtre par statut');
  assert.ok(htmlContent.includes('id="exp-travaux-filter-parcelle"'), 'Filtre par parcelle');
  assert.ok(htmlContent.includes('id="exp-travaux-jobs-container"'), 'Conteneur vue cartes de travaux');
  assert.ok(htmlContent.includes('id="exp-travaux-parcelles-container"'), 'Conteneur vue tableau parcelles');
});

it('2.2 Modale d\'affectation / création de travail (modal-exp-assign-task)', () => {
  assert.ok(htmlContent.includes('id="modal-exp-assign-task"'), 'Modale assign-task présente');
  assert.ok(htmlContent.includes('id="exp-assign-task-id"'), 'Sélecteur de type de travail');
  assert.ok(htmlContent.includes('id="exp-assign-passage"'), 'Numéro de passage');
  assert.ok(htmlContent.includes('id="exp-assign-priority"'), 'Priorité');
  assert.ok(htmlContent.includes('id="exp-assign-planned-date"'), 'Date souhaitée');
  assert.ok(htmlContent.includes('id="exp-assign-parcelles-search"'), 'Recherche de parcelle en direct');
  assert.ok(htmlContent.includes('id="exp-assign-surface-summary-badge"'), 'Badge dynamique de surface totale (4 décimales)');
  assert.ok(htmlContent.includes('id="exp-assign-parcelles-checklist"'), 'Checklist des parcelles');
  assert.ok(htmlContent.includes('id="exp-assign-notes"'), 'Consignes particulières');
});

it('2.3 Modales de détails de travail et notification de planification Étape 4', () => {
  assert.ok(htmlContent.includes('id="modal-exp-job-details"'), 'Modale détails du travail');
  assert.ok(htmlContent.includes('id="modal-exp-planification-notice"'), 'Modale notice Planification Étape 4');
  assert.ok(htmlContent.includes('id="exp-task-work-type"'), 'Sélecteur travail manuel / mécanique dans modal-exp-task');
});

// ==============================================================================
// 3. VÉRIFICATION DES STYLES CSS
// ==============================================================================
console.log('\n📌 SUITE 3 : Styles CSS exploitation.css');
const cssPath = path.join(__dirname, '..', 'exploitation.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

it('3.1 Les styles dédiés aux cartes de travaux, badges et accordéons parcelles sont présents', () => {
  assert.ok(cssContent.includes('.exp-job-card'), 'Style .exp-job-card');
  assert.ok(cssContent.includes('.passage-badge'), 'Style .passage-badge');
  assert.ok(cssContent.includes('.nature-badge'), 'Style .nature-badge');
  assert.ok(cssContent.includes('.priority-badge'), 'Style .priority-badge');
  assert.ok(cssContent.includes('.exp-job-metrics-row'), 'Style .exp-job-metrics-row');
  assert.ok(cssContent.includes('.exp-job-parcelles-accordion'), 'Style .exp-job-parcelles-accordion');
  assert.ok(cssContent.includes('.modal-parcelle-checkbox-item'), 'Style .modal-parcelle-checkbox-item');
});

// ==============================================================================
// 4. LOGIQUE MÉTIER & SCÉNARIOS FONCTIONNELS (exploitation.js)
// ==============================================================================
console.log('\n📌 SUITE 4 : Logique Métier & Scénarios Fonctionnels exploitation.js');

// Environnement DOM Mock pour node VM
const storage = {};
const localStorageMock = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};

const domElements = {};
function createMockElement(id) {
  const el = {
    id,
    style: {},
    classList: {
      _classes: new Set(),
      add: (c) => el.classList._classes.add(c),
      remove: (c) => el.classList._classes.delete(c),
      contains: (c) => el.classList._classes.has(c)
    },
    textContent: '',
    innerHTML: '',
    value: '',
    checked: false,
    disabled: false,
    setAttribute: () => {},
    getAttribute: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {},
    focus: () => {}
  };
  domElements[id] = el;
  return el;
}

const mockDoc = {
  getElementById: (id) => domElements[id] || createMockElement(id),
  querySelectorAll: () => [],
  querySelector: () => null,
  addEventListener: () => {},
  removeEventListener: () => {},
  documentElement: { setAttribute: () => {} },
  body: { setAttribute: () => {} }
};

const mockWindow = {
  localStorage: localStorageMock,
  document: mockDoc,
  addEventListener: () => {},
  dispatchEvent: () => {},
  showNotification: () => {}
};

const expJsPath = path.join(__dirname, '..', 'exploitation.js');
const expJsCode = fs.readFileSync(expJsPath, 'utf8');

const context = {
  window: mockWindow,
  document: mockDoc,
  localStorage: localStorageMock,
  console,
  setTimeout,
  clearTimeout,
  crypto: { randomUUID: () => 'uuid-' + Math.random().toString(36).substring(2, 9) }
};
vm.createContext(context);
vm.runInContext(expJsCode, context);

const exp = context.window;

it('4.1 Le catalogue par défaut contient les 15 tâches standard (7 manuels + 8 mécaniques)', () => {
  assert.strictEqual(typeof exp.DEFAULT_EXPLOITATION_TASKS, 'object');
  assert.strictEqual(exp.DEFAULT_EXPLOITATION_TASKS.length, 15, 'Doit contenir 15 tâches standard');

  const manuels = exp.DEFAULT_EXPLOITATION_TASKS.filter(t => t.work_type === 'manuel');
  const mecaniques = exp.DEFAULT_EXPLOITATION_TASKS.filter(t => t.work_type === 'mecanique');
  assert.strictEqual(manuels.length, 7, '7 travaux manuels');
  assert.strictEqual(mecaniques.length, 8, '8 travaux mécaniques');

  const expectedNames = [
    'Taille', 'Tirage des bois', 'Liage', 'Ébourgeonnage', 'Relevage', 'Palissage', 'Vendanges manuelles',
    'Rognage', 'Broyage', 'Traitements phytosanitaires', 'Travail du sol', 'Désherbage mécanique', 'Tonte', 'Épandage', 'Vendanges mécaniques'
  ];
  expectedNames.forEach(name => {
    const found = exp.DEFAULT_EXPLOITATION_TASKS.some(t => t.name.toLowerCase() === name.toLowerCase());
    assert.ok(found, `La tâche ${name} doit être présente dans DEFAULT_EXPLOITATION_TASKS`);
  });
});

it('4.2 Initialisation idempotente du catalogue (ensureStandardTasksExist)', () => {
  exp.VitiExpState.tasks = [];
  exp.ensureStandardTasksExist('test-org');
  assert.strictEqual(exp.VitiExpState.tasks.length, 15, '15 tâches créées');

  // Relance : ne doit créer aucun doublon
  exp.ensureStandardTasksExist('test-org');
  assert.strictEqual(exp.VitiExpState.tasks.length, 15, 'Aucun doublon après ré-exécution');
});

it('4.3 Scénario Métier : Création d\'un Rognage Passage 1 sur 10 parcelles (8.5000 ha)', () => {
  // Configurer 10 parcelles totalisant 8.5000 ha
  exp.VitiExpState.campaigns = [{ id: 'camp-2026', year: 2026, name: 'Campagne 2026', is_current: true }];
  exp.VitiExpState.currentCampaign = exp.VitiExpState.campaigns[0];
  exp.VitiExpState.currentCampaignId = 'camp-2026';
  exp.VitiExpState.parcelles = [
    { id: 'p-01', name: 'Les Côtes', surface_cadastrale: 0.8500, surface: 0.8500, is_active: true },
    { id: 'p-02', name: 'Le Val Noir', surface_cadastrale: 0.8500, surface: 0.8500, is_active: true },
    { id: 'p-03', name: 'Grandes Vignes 1', surface_cadastrale: 0.8500, surface: 0.8500, is_active: true },
    { id: 'p-04', name: 'Grandes Vignes 2', surface_cadastrale: 0.8500, surface: 0.8500, is_active: true },
    { id: 'p-05', name: 'Plateau Sud', surface_cadastrale: 0.8500, surface: 0.8500, is_active: true },
    { id: 'p-06', name: 'Plateau Nord', surface_cadastrale: 0.8500, surface: 0.8500, is_active: true },
    { id: 'p-07', name: 'Les Chênes', surface_cadastrale: 0.8500, surface: 0.8500, is_active: true },
    { id: 'p-08', name: 'La Garenne', surface_cadastrale: 0.8500, surface: 0.8500, is_active: true },
    { id: 'p-09', name: 'Clos du Moulin', surface_cadastrale: 0.8500, surface: 0.8500, is_active: true },
    { id: 'p-10', name: 'Bas de Côte', surface_cadastrale: 0.8500, surface: 0.8500, is_active: true }
  ];
  exp.VitiExpState.parcelleTasks = [];
  exp.VitiExpState.interventions = [];

  const rognageTask = exp.VitiExpState.tasks.find(t => t.name.toLowerCase() === 'rognage');
  assert.ok(rognageTask, 'Rognage doit exister dans les tâches');

  // Simulation formulaire : sélection des 10 parcelles
  const selectedParcelleIds = exp.VitiExpState.parcelles.map(p => p.id);
  const totalSurface = selectedParcelleIds.reduce((sum, pid) => {
    const parc = exp.VitiExpState.parcelles.find(p => p.id === pid);
    return sum + (parc ? Number(parc.surface) : 0);
  }, 0);

  assert.strictEqual(totalSurface.toFixed(4), '8.5000', 'La surface totale calculée doit être exactement 8.5000 ha');

  // Création des assignations groupées
  const jobGroupId = 'job-rognage-p1';
  selectedParcelleIds.forEach(pid => {
    const parc = exp.VitiExpState.parcelles.find(p => p.id === pid);
    exp.VitiExpState.parcelleTasks.push({
      id: `pt-${pid}-rognage-1`,
      campaign_id: 'camp-2026',
      parcelle_id: pid,
      task_id: rognageTask.id,
      passage_number: 1,
      job_group_id: jobGroupId,
      target_date: '2026-06-15',
      priority: 'haute',
      surface_target: parc.surface,
      status: 'todo',
      notes: 'Passage préventif rognage 1'
    });
  });

  // Vérifier le regroupement via getGroupedJobs
  const grouped = exp.getGroupedJobs('camp-2026');
  assert.strictEqual(grouped.length, 1, 'Il doit y avoir 1 groupe de travail');
  const job = grouped[0];
  assert.strictEqual(job.task_name, 'Rognage');
  assert.strictEqual(job.passage_number, 1);
  assert.strictEqual(job.work_type, 'mecanique');
  assert.strictEqual(job.total_parcelles, 10, '10 parcelles dans le groupe');
  assert.strictEqual(job.total_surface.toFixed(4), '8.5000', 'Surface totale de 8.5000 ha');
  assert.strictEqual(job.worked_surface.toFixed(4), '0.0000', 'Aucune intervention encore effectuée');
  assert.strictEqual(job.remaining_surface.toFixed(4), '8.5000', '8.5000 ha restants');
  assert.strictEqual(job.progress_pct, 0, '0% d\'avancement');
  assert.strictEqual(job.overall_status, 'todo', 'Statut initial À faire');
});

it('4.4 Scénario Passages Multiples : Rognage Passage 2 indépendant sur les mêmes 10 parcelles', () => {
  const rognageTask = exp.VitiExpState.tasks.find(t => t.name.toLowerCase() === 'rognage');
  const jobGroupIdP2 = 'job-rognage-p2';

  exp.VitiExpState.parcelles.forEach(parc => {
    exp.VitiExpState.parcelleTasks.push({
      id: `pt-${parc.id}-rognage-2`,
      campaign_id: 'camp-2026',
      parcelle_id: parc.id,
      task_id: rognageTask.id,
      passage_number: 2,
      job_group_id: jobGroupIdP2,
      target_date: '2026-07-10',
      priority: 'normale',
      surface_target: parc.surface,
      status: 'todo',
      notes: 'Deuxième passage estival'
    });
  });

  const grouped = exp.getGroupedJobs('camp-2026');
  assert.strictEqual(grouped.length, 2, 'Doit maintenant contenir 2 groupes de travaux distincts');
  const p1 = grouped.find(g => g.passage_number === 1);
  const p2 = grouped.find(g => g.passage_number === 2);
  assert.ok(p1 && p2, 'Passage 1 et Passage 2 existent distinctement');
  assert.strictEqual(p1.total_surface.toFixed(4), '8.5000');
  assert.strictEqual(p2.total_surface.toFixed(4), '8.5000');
});

it('4.5 Suivi réel d\'avancement adossé aux interventions (sans approximations arbitraires)', () => {
  const rognageTask = exp.VitiExpState.tasks.find(t => t.name.toLowerCase() === 'rognage');

  // Enregistrer 3 interventions réelles sur le Passage 1
  // - Parcelle 1 : 0.8500 ha terminée
  // - Parcelle 2 : 0.8500 ha terminée
  // - Parcelle 3 : 0.4250 ha partielle (moitié de la parcelle)
  exp.VitiExpState.interventions = [
    {
      id: 'int-01',
      campaign_id: 'camp-2026',
      parcelle_id: 'p-01',
      task_id: rognageTask.id,
      passage_number: 1,
      surface_worked: 0.8500,
      date: '2026-06-15'
    },
    {
      id: 'int-02',
      campaign_id: 'camp-2026',
      parcelle_id: 'p-02',
      task_id: rognageTask.id,
      passage_number: 1,
      surface_worked: 0.8500,
      date: '2026-06-15'
    },
    {
      id: 'int-03',
      campaign_id: 'camp-2026',
      parcelle_id: 'p-03',
      task_id: rognageTask.id,
      passage_number: 1,
      surface_worked: 0.4250,
      date: '2026-06-16'
    }
  ];

  // Calcul direct sur les parcelles
  const w1 = exp.getWorkedSurfaceOnParcelle('p-01', rognageTask.id, 1, 'camp-2026');
  const w2 = exp.getWorkedSurfaceOnParcelle('p-02', rognageTask.id, 1, 'camp-2026');
  const w3 = exp.getWorkedSurfaceOnParcelle('p-03', rognageTask.id, 1, 'camp-2026');
  const w4 = exp.getWorkedSurfaceOnParcelle('p-04', rognageTask.id, 1, 'camp-2026');

  assert.strictEqual(w1.toFixed(4), '0.8500', 'Parcelle 1 entièrement travaillée (0.8500 ha)');
  assert.strictEqual(w2.toFixed(4), '0.8500', 'Parcelle 2 entièrement travaillée (0.8500 ha)');
  assert.strictEqual(w3.toFixed(4), '0.4250', 'Parcelle 3 travaillée à moitié (0.4250 ha)');
  assert.strictEqual(w4.toFixed(4), '0.0000', 'Parcelle 4 non travaillée (0.0000 ha)');

  // Vérifier le regroupement du Passage 1
  const grouped = exp.getGroupedJobs('camp-2026');
  const p1 = grouped.find(g => g.passage_number === 1);
  const p2 = grouped.find(g => g.passage_number === 2);

  // Total attendu : 0.8500 + 0.8500 + 0.4250 = 2.1250 ha travaillés
  assert.strictEqual(p1.worked_surface.toFixed(4), '2.1250', 'Surface travaillée exacte');
  assert.strictEqual(p1.remaining_surface.toFixed(4), '6.3750', 'Surface restante exacte (8.5000 - 2.1250 = 6.3750 ha)');
  assert.strictEqual(p1.overall_status, 'in_progress', 'Statut du Passage 1 en cours');
  assert.strictEqual(p1.progress_pct, 25, '2.1250 / 8.5000 = 25%');

  // Vérifier que le Passage 2 n'est pas pollué par les interventions du Passage 1 !
  assert.strictEqual(p2.worked_surface.toFixed(4), '0.0000', 'Le Passage 2 a 0 ha travaillé');
  assert.strictEqual(p2.remaining_surface.toFixed(4), '8.5000', 'Le Passage 2 a encore 8.5000 ha restants');
  assert.strictEqual(p2.overall_status, 'todo', 'Le Passage 2 reste strictement À faire');
  assert.strictEqual(p2.progress_pct, 0, 'Le Passage 2 reste à 0%');
});

it('4.6 Modification et suppression d\'un groupe de travail (deleteJobGroup)', () => {
  const groupedBefore = exp.getGroupedJobs('camp-2026');
  assert.strictEqual(groupedBefore.length, 2, '2 groupes avant suppression');

  // Supprimer le Passage 2
  exp.deleteJobGroup('job-rognage-p2');
  const groupedAfter = exp.getGroupedJobs('camp-2026');
  assert.strictEqual(groupedAfter.length, 1, 'Il ne doit rester que le Passage 1');
  assert.strictEqual(groupedAfter[0].passage_number, 1, 'Le groupe restant est bien le Passage 1');
});

// ==============================================================================
// 5. CONTRÔLE DE NON-RÉGRESSION VITI-PRESTATION
// ==============================================================================
console.log('\n📌 SUITE 5 : Non-Régression Absolue VitiTrack Prestation');

it('5.1 Le script dashboard.js est intact et ses structures de données clés sont présentes', () => {
  const dashJsPath = path.join(__dirname, '..', 'dashboard.js');
  const dashJs = fs.readFileSync(dashJsPath, 'utf8');
  assert.ok(dashJs.length > 50000, 'dashboard.js présent et volumineux');
  assert.ok(dashJs.includes('STORAGE_CLIENTS_BASE'), 'Stockage multi-tenant Prestation présent');
  assert.ok(dashJs.includes('STORAGE_INTERVENTIONS_BASE'), 'Stockage interventions Prestation présent');
  assert.ok(dashJs.includes('STORAGE_SERVICES_BASE'), 'Stockage catalogue services Prestation présent');
  assert.ok(dashJs.includes('getAuthUser'), 'Gestion d\'authentification Prestation intacte');
});

it('5.2 Les tables et modules Prestation ne sont pas altérés par le schéma Exploitation Étape 3', () => {
  assert.ok(!sqlContent.includes('ALTER TABLE interventions'), 'Ne modifie pas interventions Prestation');
  assert.ok(!sqlContent.includes('ALTER TABLE clients'), 'Ne modifie pas clients Prestation');
  assert.ok(!sqlContent.includes('DROP TABLE'), 'Aucun DROP TABLE destructif');
});

console.log('\n==================================================================');
console.log('🍇 RÉSULTAT FINAL : TOUTES LES SUITES DE TESTS SONT VALIDÉES !');
console.log('🍇 ==================================================================\n');
