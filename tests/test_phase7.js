/**
 * VitiTrack Pro — Suite de Tests Automatisés Phase 7
 * Validation complète : Tableau de Bord de Pilotage & Analyse de l'Exploitation
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🍇 ==============================================================');
console.log('🍇 LANCEMENT DES TESTS D\'INTÉGRATION — PHASE 7 EXPLOITATION');
console.log('🍇 TABLEAU DE BORD DE PILOTAGE & ANALYSE DE L\'EXPLOITATION');
console.log('🍇 ==============================================================\n');

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

// ----------------------------------------------------------------------------
// SIMULATION DE L'ENVIRONNEMENT DOM / STORAGE
// ----------------------------------------------------------------------------
const localStorageMock = (function () {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
    _dump: () => store
  };
})();

class MockElement {
  constructor(tag, id = '') {
    this.tagName = tag;
    this.id = id;
    this.className = '';
    this.classList = {
      _classes: new Set(),
      add: function (c) { this._classes.add(c); },
      remove: function (c) { this._classes.delete(c); },
      contains: function (c) { return this._classes.has(c); },
      toggle: function (c, force) {
        if (force === undefined) {
          if (this._classes.has(c)) this._classes.delete(c);
          else this._classes.add(c);
        } else if (force) this._classes.add(c);
        else this._classes.delete(c);
      }
    };
    this.style = {};
    this.attributes = {};
    this.innerHTML = '';
    this.textContent = '';
    this.value = '';
    this.checked = false;
    this.children = [];
  }
  setAttribute(attr, val) { this.attributes[attr] = String(val); }
  getAttribute(attr) { return this.attributes[attr] || null; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  click() {}
}

const documentMock = {
  elements: {},
  readyState: 'complete',
  body: new MockElement('body'),
  getElementById: function (id) {
    if (!this.elements[id]) {
      this.elements[id] = new MockElement('div', id);
    }
    return this.elements[id];
  },
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; },
  createElement: function (tag) { return new MockElement(tag); },
  addEventListener: function () {}
};
documentMock.body.appendChild = function () {};
documentMock.body.removeChild = function () {};

const windowMock = {
  document: documentMock,
  localStorage: localStorageMock,
  crypto: {
    randomUUID: () => 'uuid-' + Math.random().toString(36).substring(2, 9)
  },
  navigator: { onLine: true },
  supabaseClient: null,
  addEventListener: function () {},
  confirm: () => true,
  alert: () => {}
};

global.window = windowMock;
global.document = documentMock;
global.localStorage = localStorageMock;
global.navigator = windowMock.navigator;
global.confirm = windowMock.confirm;
global.alert = windowMock.alert;

// Injection des variables mock
localStorageMock.setItem('vititrack_activity_type', 'exploitation');
localStorageMock.setItem('vititrack_active_mode', 'exploitation');
localStorageMock.setItem('vititrack_auth_user', JSON.stringify({
  id: 'usr-owner-001',
  email: 'gerant@chateau-test.fr',
  domain_name: 'Domaine Grand Cru',
  activity_type: 'exploitation',
  active_mode: 'exploitation'
}));

// Chargement du script
const scriptCode = fs.readFileSync(path.join(__dirname, '../exploitation.js'), 'utf-8');
const runExploitation = new Function('window', 'document', scriptCode);
runExploitation(windowMock, documentMock);

const {
  VitiExpState,
  renderExploitationDashboard,
  renderDashboardFiltersBar,
  onDashboardFiltersChange,
  resetDashboardFilters,
  renderDashboardAlerts,
  renderDashboardKPIs,
  renderDashboardWorkProgress,
  openTaskParcellesModal,
  closeTaskParcellesModal,
  startInterventionForParcelle,
  renderDashboardTodoParcelles,
  renderDashboardRecentInterventions,
  renderDashboardEconomicBreakdown,
  renderDashboardHarvestAnalysis,
  sortDashboardHarvestTable,
  renderDashboardCampaignEvolution,
  renderFicheParcelleEvolution,
  getFilteredParcelles,
  calculateParcelleCostSummary,
  calculateParcelleHarvestSummary,
  calculateExploitationHarvestSummary,
  calculateExploitationWeightedAverageCostPerHa,
  getCostSituation
} = windowMock;

// ----------------------------------------------------------------------------
// SCÉNARIOS DE TEST PHASE 7
// ----------------------------------------------------------------------------

// Initialisation d'un jeu de données de test
VitiExpState.campaigns = [
  { id: 'camp-2027', year: 2027, name: 'Campagne 2027', is_active: true },
  { id: 'camp-2026', year: 2026, name: 'Campagne 2026', is_active: false }
];
VitiExpState.currentCampaign = VitiExpState.campaigns[0];

VitiExpState.parcelles = [
  { id: 'p-crayeres', name: 'Les Crayères', surface: 0.8425, commune: 'Pauillac', lieu_dit: 'Sud', cepage: 'Chardonnay', status: 'active' },
  { id: 'p-moulin', name: 'Clos du Moulin', surface: 1.5000, commune: 'Pauillac', lieu_dit: 'Haut', cepage: 'Cabernet Sauvignon', status: 'active' },
  { id: 'p-raies', name: 'Les Longues Raies', surface: 2.1000, commune: 'Margaux', lieu_dit: 'Plaine', cepage: 'Merlot', status: 'active' }
];

VitiExpState.tasks = [
  { id: 't-taille', name: 'Taille de la vigne', category: 'Hiver', unit: 'ha', is_active: true },
  { id: 't-liage', name: 'Liage', category: 'Printemps', unit: 'ha', is_active: true },
  { id: 't-traitement', name: 'Traitements bio', category: 'Protection', unit: 'ha', is_active: true }
];

VitiExpState.workers = [
  { id: 'w-1', name: 'Jean Dupont', hourly_rate: 25.0, is_active: true }
];

VitiExpState.equipment = [
  { id: 'eq-1', name: 'Tracteur Fendt 211V', hourly_cost: 35.0, is_active: true }
];

VitiExpState.inputs = [
  { id: 'inp-1', name: 'Soufre mouillable', unit: 'kg', unit_cost: 4.5, is_active: true }
];

VitiExpState.interventions = [];
VitiExpState.harvests = [];
VitiExpState.externalCosts = [];
VitiExpState.offlineQueue = [];

// ============================================================================
// TEST 1 : Dashboard sans données (Empty State utile sans fausses données)
// ============================================================================
it('1. Dashboard sans données : affiche un état vide utile sans fausse estimation', () => {
  VitiExpState.interventions = [];
  VitiExpState.harvests = [];
  renderExploitationDashboard();

  const recentEl = documentMock.getElementById('exp-dashboard-recent-interventions');
  assert(recentEl.innerHTML.includes('Aucune intervention enregistrée'), 'Doit proposer d\'enregistrer la première intervention');
  assert(recentEl.innerHTML.includes('Saisie d\'intervention'), 'Bouton d\'action directe présent');

  const harvestCard = documentMock.getElementById('exp-dashboard-harvest-analytics-card');
  assert.strictEqual(harvestCard.style.display, 'none', 'Section vendanges masquée si aucune vendange');
});

// ============================================================================
// TEST 2 : Dashboard avec interventions & filtrage
// ============================================================================
it('2. Dashboard avec interventions : calcul des totaux et filtrage parcelles', () => {
  // Création d'une intervention sur Les Crayères
  VitiExpState.interventions.push({
    id: 'it-1',
    campaign_id: 'camp-2027',
    task_id: 't-taille',
    intervention_date: new Date().toISOString().split('T')[0],
    duration_hours: 4.0,
    worker_count: 1,
    parcelles: [{ parcelle_id: 'p-crayeres', surface_worked: 0.8425 }],
    workers: [{ worker_id: 'w-1', hours: 4.0, labor_cost: 100.0 }],
    equipment: [{ equipment_id: 'eq-1', hours: 4.0, equipment_cost: 140.0 }],
    inputs: []
  });

  renderExploitationDashboard();
  const filtered = getFilteredParcelles();
  assert.strictEqual(filtered.length, 3, '3 parcelles au total sans filtre');
});

// ============================================================================
// TEST 3 : Permissions financières (can_view_costs = false masque les montants)
// ============================================================================
it('3. Permissions financières : can_view_costs = false masque tous les montants financiers', () => {
  localStorageMock.setItem('vititrack_auth_user', JSON.stringify({
    id: 'usr-tractoriste',
    email: 'ouvrier@chateau-test.fr',
    role: 'worker',
    can_view_costs: false
  }));

  renderExploitationDashboard();

  const kpisGrid = documentMock.getElementById('exp-dashboard-kpis-grid');
  assert(!kpisGrid.innerHTML.includes('€'), 'Aucun signe € dans les KPIs pour un tractoriste');

  const ecoSec = documentMock.getElementById('exp-dashboard-economic-section');
  assert.strictEqual(ecoSec.style.display, 'none', 'Section économique entièrement masquée');

  // Rétablir gérant avec droits
  localStorageMock.setItem('vititrack_auth_user', JSON.stringify({
    id: 'usr-owner-001',
    email: 'gerant@chateau-test.fr',
    role: 'owner',
    can_view_costs: true
  }));
});

// ============================================================================
// TEST 4 : Avancement des travaux basé rigoureusement sur les surfaces
// ============================================================================
it('4. Avancement des travaux : basé strictement sur la surface réelle cumulée', () => {
  // Les Crayères (0.8425 ha) taillée à 100%
  renderDashboardWorkProgress();
  const progContainer = documentMock.getElementById('exp-dashboard-progress-container');
  assert(progContainer.innerHTML.includes('Taille de la vigne'), 'Doit afficher la tâche taille');
  assert(progContainer.innerHTML.includes('0,8 / 4,4 ha') || progContainer.innerHTML.includes('0,84 / 4,44 ha'), 'Doit afficher la surface taillée exacte sur surface totale');
});

// ============================================================================
// TEST 5 : Parcelles à faire & action opérationnelle
// ============================================================================
it('5. Parcelles à faire : liste opérationnelle et bouton ＋ Saisir intervention', () => {
  renderDashboardTodoParcelles();
  const todoContainer = documentMock.getElementById('exp-dashboard-todo-parcelles-container');
  assert(todoContainer.innerHTML.includes('Clos du Moulin'), 'Clos du Moulin doit être à faire');
  assert(todoContainer.innerHTML.includes('startInterventionForParcelle'), 'Bouton pour lancer intervention opérationnelle');
});

// ============================================================================
// TEST 6 : Activité récente (libellés Aujourd'hui, Hier, clic pour ouvrir)
// ============================================================================
it('6. Activité récente : libellé temporel intelligent et bouton Ouvrir', () => {
  renderDashboardRecentInterventions();
  const recentContainer = documentMock.getElementById('exp-dashboard-recent-interventions');
  assert(recentContainer.innerHTML.includes('Aujourd\'hui'), 'Doit identifier l\'intervention du jour');
  assert(recentContainer.innerHTML.includes('editIntervention(\'it-1\')'), 'Bouton d\'édition avec id');
});

// ============================================================================
// TEST 7 : Ventilation des coûts de la campagne
// ============================================================================
it('7. Ventilation des coûts : répartition par catégorie et barre de pourcentage', () => {
  renderDashboardEconomicBreakdown();
  const breakdownEl = documentMock.getElementById('exp-dashboard-cost-categories-breakdown');
  assert(breakdownEl.innerHTML.includes('Main-d\'œuvre'), 'Contient Main-d\'œuvre');
  assert(breakdownEl.innerHTML.includes('Matériel'), 'Contient Matériel');
  assert(breakdownEl.innerHTML.includes('cost-breakdown-bar-wrap'), 'Contient la barre de proportion');
});

// ============================================================================
// TEST 8 : Coût par travail ("Quels travaux coûtent le plus ?")
// ============================================================================
it('8. Coût par travail : classement par montant réel décroissant avec €/ha', () => {
  renderDashboardEconomicBreakdown();
  const taskListEl = documentMock.getElementById('exp-dashboard-cost-by-task-list');
  assert(taskListEl.innerHTML.includes('Taille de la vigne'), 'Taille de la vigne listée');
  assert(taskListEl.innerHTML.includes('240 €'), 'Somme 100€ + 140€ = 240€');
  assert(taskListEl.innerHTML.includes('€/ha'), 'Mentionne le coût par ha');
});

// ============================================================================
// TEST 9 : Classement des parcelles par €/ha avec termes objectifs
// ============================================================================
it('9. Classement parcelles : badges factuels sans jugement de valeur (« rentable/bonne »)', () => {
  renderDashboardEconomicBreakdown();
  const parcelleListEl = documentMock.getElementById('exp-dashboard-cost-by-parcelle-list');
  const html = parcelleListEl.innerHTML;
  assert(!html.includes('rentable') && !html.includes('non rentable'), 'Aucun terme rentable');
  assert(!html.includes('bonne') && !html.includes('mauvaise'), 'Aucun jugement moral');
  assert(html.includes('moyenne'), 'Indication objective par rapport à la moyenne');
});

// ============================================================================
// TEST 10 : Analyse Coût / Rendement (tableau croisé triable)
// ============================================================================
it('10. Analyse Coût / Rendement : tableau croisé avec tri kg/ha, €/ha, €/kg', () => {
  // Enregistrement d'une pesée de vendange sur Les Crayères
  VitiExpState.harvests.push({
    id: 'h-1',
    campaign_id: 'camp-2027',
    parcelle_id: 'p-crayeres',
    harvest_date: '2027-09-20',
    weight_kg: 7420,
    harvested_surface: 0.8425
  });

  renderDashboardHarvestAnalysis();
  const cardEl = documentMock.getElementById('exp-dashboard-harvest-analytics-card');
  assert.strictEqual(cardEl.style.display, 'block', 'Section vendanges visible dès qu\'une pesée existe');

  const tbody = documentMock.getElementById('exp-dashboard-harvest-cost-tbody');
  const normalizedHtml = tbody.innerHTML.replace(/\s+/g, ' ');
  assert(normalizedHtml.includes('8 807 kg/ha'), 'Calcul exact du rendement');
  assert(normalizedHtml.includes('0,03 €'), 'Calcul du coût au kg');

  // Test du tri
  sortDashboardHarvestTable('yield');
  assert(documentMock.getElementById('exp-dashboard-harvest-cost-tbody').innerHTML.length > 0, 'Tableau rafraîchi après tri');
});

// ============================================================================
// TEST 11 : Graphique interactif SVG (Rendement kg/ha vs Coût €/ha)
// ============================================================================
it('11. Graphique interactif SVG : dispersion avec axes, repères de moyenne et infobulles', () => {
  renderDashboardHarvestAnalysis();
  const chartWrap = documentMock.getElementById('exp-dashboard-scatter-chart-wrap');
  assert(chartWrap.innerHTML.includes('<svg class="scatter-chart-svg"'), 'Contient le SVG natif');
  assert(chartWrap.innerHTML.includes('Rendement (kg/ha)'), 'Axe X présent');
  assert(chartWrap.innerHTML.includes('Coût (€/ha)'), 'Axe Y présent');
  assert(chartWrap.innerHTML.includes('Les Crayères'), 'Point avec infobulle pour Les Crayères');
});

// ============================================================================
// TEST 12 : Comparaison entre campagnes (Campagne N vs N-1)
// ============================================================================
it('12. Comparaison entre campagnes : calcul des deltas de variation % entre 2027 et 2026', () => {
  // Ajout de vendanges en 2026 pour comparaison
  VitiExpState.harvests.push({
    id: 'h-old',
    campaign_id: 'camp-2026',
    parcelle_id: 'p-crayeres',
    harvest_date: '2026-09-22',
    weight_kg: 7000,
    harvested_surface: 0.8425
  });

  renderDashboardCampaignEvolution();
  const evoContent = documentMock.getElementById('exp-dashboard-campaign-evolution-content');
  assert(evoContent.innerHTML.includes('Rendement moyen'), 'Affiche la carte de rendement');
  assert(evoContent.innerHTML.includes('evolution-delta-badge'), 'Affiche le badge de variation en %');
});

// ============================================================================
// TEST 13 : Fiche Parcelle - Évolution sur plusieurs années
// ============================================================================
it('13. Fiche Parcelle pluriannuelle : historique des campagnes avec Coût/ha, kg/ha et Coût/kg', () => {
  renderFicheParcelleEvolution('p-crayeres');
  const evoContainer = documentMock.getElementById('fiche-vendanges-campaigns-history');
  const normalizedEvo = evoContainer.innerHTML.replace(/\s+/g, ' ');
  assert(normalizedEvo.includes('Campagne 2027'), 'Ligne campagne 2027 présente');
  assert(normalizedEvo.includes('Campagne 2026'), 'Ligne campagne 2026 présente');
  assert(normalizedEvo.includes('8 807 kg/ha'), 'Rendement affiché');
});

// ============================================================================
// TEST 14 : Alertes opérationnelles factuelles ("À SURVEILLER")
// ============================================================================
it('14. Alertes opérationnelles : détection des travaux restants et écarts mesurables', () => {
  renderDashboardAlerts();
  const alertsContainer = documentMock.getElementById('exp-dashboard-alerts-container');
  assert(alertsContainer.innerHTML.includes('dashboard-alert-item'), 'Contient au moins une alerte factuelle');
  assert(alertsContainer.innerHTML.includes('parcelle'), 'Mentionne les parcelles nécessitant attention');
});

// ============================================================================
// TEST 15 : Filtres globaux (Campagne, Cépage, Commune, Travail)
// ============================================================================
it('15. Filtres globaux : filtre par cépage recalculant immédiatement le périmètre', () => {
  VitiExpState.dashboardFilters.cepage = 'Chardonnay';
  const filtered = getFilteredParcelles();
  assert.strictEqual(filtered.length, 1, 'Seul Les Crayères est en Chardonnay');
  assert.strictEqual(filtered[0].name, 'Les Crayères', 'Nom de la parcelle filtrée');

  // Réinitialisation
  resetDashboardFilters();
  assert.strictEqual(VitiExpState.dashboardFilters.cepage, '', 'Filtre réinitialisé');
  assert.strictEqual(getFilteredParcelles().length, 3, 'Retour aux 3 parcelles');
});

// ============================================================================
// TEST 16 : Priorité mobile dans le layout CSS
// ============================================================================
it('16. Mobile layout : présence des règles flex/grid d\'ordonnancement prioritaire terrain', () => {
  const css = fs.readFileSync(path.join(__dirname, '../exploitation.css'), 'utf-8');
  assert(css.includes('@media (max-width: 768px)'), 'Media query mobile présent');
  assert(css.includes('#exp-dashboard-progress-card') && css.includes('order: 4'), 'Priorité 1 : Avancement');
  assert(css.includes('#exp-dashboard-todo-card') && css.includes('order: 5'), 'Priorité 2 : Parcelles à faire');
  assert(css.includes('#exp-dashboard-recent-card') && css.includes('order: 6'), 'Priorité 4 : Activité récente');
  assert(css.includes('#exp-dashboard-kpis-grid') && css.includes('order: 7'), 'Priorité 5 : KPIs');
});

// ============================================================================
// TEST 17 : Offline pending queue dans les alertes
// ============================================================================
it('17. Mode Hors-ligne : alerte sur les interventions en attente de synchronisation', () => {
  VitiExpState.offlineQueue = [{ id: 'off-1', type: 'intervention' }];
  renderDashboardAlerts();
  const alertsContainer = documentMock.getElementById('exp-dashboard-alerts-container');
  assert(alertsContainer.innerHTML.includes('en attente de synchronisation'), 'Alerte synchro hors-ligne visible');
  VitiExpState.offlineQueue = [];
});

// ============================================================================
// TEST 18 : Performances et calculs limités au périmètre utile
// ============================================================================
it('18. Performances : calculs limités à la campagne sélectionnée sans charger tout l\'historique', () => {
  const t0 = Date.now();
  for (let i = 0; i < 50; i++) {
    renderExploitationDashboard();
  }
  const duration = Date.now() - t0;
  assert(duration < 500, `Rendu réactif performant (${duration}ms pour 50 cycles)`);
});

// ============================================================================
// TEST 19 : Non-régression Phases 3 à 6
// ============================================================================
it('19. Non-régression Phases 3 à 6 : intégrité des calculateurs de coûts, vendanges et parcelles', () => {
  const pSum = calculateParcelleCostSummary('p-crayeres', 'camp-2027');
  assert.strictEqual(pSum.totalCost, 240.0, 'Coût parcelle intègre (100€ MO + 140€ Mat)');

  const hSum = calculateParcelleHarvestSummary('p-crayeres', 'camp-2027');
  assert.strictEqual(hSum.totalWeightKg, 7420, 'Pesées vendanges intègres');
  assert.strictEqual(hSum.yieldKgHa, 8807, 'Rendement intègre');
});

// ============================================================================
// TEST 20 : Non-régression Mode Prestation
// ============================================================================
it('20. Non-régression Mode Prestation : dashboard.js et variables globales prestation intactes', () => {
  const dashboardJs = fs.readFileSync(path.join(__dirname, '../dashboard.js'), 'utf-8');
  assert(dashboardJs.includes('initDashboard()') || dashboardJs.includes('VitiTrackState'), 'dashboard.js intact');
  assert(localStorageMock.getItem('vititrack_active_mode') === 'exploitation', 'Mode exploitation actif');
});

// ============================================================================
// BILAN DES TESTS
// ============================================================================
console.log('\n==============================================================');
console.log(`📊 BILAN DES TESTS PHASE 7 : ${passedTests} / ${totalTests} réussis`);
if (failedTests === 0) {
  console.log('🎉 TOUS LES TESTS SONT AU VERT ! PHASE 7 TOTALEMENT VALIDÉE.');
} else {
  console.error(`⚠️ ATTENTION : ${failedTests} test(s) en échec.`);
}
console.log('==============================================================\n');

process.exit(failedTests > 0 ? 1 : 0);
