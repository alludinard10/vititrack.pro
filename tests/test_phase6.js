/**
 * VitiTrack Pro — Suite de Tests Automatisés Phase 6
 * Validation unitaire et intégration : Vendanges, Rendement & Coût au kg
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🍇 ==============================================================');
console.log('🍇 LANCEMENT DES TESTS D\'INTÉGRATION — PHASE 6 EXPLOITATION');
console.log('🍇 VENDANGES, RENDEMENT & COÛT AU KG');
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

global.Blob = class { constructor(parts) { this.parts = parts; } };
global.URL = { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} };

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

// Chargement du module
const scriptCode = fs.readFileSync(path.join(__dirname, '../exploitation.js'), 'utf-8');
const runExploitation = new Function('window', 'document', scriptCode);
runExploitation(windowMock, documentMock);

const {
  VitiExpState,
  calculateParcelleCostSummary,
  calculateParcelleHarvestSummary,
  calculateExploitationHarvestSummary,
  getHarvestComparisonFacts,
  renderVendangesView,
  renderFicheParcelleVendanges,
  saveHarvest,
  deleteHarvest,
  exportHarvestsCSV
} = windowMock;

// ----------------------------------------------------------------------------
// INITIALISATION DU JEU DE TEST
// ----------------------------------------------------------------------------
const ORG_ID = 'org-test-phase6';
const CAMP_2027 = 'camp-2027';
const CAMP_2026 = 'camp-2026';

VitiExpState.organization = { id: ORG_ID, name: 'Domaine Grand Cru' };
VitiExpState.campaigns = [
  { id: CAMP_2027, organization_id: ORG_ID, name: 'Campagne 2027', year: 2027, is_active: true },
  { id: CAMP_2026, organization_id: ORG_ID, name: 'Campagne 2026', year: 2026, is_active: false }
];
VitiExpState.currentCampaign = VitiExpState.campaigns[0];

VitiExpState.members = [
  { id: 'mem-1', organization_id: ORG_ID, user_id: 'usr-owner-001', role: 'owner', can_view_costs: true }
];

// Deux parcelles de test
// Parcelle A : Les Crayères (0.8425 ha) - Coût annuel simulé 5 300 €
// Parcelle B : Clos du Moulin (1.5000 ha) - Coût annuel simulé 6 000 €
VitiExpState.parcelles = [
  { id: 'p-crayeres', organization_id: ORG_ID, name: 'Les Crayères', surface: 0.8425, cepage: 'Chardonnay', commune: 'Reims', status: 'active' },
  { id: 'p-clos', organization_id: ORG_ID, name: 'Clos du Moulin', surface: 1.5000, cepage: 'Pinot Noir', commune: 'Épernay', status: 'active' },
  { id: 'p-vierge', organization_id: ORG_ID, name: 'La Garenne', surface: 0.5000, cepage: 'Meunier', commune: 'Aÿ', status: 'active' }
];

// Configuration des coûts d'intervention pour atteindre 5 300 € sur Les Crayères et 6 000 € sur Clos du Moulin
VitiExpState.interventions = [];
VitiExpState.externalCosts = [
  { id: 'ext-crayeres', organization_id: ORG_ID, campaign_id: CAMP_2027, parcelle_id: 'p-crayeres', amount: 5300.00, category: 'Prestation tiers', description: 'Travaux annuels' },
  { id: 'ext-clos', organization_id: ORG_ID, campaign_id: CAMP_2027, parcelle_id: 'p-clos', amount: 6000.00, category: 'Prestation tiers', description: 'Travaux annuels' }
];
VitiExpState.harvests = [];

// ============================================================================
// TESTS D'INTÉGRATION ET UNITAIRES PHASE 6
// ============================================================================

it('1. ÉTAPE 0 : Isolation RLS stricte A/B (PostgreSQL et schéma SQL)', () => {
  const schemaSql = fs.readFileSync(path.join(__dirname, '../supabase/exploitation_schema.sql'), 'utf-8');
  assert.ok(schemaSql.includes('is_org_member(organization_id)'), 'La fonction is_org_member doit être appelée');
  assert.ok(schemaSql.includes('CREATE POLICY "p_ext_costs_all"'), 'Politique p_ext_costs_all requise');
  assert.ok(schemaSql.includes('CREATE POLICY "p_fuel_all"'), 'Politique p_fuel_all requise');
  assert.ok(schemaSql.includes('CREATE POLICY "p_harvests_all"'), 'Politique p_harvests_all requise');
  assert.ok(!schemaSql.includes('auth.uid() IS NOT NULL;'), 'Ne doit pas utiliser un simple auth.uid() IS NOT NULL pour ces tables');
});

it('2. Création de pesée initiale sur Les Crayères (Matin : 3 420 kg)', () => {
  VitiExpState.harvests.push({
    id: 'h-1',
    organization_id: ORG_ID,
    campaign_id: CAMP_2027,
    parcelle_id: 'p-crayeres',
    harvest_date: '2027-09-12',
    harvested_surface: 0.8425,
    weight_kg: 3420.00,
    grape_variety: 'Chardonnay',
    team_size: 12,
    duration_hours: 4.5
  });

  const summary = calculateParcelleHarvestSummary('p-crayeres', CAMP_2027);
  assert.strictEqual(summary.totalWeightKg, 3420.00);
  assert.strictEqual(summary.weighingsCount, 1);
  assert.strictEqual(summary.uniqueHarvestedSurface, 0.8425);
  // Rendement 3 420 / 0.8425 = 4 059 kg/ha
  assert.strictEqual(summary.yieldKgHa, Math.round(3420 / 0.8425));
});

it('3. Plusieurs pesées même parcelle (Matin: 3 420 kg + Après-midi: 2 870 kg + J+1: 1 130 kg = 7 420 kg)', () => {
  VitiExpState.harvests.push({
    id: 'h-2',
    organization_id: ORG_ID,
    campaign_id: CAMP_2027,
    parcelle_id: 'p-crayeres',
    harvest_date: '2027-09-12',
    harvested_surface: 0.8425,
    weight_kg: 2870.00,
    grape_variety: 'Chardonnay'
  });
  VitiExpState.harvests.push({
    id: 'h-3',
    organization_id: ORG_ID,
    campaign_id: CAMP_2027,
    parcelle_id: 'p-crayeres',
    harvest_date: '2027-09-13',
    harvested_surface: 0.8425,
    weight_kg: 1130.00,
    grape_variety: 'Chardonnay'
  });

  const summary = calculateParcelleHarvestSummary('p-crayeres', CAMP_2027);
  assert.strictEqual(summary.weighingsCount, 3);
  assert.strictEqual(summary.totalWeightKg, 7420.00);
  // Aucune ancienne pesée n'a été écrasée
  assert.strictEqual(summary.harvests.length, 3);
});

it('4. Surface vendangée unique et Rendement kg/ha (7 420 kg / 0.8425 ha = 8 807 kg/ha)', () => {
  const summary = calculateParcelleHarvestSummary('p-crayeres', CAMP_2027);
  // La surface ne doit pas être triplée à 2.5275 ha
  assert.strictEqual(summary.uniqueHarvestedSurface, 0.8425);
  // 7 420 / 0.8425 = 8 807.12 -> 8 807 kg/ha
  assert.strictEqual(summary.yieldKgHa, 8807);
});

it('5. Coût de revient au kg : connexion directe au moteur économique Phase 5 (5 300 € / 7 420 kg = 0.71 €/kg)', () => {
  const summary = calculateParcelleHarvestSummary('p-crayeres', CAMP_2027);
  assert.strictEqual(summary.totalCost, 5300.00);
  // 5 300 / 7 420 = 0.714285...
  const exactCostKg = 5300 / 7420;
  assert.ok(Math.abs(summary.costPerKg - exactCostKg) < 0.0001);
  assert.strictEqual(summary.costPerKg.toFixed(2), '0.71');
});

it('6. Deuxième parcelle récoltée : Clos du Moulin (6 000 kg sur 1.50 ha, coût 6 000 €)', () => {
  VitiExpState.harvests.push({
    id: 'h-4',
    organization_id: ORG_ID,
    campaign_id: CAMP_2027,
    parcelle_id: 'p-clos',
    harvest_date: '2027-09-14',
    harvested_surface: 1.5000,
    weight_kg: 6000.00,
    grape_variety: 'Pinot Noir'
  });

  const summary = calculateParcelleHarvestSummary('p-clos', CAMP_2027);
  assert.strictEqual(summary.totalWeightKg, 6000.00);
  assert.strictEqual(summary.yieldKgHa, 4000); // 6 000 / 1.50 = 4 000 kg/ha
  assert.strictEqual(summary.costPerKg.toFixed(2), '1.00'); // 6 000 € / 6 000 kg = 1.00 €/kg
});

it('7. Dashboard Vendanges : Total kg, Surface vendangée unique, Rendement moyen exploitation', () => {
  const expSummary = calculateExploitationHarvestSummary(CAMP_2027);
  // Total récolté = 7 420 kg + 6 000 kg = 13 420 kg
  assert.strictEqual(expSummary.totalWeightKg, 13420.00);
  // Surface vendangée unique = 0.8425 ha + 1.5000 ha = 2.3425 ha (sans doublons)
  assert.strictEqual(expSummary.uniqueHarvestedSurfaceTotal, 2.3425);
  // Rendement moyen = 13 420 kg / 2.3425 ha = 5 729 kg/ha
  assert.strictEqual(expSummary.avgYieldKgHa, Math.round(13420 / 2.3425));
});

it('8. Coût moyen de production / kg de l\'exploitation pondéré par la production (pas de moyenne simple !)', () => {
  const expSummary = calculateExploitationHarvestSummary(CAMP_2027);
  // Coût total parcelles récoltées = 5 300 € + 6 000 € = 11 300 €
  // Total kg = 13 420 kg
  // Coût moyen pondéré = 11 300 € / 13 420 kg = 0.8420... €/kg
  const expectedWeighted = 11300 / 13420;
  assert.ok(Math.abs(expSummary.avgCostPerKg - expectedWeighted) < 0.0001);
  assert.strictEqual(expSummary.avgCostPerKg.toFixed(2), '0.84');

  // Vérification qu'il est distinct de la moyenne simple des ratios (0.71 + 1.00) / 2 = 0.855
  const simpleAvg = (0.7143 + 1.0) / 2;
  assert.notStrictEqual(expSummary.avgCostPerKg.toFixed(2), simpleAvg.toFixed(2));
});

it('9. Statuts d\'avancement des vendanges : À vendanger, En cours, Vendangée', () => {
  // Parcelle vierge : aucune pesée
  const sVierge = calculateParcelleHarvestSummary('p-vierge', CAMP_2027);
  assert.strictEqual(sVierge.status, 'todo'); // À vendanger

  // Parcelle avec récolte partielle
  VitiExpState.harvests.push({
    id: 'h-partiel',
    organization_id: ORG_ID,
    campaign_id: CAMP_2027,
    parcelle_id: 'p-vierge',
    harvest_date: '2027-09-15',
    harvested_surface: 0.2000, // 0.20 ha sur 0.50 ha
    weight_kg: 1000.00
  });
  const sPartiel = calculateParcelleHarvestSummary('p-vierge', CAMP_2027);
  assert.strictEqual(sPartiel.status, 'in_progress'); // En cours

  // Parcelle totalement récoltée (Les Crayères : 0.8425 ha sur 0.8425 ha)
  const sCrayeres = calculateParcelleHarvestSummary('p-crayeres', CAMP_2027);
  assert.strictEqual(sCrayeres.status, 'done'); // Vendangée

  // Nettoyage de la pesée de test sur p-vierge
  VitiExpState.harvests = VitiExpState.harvests.filter(h => h.id !== 'h-partiel');
});

it('10. Faits comparatifs objectifs sans jugement de valeur (« bonne/mauvaise parcelle »)', () => {
  const expSummary = calculateExploitationHarvestSummary(CAMP_2027);
  const sCrayeres = calculateParcelleHarvestSummary('p-crayeres', CAMP_2027);
  const facts = getHarvestComparisonFacts(sCrayeres, expSummary);

  assert.ok(facts.length > 0);
  facts.forEach(f => {
    assert.ok(!f.toLowerCase().includes('bonne'), 'Aucun qualificatif "bonne"');
    assert.ok(!f.toLowerCase().includes('mauvaise'), 'Aucun qualificatif "mauvaise"');
    assert.ok(!f.toLowerCase().includes('rentable'), 'Aucun qualificatif "rentable" sans prix de vente');
  });
  // Doit mentionner un fait chiffré
  assert.ok(facts.some(f => f.includes('Rendement supérieur')));
  assert.ok(facts.some(f => f.includes('Coût/kg inférieur')));
});

it('11. Éviter le double comptage de la main-d\'œuvre (team_size et duration_hours informatifs)', () => {
  // Une pesée avec 15 vendangeurs pendant 8 heures
  const h = VitiExpState.harvests.find(x => x.id === 'h-1');
  assert.strictEqual(h.team_size, 12);
  assert.strictEqual(h.duration_hours, 4.5);

  // Vérifier que le coût de la parcelle n'a pas augmenté magiquement
  const costSummary = calculateParcelleCostSummary('p-crayeres', CAMP_2027);
  assert.strictEqual(costSummary.totalCost, 5300.00); // Reste strictement 5 300 €
});

it('12. Enregistrement des travaux de vendanges comme intervention classique Phase 4', () => {
  // Si le viticulteur enregistre une intervention de vendanges avec tractoriste et bennes
  VitiExpState.interventions.push({
    id: 'int-vendange-crayeres',
    organization_id: ORG_ID,
    campaign_id: CAMP_2027,
    task_id: 'task-vendange',
    intervention_date: '2027-09-12',
    duration_hours: 5,
    parcelles: [{ parcelle_id: 'p-crayeres', surface_worked: 0.8425 }],
    workers: [{ worker_id: 'w-1', hours: 5, hourly_cost_snapshot: 20.00, labor_cost: 100.00 }],
    equipment: [{ equipment_id: 'eq-1', hours: 5, hourly_cost_snapshot: 30.00, equipment_cost: 150.00 }],
    inputs: []
  });

  const costSummary = calculateParcelleCostSummary('p-crayeres', CAMP_2027);
  // 5 300 € + 250 € = 5 550 €
  assert.strictEqual(costSummary.totalCost, 5550.00);

  // Nettoyage
  VitiExpState.interventions = VitiExpState.interventions.filter(i => i.id !== 'int-vendange-crayeres');
});

it('13. Gestion rigoureuse de 0 kg récolté (pas de division par zéro)', () => {
  const sVierge = calculateParcelleHarvestSummary('p-vierge', CAMP_2027);
  assert.strictEqual(sVierge.totalWeightKg, 0);
  assert.strictEqual(sVierge.yieldKgHa, 0);
  assert.strictEqual(sVierge.costPerKg, null);
});

it('14. Étanchéité stricte entre campagnes différentes (2026 vs 2027)', () => {
  // Ajout d'une pesée sur la campagne 2026
  VitiExpState.harvests.push({
    id: 'h-2026',
    organization_id: ORG_ID,
    campaign_id: CAMP_2026,
    parcelle_id: 'p-crayeres',
    harvest_date: '2026-09-10',
    harvested_surface: 0.8425,
    weight_kg: 8000.00
  });

  // Pour la campagne 2027 : total reste 7 420 kg
  const s2027 = calculateParcelleHarvestSummary('p-crayeres', CAMP_2027);
  assert.strictEqual(s2027.totalWeightKg, 7420.00);

  // Pour la campagne 2026 : total est 8 000 kg
  const s2026 = calculateParcelleHarvestSummary('p-crayeres', CAMP_2026);
  assert.strictEqual(s2026.totalWeightKg, 8000.00);
});

it('15. Permissions : can_view_costs = false masque les coûts pour les ouvriers/vendangeurs', () => {
  VitiExpState.members[0].can_view_costs = false;

  renderVendangesView();
  const kpiCostKgEl = documentMock.getElementById('kpi-vendanges-avg-cost-kg');
  assert.ok(kpiCostKgEl.innerHTML.includes('🔒') || kpiCostKgEl.innerHTML.includes('Confidentiel'));

  // Rétablissement
  VitiExpState.members[0].can_view_costs = true;
});

it('16. Mode Hors-ligne : mise en file d\'attente locale d\'une pesée et synchronisation', () => {
  windowMock.navigator.onLine = false;
  VitiExpState.offlineQueue = [];

  // Simulation d'ajout hors connexion
  documentMock.getElementById('exp-harvest-edit-id').value = '';
  documentMock.getElementById('exp-harvest-date').value = '2027-09-16';
  documentMock.getElementById('exp-harvest-parcelle').value = 'p-crayeres';
  documentMock.getElementById('exp-harvest-weight').value = '500';
  documentMock.getElementById('exp-harvest-surface').value = '0.8425';
  documentMock.getElementById('exp-harvest-cepage').value = 'Chardonnay';
  documentMock.getElementById('exp-harvest-team-size').value = '4';
  documentMock.getElementById('exp-harvest-duration').value = '2';
  documentMock.getElementById('exp-harvest-notes').value = 'Fin de parcelle';

  saveHarvest();

  assert.strictEqual(VitiExpState.offlineQueue.length, 1);
  assert.strictEqual(VitiExpState.offlineQueue[0].type, 'save_harvest');
  assert.strictEqual(VitiExpState.offlineQueue[0].data.weight_kg, 500);

  // Rétablissement en ligne
  windowMock.navigator.onLine = true;
  VitiExpState.harvests = VitiExpState.harvests.filter(h => h.notes !== 'Fin de parcelle');
  VitiExpState.offlineQueue = [];
});

it('17. Modification et suppression d\'une pesée avec recalcul immédiat', () => {
  // Poids actuel Crayères : 7 420 kg
  const initialSummary = calculateParcelleHarvestSummary('p-crayeres', CAMP_2027);
  assert.strictEqual(initialSummary.totalWeightKg, 7420.00);

  // Suppression de la pesée h-3 (1 130 kg)
  deleteHarvest('h-3');

  const afterDeleteSummary = calculateParcelleHarvestSummary('p-crayeres', CAMP_2027);
  // 7 420 - 1 130 = 6 290 kg
  assert.strictEqual(afterDeleteSummary.totalWeightKg, 6290.00);
  assert.strictEqual(afterDeleteSummary.weighingsCount, 2);
  // Recalcul immédiat du rendement : 6 290 / 0.8425 = 7 466 kg/ha
  assert.strictEqual(afterDeleteSummary.yieldKgHa, Math.round(6290 / 0.8425));
  // Recalcul immédiat du coût/kg : 5 300 / 6 290 = 0.8426... €/kg
  assert.strictEqual(afterDeleteSummary.costPerKg.toFixed(2), '0.84');
});

it('18. Export CSV de la campagne vendanges', () => {
  // Vérification de la fonction d'export CSV
  assert.strictEqual(typeof exportHarvestsCSV, 'function');
  // Pas d'erreur lors de l'exécution
  exportHarvestsCSV();
});

it('19. Non-régression Phases 3, 4, 5 et Prestation', () => {
  assert.strictEqual(typeof windowMock.switchAppMode, 'function');
  assert.strictEqual(typeof windowMock.calculateParcelleCostSummary, 'function');
  assert.strictEqual(typeof windowMock.calculateExploitationWeightedAverageCostPerHa, 'function');
  assert.ok(VitiExpState.parcelles.length >= 2);
  assert.ok(VitiExpState.campaigns.length >= 2);
});

console.log('\n==============================================================');
console.log(`📊 BILAN DES TESTS PHASE 6 : ${passedTests} / ${totalTests} réussis`);
if (failedTests > 0) {
  console.error(`🚨 ÉCHEC : ${failedTests} test(s) ont échoué !`);
  process.exit(1);
} else {
  console.log('🎉 TOUS LES TESTS SONT AU VERT ! PHASE 6 TOTALEMENT VALIDÉE.');
  console.log('==============================================================');
}
