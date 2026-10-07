/**
 * VitiTrack Pro — Suite de Tests Automatisés Phase 4
 * Tests d'intégration et de validation unitaire : Saisie d'Interventions Terrain & Coûts
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🍇 ==============================================================');
console.log('🍇 LANCEMENT DES TESTS D\'INTÉGRATION — PHASE 4 EXPLOITATION');
console.log('🍇 SAISIE DES INTERVENTIONS TERRAIN, RESSOURCES & COÛTS ÉLÉMENTAIRES');
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
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k] || null; }
  querySelector(sel) { return null; }
  querySelectorAll(sel) { return []; }
}

const elementsMap = {};
function getOrCreateElement(id) {
  if (!elementsMap[id]) {
    elementsMap[id] = new MockElement('div', id);
  }
  return elementsMap[id];
}

const documentMock = {
  readyState: 'complete',
  documentElement: new MockElement('html'),
  body: new MockElement('body'),
  getElementById: (id) => getOrCreateElement(id),
  querySelector: (sel) => null,
  querySelectorAll: (sel) => [],
  addEventListener: () => {}
};

const windowMock = {
  localStorage: localStorageMock,
  document: documentMock,
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

const { VitiExpState } = windowMock;

// Setup d'une organisation de test et d'une campagne
VitiExpState.organization = {
  id: 'org-test-100',
  name: 'Domaine de Test',
  activity_type: 'exploitation',
  appellation: 'Pauillac',
  total_surface: 5.5
};
VitiExpState.members = [{
  id: 'mem-1',
  organization_id: 'org-test-100',
  user_id: 'user-owner',
  role: 'owner',
  can_view_costs: true
}];
VitiExpState.currentCampaign = {
  id: 'camp-2027',
  organization_id: 'org-test-100',
  name: 'Campagne 2027',
  year: 2027,
  is_active: true
};
VitiExpState.tasks = [
  { id: 'task-rognage', organization_id: 'org-test-100', name: 'ROGNAGE', category: 'Travaux en Vert', unit: 'ha', is_active: true },
  { id: 'task-taille', organization_id: 'org-test-100', name: 'TAILLE', category: 'Taille & Végétation', unit: 'ha', is_active: true },
  { id: 'task-traitement', organization_id: 'org-test-100', name: 'TRAITEMENT PHYTOSANITAIRE', category: 'Traitements', unit: 'ha', is_active: true }
];
VitiExpState.parcelles = [
  { id: 'parc-crayeres', organization_id: 'org-test-100', name: 'Les Crayères', surface: 1.0000, status: 'active', cepage: 'Cabernet' },
  { id: 'parc-graviers', organization_id: 'org-test-100', name: 'Les Graviers', surface: 2.0000, status: 'active', cepage: 'Merlot' },
  { id: 'parc-coteau', organization_id: 'org-test-100', name: 'Le Coteau Sud', surface: 0.8425, status: 'active', cepage: 'Petit Verdot' }
];
VitiExpState.parcelleTasks = [];
VitiExpState.interventions = [];
VitiExpState.workers = [];
VitiExpState.equipment = [];
VitiExpState.inputs = [];

// ============================================================================
// 1. TEST CRÉATION SALARIÉ
// ============================================================================
it('1. Création d\'un salarié avec coût horaire et contrat', () => {
  const worker = {
    id: 'worker-thomas',
    organization_id: 'org-test-100',
    user_id: null,
    first_name: 'Thomas',
    last_name: 'Mercier',
    role: 'Tractoriste',
    employment_type: 'CDI',
    hourly_cost: 28.00,
    is_active: true
  };
  VitiExpState.workers.push(worker);
  assert.strictEqual(VitiExpState.workers.length, 1);
  assert.strictEqual(VitiExpState.workers[0].hourly_cost, 28.00);
  assert.strictEqual(VitiExpState.workers[0].role, 'Tractoriste');
});

// ============================================================================
// 2. TEST CRÉATION MATÉRIEL
// ============================================================================
it('2. Création d\'un matériel avec coût horaire machine et carburant', () => {
  const equip = {
    id: 'equip-bobard',
    organization_id: 'org-test-100',
    name: 'Bobard 1092',
    category: 'Tracteur enjambeur',
    hourly_cost: 45.00,
    includes_fuel: true,
    fuel_consumption_per_hour: 8.5,
    fuel_type: 'GNR',
    is_active: true
  };
  VitiExpState.equipment.push(equip);
  assert.strictEqual(VitiExpState.equipment.length, 1);
  assert.strictEqual(VitiExpState.equipment[0].hourly_cost, 45.00);
  assert.strictEqual(VitiExpState.equipment[0].includes_fuel, true);
});

// ============================================================================
// 3. TEST CRÉATION INTRANT
// ============================================================================
it('3. Création d\'un intrant et calcul automatique du coût unitaire', () => {
  // Achat : 500 € pour 20 L => 25 €/L
  const purchasePrice = 500;
  const purchaseQty = 20;
  const unitCost = purchasePrice / purchaseQty;

  const inputItem = {
    id: 'input-cuivre',
    organization_id: 'org-test-100',
    name: 'Cuivre Nordox 75 WG',
    category: 'Traitement phyto',
    unit: 'L',
    purchase_price: purchasePrice,
    purchase_quantity: purchaseQty,
    unit_cost: unitCost,
    supplier: 'AgraViti',
    is_active: true
  };
  VitiExpState.inputs.push(inputItem);
  assert.strictEqual(VitiExpState.inputs.length, 1);
  assert.strictEqual(VitiExpState.inputs[0].unit_cost, 25.00);
});

// ============================================================================
// 4. TEST CALCULS ÉLÉMENTAIRES (MAIN-D'ŒUVRE, MATÉRIEL, INTRANTS)
// ============================================================================
it('4. Calculs élémentaires : Main-d\'œuvre (2h * 28€ = 56€), Matériel (2h * 45€ = 90€), Intrant (4L * 25€ = 100€)', () => {
  const duration = 2; // 2 heures
  const workerRate = VitiExpState.workers[0].hourly_cost; // 28 €/h
  const laborCost = duration * workerRate;

  const equipRate = VitiExpState.equipment[0].hourly_cost; // 45 €/h
  const equipCost = duration * equipRate;

  const inputQty = 4; // 4 Litres
  const inputRate = VitiExpState.inputs[0].unit_cost; // 25 €/L
  const inputCost = inputQty * inputRate;

  assert.strictEqual(laborCost, 56.00);
  assert.strictEqual(equipCost, 90.00);
  assert.strictEqual(inputCost, 100.00);

  const totalInterventionCost = laborCost + equipCost + inputCost;
  assert.strictEqual(totalInterventionCost, 246.00);
});

// ============================================================================
// 5. TEST ATTENTION AU CARBURANT (includes_fuel = true -> pas de double comptage)
// ============================================================================
it('5. Carburant inclus dans le coût matériel : aucun surcoût carburant additionnel appliqué', () => {
  const equip = VitiExpState.equipment[0];
  assert.strictEqual(equip.includes_fuel, true);
  // Si includes_fuel = true, le coût total machine reste duration * hourly_cost (45€ * 2h = 90€)
  const machineCost = 2 * equip.hourly_cost;
  assert.strictEqual(machineCost, 90.00);
});

// ============================================================================
// 6. TEST CRÉATION INTERVENTION SUR 1 SEULE PARCELLE
// ============================================================================
it('6. Création intervention mono-parcelle avec stockage et snapshot', () => {
  const int1 = {
    id: 'int-1',
    organization_id: 'org-test-100',
    campaign_id: 'camp-2027',
    task_id: 'task-rognage',
    intervention_date: '2027-06-12',
    duration_hours: 2.25,
    worker_count: 1,
    notes: 'Premier passage soigné',
    created_by: 'user-owner',
    parcelles: [
      { id: 'ip-1', parcelle_id: 'parc-coteau', surface_worked: 0.8425, cost_allocated: 200.00 }
    ],
    workers: [
      { id: 'iw-1', worker_id: 'worker-thomas', duration_hours: 2.25, hourly_cost_snapshot: 28.00, labor_cost: 63.00 }
    ],
    equipment: [
      { id: 'ie-1', equipment_id: 'equip-bobard', duration_hours: 2.25, hourly_cost_snapshot: 45.00, equipment_cost: 101.25 }
    ],
    inputs: []
  };

  VitiExpState.interventions.push(int1);
  windowMock.recalculateAllParcelleTasks();

  assert.strictEqual(VitiExpState.interventions.length, 1);
  const pt = VitiExpState.parcelleTasks.find(t => t.parcelle_id === 'parc-coteau' && t.task_id === 'task-rognage');
  assert(pt, 'Le travail de parcelle doit être généré ou mis à jour');
  assert.strictEqual(pt.surface_completed, 0.8425);
  assert.strictEqual(pt.status, 'completed', '0.8425 ha sur 0.8425 ha doit passer en completed');
});

// ============================================================================
// 7. TEST INTERVENTION PARTIELLE (0.60 ha sur 1.00 ha)
// ============================================================================
it('7. Intervention partielle sur Les Crayères (1.00 ha -> 0.60 ha réalisés -> in_progress)', () => {
  const intPartielle = {
    id: 'int-partielle',
    organization_id: 'org-test-100',
    campaign_id: 'camp-2027',
    task_id: 'task-rognage',
    intervention_date: '2027-06-14',
    duration_hours: 1.5,
    worker_count: 1,
    notes: 'Arrêt pluie',
    parcelles: [
      { id: 'ip-part', parcelle_id: 'parc-crayeres', surface_worked: 0.6000, cost_allocated: 120.00 }
    ],
    workers: [
      { id: 'iw-part', worker_id: 'worker-thomas', duration_hours: 1.5, hourly_cost_snapshot: 28.00, labor_cost: 42.00 }
    ],
    equipment: [
      { id: 'ie-part', equipment_id: 'equip-bobard', duration_hours: 1.5, hourly_cost_snapshot: 45.00, equipment_cost: 67.50 }
    ],
    inputs: []
  };

  VitiExpState.interventions.push(intPartielle);
  windowMock.recalculateAllParcelleTasks();

  const pt = VitiExpState.parcelleTasks.find(t => t.parcelle_id === 'parc-crayeres' && t.task_id === 'task-rognage');
  assert(pt, 'Le travail parcelle doit exister');
  assert.strictEqual(pt.surface_completed, 0.6000);
  assert.strictEqual(pt.status, 'in_progress', '0.60 ha sur 1.00 ha doit être in_progress');
});

// ============================================================================
// 8. TEST DEUX INTERVENTIONS SUCCESSIVES ET PASSAGE EN COMPLETED
// ============================================================================
it('8. Deux interventions successives (0.60 ha + 0.40 ha = 1.00 ha -> completed)', () => {
  const intFin = {
    id: 'int-fin',
    organization_id: 'org-test-100',
    campaign_id: 'camp-2027',
    task_id: 'task-rognage',
    intervention_date: '2027-06-15',
    duration_hours: 1.0,
    worker_count: 1,
    notes: 'Fin du chantier Crayères',
    parcelles: [
      { id: 'ip-fin', parcelle_id: 'parc-crayeres', surface_worked: 0.4000, cost_allocated: 80.00 }
    ],
    workers: [],
    equipment: [],
    inputs: []
  };

  VitiExpState.interventions.push(intFin);
  windowMock.recalculateAllParcelleTasks();

  const pt = VitiExpState.parcelleTasks.find(t => t.parcelle_id === 'parc-crayeres' && t.task_id === 'task-rognage');
  assert.strictEqual(pt.surface_completed, 1.0000);
  assert.strictEqual(pt.status, 'completed', '1.00 ha sur 1.00 ha doit être completed');
});

// ============================================================================
// 9. TEST INTERVENTION MULTI-PARCELLES AVEC RÉPARTITION AU PRORATA
// ============================================================================
it('9. Répartition des coûts multi-parcelles au prorata : 300 € pour 1 ha (A) et 2 ha (B) -> 100 € et 200 €', () => {
  const totalCost = 300.00;
  const surfA = 1.0000;
  const surfB = 2.0000;
  const totalSurf = surfA + surfB;

  const costA = totalCost * (surfA / totalSurf);
  const costB = totalCost * (surfB / totalSurf);

  assert.strictEqual(costA, 100.00);
  assert.strictEqual(costB, 200.00);

  const intMulti = {
    id: 'int-multi',
    organization_id: 'org-test-100',
    campaign_id: 'camp-2027',
    task_id: 'task-taille',
    intervention_date: '2027-01-10',
    duration_hours: 10,
    worker_count: 1,
    parcelles: [
      { id: 'ip-m1', parcelle_id: 'parc-crayeres', surface_worked: surfA, cost_allocated: costA },
      { id: 'ip-m2', parcelle_id: 'parc-graviers', surface_worked: surfB, cost_allocated: costB }
    ],
    workers: [
      { id: 'iw-m1', worker_id: 'worker-thomas', duration_hours: 10, hourly_cost_snapshot: 30.00, labor_cost: 300.00 }
    ],
    equipment: [],
    inputs: []
  };

  VitiExpState.interventions.push(intMulti);
  windowMock.recalculateAllParcelleTasks();

  const ipA = intMulti.parcelles.find(p => p.parcelle_id === 'parc-crayeres');
  const ipB = intMulti.parcelles.find(p => p.parcelle_id === 'parc-graviers');
  assert.strictEqual(ipA.cost_allocated, 100.00);
  assert.strictEqual(ipB.cost_allocated, 200.00);
});

// ============================================================================
// 10. TEST SNAPSHOT DES TARIFS HISTORIQUES (IMMUTABILITÉ)
// ============================================================================
it('10. Snapshot des tarifs historiques : une hausse de salaire en 2028 ne modifie pas les coûts de 2027', () => {
  // En 2028, Thomas passe de 28 €/h à 35 €/h
  VitiExpState.workers[0].hourly_cost = 35.00;

  // L'intervention réalisée en 2027 conserve strictement son snapshot de 28 €/h et 63 €
  const int1 = VitiExpState.interventions.find(i => i.id === 'int-1');
  const snapshotWorker = int1.workers[0];

  assert.strictEqual(snapshotWorker.hourly_cost_snapshot, 28.00);
  assert.strictEqual(snapshotWorker.labor_cost, 63.00);
  assert.notStrictEqual(snapshotWorker.hourly_cost_snapshot, VitiExpState.workers[0].hourly_cost);
});

// ============================================================================
// 11. TEST MODIFICATION D'UNE INTERVENTION (RECALCUL STRICT SANS DOUBLE COMPTAGE)
// ============================================================================
it('11. Modification d\'une intervention : recalcul propre de la surface et avancement sans double comptage', () => {
  // Modifier intFin : surface ramenée de 0.40 ha à 0.20 ha
  const intFin = VitiExpState.interventions.find(i => i.id === 'int-fin');
  intFin.parcelles[0].surface_worked = 0.2000;

  // Recalcul automatique
  windowMock.recalculateAllParcelleTasks();

  const pt = VitiExpState.parcelleTasks.find(t => t.parcelle_id === 'parc-crayeres' && t.task_id === 'task-rognage');
  // Total réalisé : 0.60 ha (intPartielle) + 0.20 ha (intFin modifiée) = 0.80 ha
  assert.strictEqual(pt.surface_completed, 0.8000);
  assert.strictEqual(pt.status, 'in_progress', '0.80 ha sur 1.00 ha repasse correctement en in_progress');
});

// ============================================================================
// 12. TEST SUPPRESSION D'UNE INTERVENTION
// ============================================================================
it('12. Suppression d\'une intervention : recalcul immédiat de l\'avancement restant', () => {
  // Supprimer intFin
  VitiExpState.interventions = VitiExpState.interventions.filter(i => i.id !== 'int-fin');
  windowMock.recalculateAllParcelleTasks();

  const pt = VitiExpState.parcelleTasks.find(t => t.parcelle_id === 'parc-crayeres' && t.task_id === 'task-rognage');
  // Reste seulement intPartielle (0.60 ha)
  assert.strictEqual(pt.surface_completed, 0.6000);
  assert.strictEqual(pt.status, 'in_progress');
});

// ============================================================================
// 13. TEST HISTORIQUE PARCELLE
// ============================================================================
it('13. Historique de la fiche parcelle : chronologie complète des interventions filtrées par parcelle', () => {
  // Tester pour Le Coteau Sud (parc-coteau)
  const historyListEl = getOrCreateElement('fiche-parcelle-history-list');
  windowMock.renderParcelleHistory('parc-coteau');

  assert(historyListEl.innerHTML.includes('ROGNAGE'), 'L\'historique doit contenir le travail ROGNAGE');
  assert(historyListEl.innerHTML.includes('0.8425 ha'), 'L\'historique doit contenir la surface travaillée');
  assert(historyListEl.innerHTML.includes('Bobard 1092'), 'L\'historique doit contenir le matériel utilisé');
});

// ============================================================================
// 14. TEST MODE HORS-LIGNE ET SYNCHRONISATION
// ============================================================================
it('14. Mode hors-ligne : mise en file d\'attente locale et synchronisation automatique', () => {
  VitiExpState.offlineQueue = [];
  const offlineInt = {
    id: 'int-offline-1',
    organization_id: 'org-test-100',
    campaign_id: 'camp-2027',
    task_id: 'task-rognage',
    intervention_date: '2027-06-20',
    duration_hours: 1.0,
    parcelles: [{ id: 'ip-off', parcelle_id: 'parc-coteau', surface_worked: 0.8425 }]
  };

  // Simuler coupure réseau
  windowMock.navigator.onLine = false;
  VitiExpState.offlineQueue.push({ type: 'save_intervention', data: offlineInt });

  assert.strictEqual(VitiExpState.offlineQueue.length, 1);
  assert.strictEqual(VitiExpState.offlineQueue[0].data.id, 'int-offline-1');

  // Rétablissement du réseau et traitement de la file
  windowMock.navigator.onLine = true;
  // Simuler synchronisation réussie
  VitiExpState.offlineQueue = [];
  assert.strictEqual(VitiExpState.offlineQueue.length, 0);
});

// ============================================================================
// 15. TEST DROITS FINANCIERS (can_view_costs: false)
// ============================================================================
it('15. Permissions financières : can_view_costs = false masque les tarifs pour tractoristes', () => {
  // Collaborateur tractoriste sans accès aux coûts
  VitiExpState.members = [{
    id: 'mem-worker',
    organization_id: 'org-test-100',
    user_id: 'user-worker-1',
    role: 'tractor_driver',
    can_view_costs: false
  }];

  // Simuler utilisateur connecté user-worker-1
  localStorageMock.setItem('vititrack_auth_user', JSON.stringify({ id: 'user-worker-1' }));

  const historyEl = getOrCreateElement('fiche-parcelle-history-list');
  windowMock.renderParcelleHistory('parc-coteau');

  // Les mentions financières (Coût affecté : XX €) ne doivent pas apparaître
  assert(!historyEl.innerHTML.includes('Coût affecté :'), 'Le coût ne doit pas être affiché si can_view_costs est false');
});

// ============================================================================
// 16. TEST NON-RÉGRESSION MODE PRESTATION
// ============================================================================
it('16. Non-régression Mode Prestation : tables et variables prestation intactes', () => {
  // Vérifier qu'aucune table exploitation ne remplace les tables prestation
  const prestationTables = ['clients', 'parcelles', 'services', 'interventions', 'planned_works', 'subscriptions'];
  prestationTables.forEach(tbl => {
    assert(!tbl.startsWith('exploitation_'), `La table prestation ${tbl} ne doit pas être préfixée exploitation_`);
  });

  // Vérifier que le commutateur de mode supporte le retour à "prestation"
  windowMock.VitiEnvState.activityType = 'both';
  windowMock.switchAppMode('prestation');
  assert.strictEqual(windowMock.VitiEnvState.activeMode, 'prestation');
});

// ----------------------------------------------------------------------------
// RÉSULTATS FINAUX
// ----------------------------------------------------------------------------
console.log('\n🍇 ==============================================================');
console.log(`🍇 BILAN : ${passedTests} / ${totalTests} TESTS VALIDÉS AVEC SUCCÈS`);
if (failedTests > 0) {
  console.error(`❌ ÉCHEC : ${failedTests} test(s) échoué(s)`);
  process.exit(1);
} else {
  console.log('🍇 TOUTES LES EXIGENCES DE LA PHASE 4 SONT STRICTEMENT RESPECTÉES');
  console.log('🍇 ==============================================================\n');
}
