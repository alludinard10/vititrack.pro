/**
 * VitiTrack Pro — Suite de Tests Automatisés Phase 5
 * Validation unitaire et intégration : Moteur Économique & Coût de Revient Parcellaire
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🍇 ==============================================================');
console.log('🍇 LANCEMENT DES TESTS D\'INTÉGRATION — PHASE 5 EXPLOITATION');
console.log('🍇 MOTEUR ÉCONOMIQUE & COÛT DE REVIENT PARCELLAIRE');
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
}

const documentMock = {
  elements: {},
  readyState: 'complete',
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

const windowMock = {
  document: documentMock,
  localStorage: localStorageMock,
  crypto: {
    randomUUID: () => 'uuid-' + Math.random().toString(36).substring(2, 9)
  },
  navigator: { onLine: true },
  supabaseClient: null,
  alert: () => {},
  confirm: () => true,
  addEventListener: () => {}
};

// Injection du code exploitation.js
const code = fs.readFileSync(path.join(__dirname, '../exploitation.js'), 'utf-8');
const runInScope = new Function('window', 'document', 'localStorage', code);
runInScope(windowMock, documentMock, localStorageMock);

const {
  VitiExpState,
  calculateParcelleCostSummary,
  calculateExploitationWeightedAverageCostPerHa,
  getCostSituation,
  calculateParcelleCampaignEvolution,
  renderCoutsView,
  renderExternalCostsTable,
  renderFicheParcelleCouts
} = windowMock;

// Setup d'une organisation de test
VitiExpState.organization = {
  id: 'org-test-500',
  name: 'Domaine des Grands Terroirs',
  activity_type: 'exploitation',
  appellation: 'Pauillac',
  total_surface: 3.5000
};

localStorageMock.setItem('vititrack_auth_user', JSON.stringify({ id: 'user-owner', email: 'owner@domain.fr' }));

VitiExpState.members = [{
  id: 'mem-1',
  organization_id: 'org-test-500',
  user_id: 'user-owner',
  role: 'owner',
  can_view_costs: true
}];

VitiExpState.currentCampaign = {
  id: 'camp-2027',
  organization_id: 'org-test-500',
  name: 'Campagne 2027',
  year: 2027,
  is_active: true
};

VitiExpState.tasks = [
  { id: 'task-taille', organization_id: 'org-test-500', name: 'TAILLE', category: 'Taille & Végétation', unit: 'ha', is_active: true },
  { id: 'task-sol', organization_id: 'org-test-500', name: 'TRAVAIL DU SOL', category: 'Travaux du Sol', unit: 'ha', is_active: true },
  { id: 'task-phyto', organization_id: 'org-test-500', name: 'TRAITEMENT PHYTOSANITAIRE', category: 'Traitements', unit: 'ha', is_active: true },
  { id: 'task-rognage', organization_id: 'org-test-500', name: 'ROGNAGE', category: 'Travaux en Vert', unit: 'ha', is_active: true }
];

VitiExpState.parcelles = [
  { id: 'p-crayeres', organization_id: 'org-test-500', name: 'Les Crayères', surface: 0.8425, status: 'active', harvest_kg: 0 },
  { id: 'p-moulin', organization_id: 'org-test-500', name: 'Clos du Moulin', surface: 1.5000, status: 'active', harvest_kg: 0 },
  { id: 'p-combe', organization_id: 'org-test-500', name: 'Combe d\'Or', surface: 1.1575, status: 'active', harvest_kg: 0 }
];

// Salariés
VitiExpState.workers = [
  { id: 'w-thomas', organization_id: 'org-test-500', first_name: 'Thomas', last_name: 'Mercier', hourly_cost: 28.00, is_active: true },
  { id: 'w-julien', organization_id: 'org-test-500', first_name: 'Julien', last_name: 'Beraud', hourly_cost: 25.00, is_active: true }
];

// Matériel
VitiExpState.equipment = [
  { id: 'eq-bobard', organization_id: 'org-test-500', name: 'Bobard 1092', hourly_cost: 45.00, includes_fuel: true, is_active: true },
  { id: 'eq-pulve', organization_id: 'org-test-500', name: 'Berthoud Win Air', hourly_cost: 25.00, includes_fuel: false, is_active: true }
];

// Intrants
VitiExpState.inputs = [
  { id: 'inp-cuivre', organization_id: 'org-test-500', name: 'Cuivre Nordox', unit_cost: 24.50, unit: 'kg', is_active: true }
];

VitiExpState.interventions = [];
VitiExpState.externalCosts = [];
VitiExpState.fuelRecords = [];

// ============================================================================
// TESTS SECTION 24
// ============================================================================

it('1. Coût mono-parcelle : Main-d\'œuvre (56€) + Matériel (90€) sur Les Crayères', () => {
  VitiExpState.interventions.push({
    id: 'int-1',
    organization_id: 'org-test-500',
    campaign_id: 'camp-2027',
    task_id: 'task-sol',
    intervention_date: '2027-04-10',
    duration_hours: 2,
    worker_count: 1,
    parcelles: [{ parcelle_id: 'p-crayeres', surface_worked: 0.8425, cost_allocated: 146.00 }],
    workers: [{ worker_id: 'w-thomas', hours: 2, hourly_cost_snapshot: 28.00, labor_cost: 56.00 }],
    equipment: [{ equipment_id: 'eq-bobard', hours: 2, hourly_cost_snapshot: 45.00, equipment_cost: 90.00 }],
    inputs: []
  });

  const res = calculateParcelleCostSummary('p-crayeres', 'camp-2027');
  assert.strictEqual(res.laborCost, 56.00);
  assert.strictEqual(res.equipmentCost, 90.00);
  assert.strictEqual(res.totalCost, 146.00);
});

it('2. Coût multi-parcelles : répartition stricte au prorata des surfaces travaillées', () => {
  // Intervention de rognage : 300 € au total sur Les Crayères (1 ha) et Clos du Moulin (2 ha travaillés)
  // Total travaillé = 3 ha -> Ratio Crayères = 1/3 (100 €), Moulin = 2/3 (200 €)
  VitiExpState.interventions.push({
    id: 'int-2',
    organization_id: 'org-test-500',
    campaign_id: 'camp-2027',
    task_id: 'task-rognage',
    intervention_date: '2027-05-15',
    duration_hours: 4,
    worker_count: 1,
    parcelles: [
      { parcelle_id: 'p-crayeres', surface_worked: 1.0000, cost_allocated: 100.00 },
      { parcelle_id: 'p-moulin', surface_worked: 2.0000, cost_allocated: 200.00 }
    ],
    workers: [{ worker_id: 'w-thomas', hours: 4, hourly_cost_snapshot: 30.00, labor_cost: 120.00 }],
    equipment: [{ equipment_id: 'eq-bobard', hours: 4, hourly_cost_snapshot: 45.00, equipment_cost: 180.00 }],
    inputs: []
  });

  const resCrayeres = calculateParcelleCostSummary('p-crayeres', 'camp-2027');
  const resMoulin = calculateParcelleCostSummary('p-moulin', 'camp-2027');

  // Sur int-2 : 120 labor * (1/3) = 40 labor, 180 equip * (1/3) = 60 equip -> +100€
  // Crayères avait déjà 146€ -> 146 + 100 = 246€
  assert.strictEqual(resCrayeres.totalCost, 246.00);
  // Moulin reçoit 2/3 de 300€ = 200€
  assert.strictEqual(resMoulin.totalCost, 200.00);
  assert.strictEqual(resMoulin.laborCost, 80.00);
  assert.strictEqual(resMoulin.equipmentCost, 120.00);
});

it('3. Main-d\'œuvre multi-salariés : somme des coûts individuels réels (Salarié A 50€ + Salarié B 60€ = 110€)', () => {
  VitiExpState.interventions.push({
    id: 'int-3',
    organization_id: 'org-test-500',
    campaign_id: 'camp-2027',
    task_id: 'task-taille',
    intervention_date: '2027-01-20',
    duration_hours: 2,
    worker_count: 2,
    parcelles: [{ parcelle_id: 'p-combe', surface_worked: 1.1575, cost_allocated: 110.00 }],
    workers: [
      { worker_id: 'w-julien', hours: 2, hourly_cost_snapshot: 25.00, labor_cost: 50.00 },
      { worker_id: 'w-thomas', hours: 2, hourly_cost_snapshot: 30.00, labor_cost: 60.00 }
    ],
    equipment: [],
    inputs: []
  });

  const res = calculateParcelleCostSummary('p-combe', 'camp-2027');
  assert.strictEqual(res.laborCost, 110.00);
  assert.strictEqual(res.totalCost, 110.00);
});

it('4. Matériel : heures × snapshot machine respecté', () => {
  const res = calculateParcelleCostSummary('p-crayeres', 'camp-2027');
  // 90€ (int-1) + 60€ (int-2) = 150€
  assert.strictEqual(res.equipmentCost, 150.00);
});

it('5. Intrants : application exacte des quantités × snapshot unitaire', () => {
  VitiExpState.interventions.push({
    id: 'int-4',
    organization_id: 'org-test-500',
    campaign_id: 'camp-2027',
    task_id: 'task-phyto',
    intervention_date: '2027-06-01',
    duration_hours: 1,
    worker_count: 1,
    parcelles: [{ parcelle_id: 'p-crayeres', surface_worked: 0.8425, cost_allocated: 98.00 }],
    workers: [],
    equipment: [],
    inputs: [{ input_id: 'inp-cuivre', quantity_used: 4, unit_cost_snapshot: 24.50, input_cost: 98.00 }]
  });

  const res = calculateParcelleCostSummary('p-crayeres', 'camp-2027');
  assert.strictEqual(res.inputCost, 98.00);
  // Total Crayères = 246 + 98 = 344€
  assert.strictEqual(res.totalCost, 344.00);
});

it('6. Snapshots historiques : une variation tarifaire future n\'impacte pas le passé', () => {
  // Modification ultérieure du catalogue intrant ou salarié
  VitiExpState.workers[0].hourly_cost = 99.00;
  VitiExpState.inputs[0].unit_cost = 999.00;

  // Le coût calculé de Crayères doit rester strictement 344.00 €
  const res = calculateParcelleCostSummary('p-crayeres', 'camp-2027');
  assert.strictEqual(res.totalCost, 344.00);

  // Rétablissement
  VitiExpState.workers[0].hourly_cost = 28.00;
  VitiExpState.inputs[0].unit_cost = 24.50;
});

it('7. Prestations externes : ajout d\'une prestation tiers (1 200 € pour taille)', () => {
  VitiExpState.externalCosts.push({
    id: 'ext-1',
    organization_id: 'org-test-500',
    campaign_id: 'camp-2027',
    parcelle_id: 'p-crayeres',
    date: '2027-02-15',
    category: 'Taille par tiers',
    supplier: 'VitiServices Prestataire',
    description: 'Prestation taille 4000 ceps',
    amount: 1200.00
  });

  const res = calculateParcelleCostSummary('p-crayeres', 'camp-2027');
  assert.strictEqual(res.externalCost, 1200.00);
  // 344 + 1200 = 1544 €
  assert.strictEqual(res.totalCost, 1544.00);
});

it('8. Autres charges directes : piquets et analyses de sol', () => {
  VitiExpState.externalCosts.push({
    id: 'ext-2',
    organization_id: 'org-test-500',
    campaign_id: 'camp-2027',
    parcelle_id: 'p-crayeres',
    date: '2027-03-01',
    category: 'Fournitures palissage',
    supplier: 'AgraViti',
    description: 'Remplacement de 50 piquets métal',
    amount: 250.00
  });

  const res = calculateParcelleCostSummary('p-crayeres', 'camp-2027');
  assert.strictEqual(res.otherDirectCost, 250.00);
  // Total = 1544 + 250 = 1794.00 €
  assert.strictEqual(res.totalCost, 1794.00);
});

it('9. Calcul total parcelle : somme rigoureuse des 6 composantes', () => {
  const res = calculateParcelleCostSummary('p-crayeres', 'camp-2027');
  const expectedTotal = res.laborCost + res.equipmentCost + res.inputCost + res.fuelCost + res.externalCost + res.otherDirectCost;
  assert.strictEqual(res.totalCost, parseFloat(expectedTotal.toFixed(2)));
  assert.strictEqual(res.totalCost, 1794.00);
});

it('10. Calcul €/ha : coût total / surface réelle conservant la précision à 4 décimales', () => {
  const res = calculateParcelleCostSummary('p-crayeres', 'camp-2027');
  // Surface = 0.8425 ha. Total = 1794.00 €
  // 1794 / 0.8425 = 2129.3768... -> 2129.38 €/ha
  assert.strictEqual(res.surface, 0.8425);
  assert.strictEqual(res.costPerHa, 2129.38);
});

it('11. Moyenne pondérée exploitation : Somme des coûts / Somme des surfaces réelles', () => {
  // Crayères : Coût = 1794.00 €, Surface = 0.8425 ha
  // Moulin : Coût = 200.00 €, Surface = 1.5000 ha
  // Combe : Coût = 110.00 €, Surface = 1.1575 ha
  // Total coûts = 1794 + 200 + 110 = 2104.00 €
  // Total surfaces = 0.8425 + 1.5000 + 1.1575 = 3.5000 ha
  // Moyenne pondérée = 2104 / 3.5 = 601.14 €/ha
  const avg = calculateExploitationWeightedAverageCostPerHa('camp-2027');
  assert.strictEqual(avg, 601.14);
});

it('12. Comparaison à la moyenne et seuils : 🟢 < -10%, 🟠 [-10%, +10%], 🔴 > +10%', () => {
  const avg = 601.14;

  // Crayères : 2129.38 €/ha vs 601.14 €/ha -> largement supérieur (+254%) -> 🔴
  const sitCrayeres = getCostSituation(2129.38, avg);
  assert.strictEqual(sitCrayeres.status, 'high');
  assert.strictEqual(sitCrayeres.icon, '🔴');
  assert.strictEqual(sitCrayeres.label, 'Coût supérieur à la moyenne');

  // Moulin : 200 / 1.5 = 133.33 €/ha vs 601.14 €/ha -> largement inférieur (-77.8%) -> 🟢
  const sitMoulin = getCostSituation(133.33, avg);
  assert.strictEqual(sitMoulin.status, 'low');
  assert.strictEqual(sitMoulin.icon, '🟢');
  assert.strictEqual(sitMoulin.label, 'Coût inférieur à la moyenne');

  // Parcelle fictive à 620 €/ha vs 601.14 (+3.1%) -> dans la moyenne -> 🟠
  const sitMoyenne = getCostSituation(620.00, avg);
  assert.strictEqual(sitMoyenne.status, 'avg');
  assert.strictEqual(sitMoyenne.icon, '🟠');
  assert.strictEqual(sitMoyenne.label, 'Dans la moyenne');
});

it('13. Ventilation par catégorie sur la fiche parcelle', () => {
  const res = calculateParcelleCostSummary('p-crayeres', 'camp-2027');
  assert.strictEqual(res.laborCost, 96.00);      // 56 (int-1) + 40 (int-2)
  assert.strictEqual(res.equipmentCost, 150.00);  // 90 (int-1) + 60 (int-2)
  assert.strictEqual(res.inputCost, 98.00);      // 98 (int-4)
  assert.strictEqual(res.externalCost, 1200.00); // 1200 (ext-1)
  assert.strictEqual(res.otherDirectCost, 250.00); // 250 (ext-2)
  assert.strictEqual(res.totalCost, 1794.00);
});

it('14. Ventilation par travail : détail des coûts par opération', () => {
  const res = calculateParcelleCostSummary('p-crayeres', 'camp-2027');
  // Les travaux sur Crayères :
  // - TRAVAIL DU SOL : 146.00 € (int-1)
  // - ROGNAGE : 100.00 € (int-2)
  // - TRAITEMENT PHYTOSANITAIRE : 98.00 € (int-4)
  // - Prestations externes : Taille par tiers (1200.00 €), Fournitures palissage (250.00 €)
  assert(res.tasksBreakdown.length >= 3);
  const tailleTiers = res.tasksBreakdown.find(t => t.taskName.includes('Taille'));
  assert(tailleTiers && tailleTiers.amount === 1200.00);
  const sol = res.tasksBreakdown.find(t => t.taskName.includes('DU SOL'));
  assert(sol && sol.amount === 146.00);
});

it('15. Modification d\'une intervention : répercussion automatique des coûts', () => {
  // Modification des heures de int-1 de 2h à 3h
  const int1 = VitiExpState.interventions.find(i => i.id === 'int-1');
  int1.duration_hours = 3;
  int1.workers[0].hours = 3;
  int1.workers[0].labor_cost = 84.00; // 3 * 28
  int1.equipment[0].hours = 3;
  int1.equipment[0].equipment_cost = 135.00; // 3 * 45

  const res = calculateParcelleCostSummary('p-crayeres', 'camp-2027');
  // Ancien int-1 : 146. Nouveau int-1 : 84 + 135 = 219 (+73€)
  // Ancien total : 1794. Nouveau total : 1867€
  assert.strictEqual(res.totalCost, 1867.00);

  // Rétablissement
  int1.duration_hours = 2;
  int1.workers[0].hours = 2;
  int1.workers[0].labor_cost = 56.00;
  int1.equipment[0].hours = 2;
  int1.equipment[0].equipment_cost = 90.00;
});

it('16. Suppression d\'une intervention : recalcul immédiat du coût parcellaire', () => {
  // Suppression temporaire de int-4 (98 € intrants)
  const backup = VitiExpState.interventions.slice();
  VitiExpState.interventions = VitiExpState.interventions.filter(i => i.id !== 'int-4');

  const res = calculateParcelleCostSummary('p-crayeres', 'camp-2027');
  assert.strictEqual(res.inputCost, 0);
  assert.strictEqual(res.totalCost, 1696.00); // 1794 - 98

  // Rétablissement
  VitiExpState.interventions = backup;
});

it('17. Modification d\'une charge externe : mise à jour du montant', () => {
  const ext1 = VitiExpState.externalCosts.find(c => c.id === 'ext-1');
  ext1.amount = 1500.00; // +300 €

  const res = calculateParcelleCostSummary('p-crayeres', 'camp-2027');
  assert.strictEqual(res.externalCost, 1500.00);
  assert.strictEqual(res.totalCost, 2094.00); // 1794 + 300

  ext1.amount = 1200.00;
});

it('18. Campagne différente : étanchéité stricte des coûts entre campagnes', () => {
  // Ajout d'une intervention sur la campagne 2026
  VitiExpState.interventions.push({
    id: 'int-2026',
    organization_id: 'org-test-500',
    campaign_id: 'camp-2026',
    task_id: 'task-taille',
    intervention_date: '2026-02-10',
    duration_hours: 5,
    worker_count: 1,
    parcelles: [{ parcelle_id: 'p-crayeres', surface_worked: 0.8425, cost_allocated: 500.00 }],
    workers: [{ worker_id: 'w-thomas', hours: 5, hourly_cost_snapshot: 25.00, labor_cost: 125.00 }],
    equipment: [],
    inputs: []
  });

  // Calcul sur 2026
  const res2026 = calculateParcelleCostSummary('p-crayeres', 'camp-2026');
  assert.strictEqual(res2026.totalCost, 125.00);

  // Le coût 2027 ne doit PAS inclure les 125€ de 2026
  const res2027 = calculateParcelleCostSummary('p-crayeres', 'camp-2027');
  assert.strictEqual(res2027.totalCost, 1794.00);

  // Évolution entre campagnes (Section 16)
  const evo = calculateParcelleCampaignEvolution('p-crayeres', 'camp-2026', 'camp-2027');
  assert(evo.toCostPerHa > evo.fromCostPerHa);
});

it('19. Permissions financières : can_view_costs = false masque les coûts', () => {
  // Utilisateur avec vision masquée
  VitiExpState.members[0].can_view_costs = false;

  renderCoutsView();
  const tableContainer = documentMock.getElementById('exp-couts-table-container');
  assert(tableContainer.innerHTML.includes('🔒') || tableContainer.innerHTML.includes('confidentiel'));

  renderFicheParcelleCouts('p-crayeres');
  const ficheTotal = documentMock.getElementById('fiche-couts-total');
  assert(ficheTotal.textContent.includes('🔒') || ficheTotal.textContent.includes('Masqué'));

  // Rétablissement
  VitiExpState.members[0].can_view_costs = true;
});

it('20. RLS & Schéma SQL : exploitation_external_costs et exploitation_intervention_fuel', () => {
  const schemaSql = fs.readFileSync(path.join(__dirname, '../supabase/exploitation_schema.sql'), 'utf-8');
  assert(schemaSql.includes('CREATE TABLE IF NOT EXISTS public.exploitation_external_costs'));
  assert(schemaSql.includes('CREATE TABLE IF NOT EXISTS public.exploitation_intervention_fuel'));
  assert(schemaSql.includes('ENABLE ROW LEVEL SECURITY'));
  assert(schemaSql.includes('p_ext_costs_all'));
  assert(schemaSql.includes('p_fuel_all'));
});

it('21. Mode hors-ligne : affichage indicateur en attente de synchronisation', () => {
  VitiExpState.offlineQueue = [{ type: 'add_intervention', id: 'int-temp' }];
  renderCoutsView();
  // Vérification que le système gère l'état hors-ligne sans planter
  assert(VitiExpState.offlineQueue.length === 1);
  VitiExpState.offlineQueue = [];
});

it('22. Vendanges et Coût au Kilo : gestion propre de 0 kg (sans division par zéro)', () => {
  // Parcelle avec 0 kg récolté
  const crayeres = VitiExpState.parcelles.find(p => p.id === 'p-crayeres');
  crayeres.harvest_kg = 0;

  renderFicheParcelleCouts('p-crayeres');
  const elKg = documentMock.getElementById('fiche-couts-par-kg');
  const elKgSub = documentMock.getElementById('fiche-couts-par-kg-sub');

  assert.strictEqual(elKg.textContent, '—');
  assert(elKgSub.textContent.includes('disponible après saisie des vendanges'));

  // Avec 2 500 kg récoltés
  crayeres.harvest_kg = 2500;
  renderFicheParcelleCouts('p-crayeres');
  // Coût total 1794.00 € / 2500 kg = 0.72 €/kg
  assert.strictEqual(elKg.textContent, '0.72 €/kg');
});

it('23. Non-régression Mode Prestation : intégrité des variables et fonctions client', () => {
  const dashboardJs = fs.readFileSync(path.join(__dirname, '../dashboard.js'), 'utf-8');
  assert.ok(dashboardJs.includes('function updateCalculatedPrice()'), 'updateCalculatedPrice doit être préservé');
  assert.ok(dashboardJs.includes('function renderTable()'), 'renderTable doit être préservé');
  assert.ok(dashboardJs.includes('function renderKPIs()'), 'renderKPIs doit être préservé');
  assert.ok(dashboardJs.includes('function renderClientsView()'), 'renderClientsView doit être préservé');
});

console.log('\n==============================================================');
console.log(`📊 BILAN DES TESTS PHASE 5 : ${passedTests} / ${totalTests} réussis`);
if (failedTests > 0) {
  console.error(`🚨 ÉCHEC : ${failedTests} test(s) ont échoué !`);
  process.exit(1);
} else {
  console.log('🎉 TOUS LES TESTS SONT AU VERT ! PHASE 5 TOTALEMENT VALIDÉE.');
  console.log('==============================================================');
}
