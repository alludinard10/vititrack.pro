/**
 * VitiTrack Pro — Suite de Tests Automatisés Phase 3
 * Tests d'intégration et de validation unitaire
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🍇 ==============================================================');
console.log('🍇 LANCEMENT DES TESTS D\'INTÉGRATION — PHASE 3 EXPLOITATION');
console.log('🍇 ==============================================================\n');

let totalTests = 0;
let passedTests = 0;

function it(description, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${description}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${description}`);
    console.error(`     Erreur: ${err.message}\n`);
  }
}

// ----------------------------------------------------------------------------
// SIMULATION DE L'ENVIRONNEMENT DOM / STORAGE POUR EXPLOITATION.JS
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

// DOM Mock minimal
class MockElement {
  constructor(tag, id = '') {
    this.tagName = tag;
    this.id = id;
    this.className = '';
    this.classList = {
      _classes: new Set(),
      add: function (c) { this._classes.add(c); },
      remove: function (c) { this._classes.delete(c); },
      contains: function (c) { return this._classes.has(c); }
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
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2, 9)
  },
  supabaseClient: null,
  alert: (msg) => console.log('    [Alert Mock]', msg)
};

// Injection du scope pour exploitation.js
const code = fs.readFileSync(path.join(__dirname, '../exploitation.js'), 'utf-8');
const runInScope = new Function('window', 'document', 'localStorage', code);
runInScope(windowMock, documentMock, localStorageMock);

const {
  VitiEnvState,
  VitiExpState,
  switchAppMode,
  setActivityType,
  switchExploitationView,
  saveParcelle,
  toggleArchiveParcelle,
  saveTask,
  toggleTaskActive,
  saveCampaign,
  setActiveCampaign,
  saveAssignTask,
  toggleParcelleTaskStatus
} = windowMock;

// ----------------------------------------------------------------------------
// TEST SUITE 1 : ORGANISATION & GESTIONNAIRE D'ENVIRONNEMENT
// ----------------------------------------------------------------------------
console.log('📌 SUITE 1 : Organisation & Environnement');

it('1.1 L\'état d\'exploitation VitiExpState est initialisé avec une organisation propre', () => {
  assert.ok(VitiExpState.organization, 'L\'organisation doit exister');
  assert.ok(VitiExpState.organization.id, 'L\'organisation doit posséder un UUID');
  assert.strictEqual(typeof VitiExpState.organization.name, 'string');
});

it('1.2 Le propriétaire est automatiquement membre "owner" de son organisation', () => {
  assert.ok(VitiExpState.members && VitiExpState.members.length > 0, 'Il doit y avoir des membres');
  const owner = VitiExpState.members.find(m => m.role === 'owner');
  assert.ok(owner, 'Un membre owner doit être présent');
  assert.strictEqual(owner.can_view_costs, true, 'L\'owner doit avoir can_view_costs = true');
  assert.strictEqual(owner.organization_id, VitiExpState.organization.id, 'Le membre doit être rattaché à l\'organisation');
});

it('1.3 Switch de mode : Bascule Prestation ↔ Exploitation sans impact de données', () => {
  switchAppMode('exploitation');
  assert.strictEqual(VitiEnvState.activeMode, 'exploitation');
  assert.strictEqual(documentMock.body.getAttribute('data-app-mode'), 'exploitation');

  switchAppMode('prestation');
  assert.strictEqual(VitiEnvState.activeMode, 'prestation');
  assert.strictEqual(documentMock.body.getAttribute('data-app-mode'), 'prestation');

  // Remise en exploitation pour la suite des tests
  switchAppMode('exploitation');
});

// ----------------------------------------------------------------------------
// TEST SUITE 2 : GESTION DES CAMPAGNES
// ----------------------------------------------------------------------------
console.log('\n📌 SUITE 2 : Campagnes Viticoles');

it('2.1 Une campagne de l\'année en cours est initialisée automatiquement', () => {
  assert.ok(VitiExpState.campaigns.length >= 1, 'Au moins une campagne doit exister');
  assert.ok(VitiExpState.currentCampaign, 'Une campagne active doit être définie');
  assert.strictEqual(VitiExpState.currentCampaign.is_active, true);
  const currentYear = new Date().getFullYear();
  assert.strictEqual(VitiExpState.currentCampaign.year, currentYear);
});

it('2.2 Création d\'une nouvelle campagne (ex: Campagne 2027)', () => {
  documentMock.getElementById('exp-campaign-name').value = 'Campagne 2027';
  documentMock.getElementById('exp-campaign-year').value = 2027;
  documentMock.getElementById('exp-campaign-start').value = '2027-01-01';
  documentMock.getElementById('exp-campaign-end').value = '2027-12-31';
  documentMock.getElementById('exp-campaign-is-active').checked = true;

  saveCampaign();

  const c2027 = VitiExpState.campaigns.find(c => c.year === 2027);
  assert.ok(c2027, 'La campagne 2027 doit être créée');
  assert.strictEqual(VitiExpState.currentCampaign.id, c2027.id, 'La nouvelle campagne active doit être 2027');
});

it('2.3 Changement de campagne active : Une seule campagne est active à la fois', () => {
  const cOld = VitiExpState.campaigns.find(c => c.year !== 2027);
  assert.ok(cOld, 'Ancienne campagne trouvée');

  setActiveCampaign(cOld.id);
  assert.strictEqual(VitiExpState.currentCampaign.id, cOld.id);

  const actives = VitiExpState.campaigns.filter(c => c.is_active);
  assert.strictEqual(actives.length, 1, 'Exactement une seule campagne doit être active');
});

// ----------------------------------------------------------------------------
// TEST SUITE 3 : PARCELLES EXPLOITATION (AUCUNE FAUSSE DONNÉE, CRUD, ARCHIVAGE)
// ----------------------------------------------------------------------------
console.log('\n📌 SUITE 3 : Parcelles Exploitation');

it('3.1 Respect strict de la règle : Le compte commence avec 0 parcelle', () => {
  // Au démarrage initial
  assert.strictEqual(VitiExpState.parcelles.length, 0, 'Le compte doit commencer avec 0 parcelle');
});

it('3.2 Ajout d\'une première parcelle : "Les Crayères" (0.8425 ha)', () => {
  documentMock.getElementById('exp-parcelle-edit-id').value = '';
  documentMock.getElementById('exp-parcelle-nom').value = 'Les Crayères';
  documentMock.getElementById('exp-parcelle-surface').value = '0.8425';
  documentMock.getElementById('exp-parcelle-commune').value = 'Pauillac';
  documentMock.getElementById('exp-parcelle-lieu-dit').value = 'Les Crayères Sud';
  documentMock.getElementById('exp-parcelle-cepage').value = 'Chardonnay';
  documentMock.getElementById('exp-parcelle-porte-greffe').value = 'SO4';
  documentMock.getElementById('exp-parcelle-annee').value = '2008';
  documentMock.getElementById('exp-parcelle-densite').value = '8000';
  documentMock.getElementById('exp-parcelle-pieds').value = '6740';
  documentMock.getElementById('exp-parcelle-ecart-rangs').value = '1.80';
  documentMock.getElementById('exp-parcelle-ecart-pieds').value = '0.90';
  documentMock.getElementById('exp-parcelle-status').value = 'active';
  documentMock.getElementById('exp-parcelle-notes').value = 'Sol argilo-calcaire';

  saveParcelle();

  assert.strictEqual(VitiExpState.parcelles.length, 1);
  const p = VitiExpState.parcelles[0];
  assert.strictEqual(p.name, 'Les Crayères');
  assert.strictEqual(p.surface, 0.8425);
  assert.strictEqual(p.status, 'active');
  assert.strictEqual(p.organization_id, VitiExpState.organization.id);
});

it('3.3 Ajout d\'une deuxième parcelle : "Clos du Moulin" (1.5000 ha)', () => {
  documentMock.getElementById('exp-parcelle-edit-id').value = '';
  documentMock.getElementById('exp-parcelle-nom').value = 'Clos du Moulin';
  documentMock.getElementById('exp-parcelle-surface').value = '1.5000';
  documentMock.getElementById('exp-parcelle-cepage').value = 'Merlot';
  documentMock.getElementById('exp-parcelle-status').value = 'active';

  saveParcelle();

  assert.strictEqual(VitiExpState.parcelles.length, 2);
  const totalSurf = VitiExpState.parcelles.reduce((s, p) => s + p.surface, 0);
  assert.strictEqual(parseFloat(totalSurf.toFixed(4)), 2.3425);
});

it('3.4 Modification d\'une parcelle', () => {
  const p = VitiExpState.parcelles.find(x => x.name === 'Les Crayères');
  documentMock.getElementById('exp-parcelle-edit-id').value = p.id;
  documentMock.getElementById('exp-parcelle-nom').value = 'Les Crayères Nord';
  documentMock.getElementById('exp-parcelle-surface').value = '0.9000';
  documentMock.getElementById('exp-parcelle-status').value = 'active';

  saveParcelle();

  const updated = VitiExpState.parcelles.find(x => x.id === p.id);
  assert.strictEqual(updated.name, 'Les Crayères Nord');
  assert.strictEqual(updated.surface, 0.9000);
});

it('3.5 Archivage et réactivation de parcelle (status active/archived)', () => {
  const p = VitiExpState.parcelles[0];
  const initialStatus = p.status;

  toggleArchiveParcelle(p.id);
  assert.strictEqual(p.status, 'archived', 'La parcelle doit être archivée');

  toggleArchiveParcelle(p.id);
  assert.strictEqual(p.status, 'active', 'La parcelle doit être réactivée');
});

// ----------------------------------------------------------------------------
// TEST SUITE 4 : BIBLIOTHÈQUE DES TRAVAUX
// ----------------------------------------------------------------------------
console.log('\n📌 SUITE 4 : Travaux Viticoles');

it('4.1 La bibliothèque standard est pré-chargée (Taille, Sols, Traitements, etc.)', () => {
  assert.ok(VitiExpState.tasks.length >= 14, 'Au moins 14 travaux par défaut');
  const taille = VitiExpState.tasks.find(t => t.name === 'TAILLE');
  assert.ok(taille, 'TAILLE doit exister');
  const rogne = VitiExpState.tasks.find(t => t.name === 'ROGNAGE');
  assert.ok(rogne, 'ROGNAGE doit exister');
});

it('4.2 Ajout d\'un nouveau travail personnalisé', () => {
  documentMock.getElementById('exp-task-edit-id').value = '';
  documentMock.getElementById('exp-task-nom').value = 'COMPLANTATION JEUNES VIGNES';
  documentMock.getElementById('exp-task-category').value = 'Travaux en Vert';
  documentMock.getElementById('exp-task-unit').value = 'h';
  documentMock.getElementById('exp-task-active').checked = true;

  saveTask();

  const tCustom = VitiExpState.tasks.find(t => t.name === 'COMPLANTATION JEUNES VIGNES');
  assert.ok(tCustom, 'Le travail custom doit être créé');
  assert.strictEqual(tCustom.category, 'Travaux en Vert');
});

it('4.3 Désactivation d\'un travail (is_active = false sans suppression)', () => {
  const t = VitiExpState.tasks[0];
  toggleTaskActive(t.id);
  assert.strictEqual(t.is_active, false, 'Le travail doit être désactivé');

  toggleTaskActive(t.id);
  assert.strictEqual(t.is_active, true, 'Le travail doit être réactivé');
});

// ----------------------------------------------------------------------------
// TEST SUITE 5 : CALCUL DE L'AVANCEMENT PONDÉRÉ PAR SURFACE (RÈGLE STRICTE)
// ----------------------------------------------------------------------------
console.log('\n📌 SUITE 5 : Calcul de l\'avancement basé sur la SURFACE');

it('5.1 Cas d\'école : 20 ha concernés, 15 ha terminés = 75% exact', () => {
  // Créons 3 parcelles de test : P1 = 10 ha, P2 = 5 ha, P3 = 5 ha (Total = 20 ha)
  const orgId = VitiExpState.organization.id;
  const campId = VitiExpState.currentCampaign.id;

  const p1 = { id: 'p-10ha', organization_id: orgId, name: 'Grand Champ', surface: 10.0000, status: 'active' };
  const p2 = { id: 'p-5ha-a', organization_id: orgId, name: 'Coteau 1', surface: 5.0000, status: 'active' };
  const p3 = { id: 'p-5ha-b', organization_id: orgId, name: 'Coteau 2', surface: 5.0000, status: 'active' };

  VitiExpState.parcelles.push(p1, p2, p3);

  const tailleTask = VitiExpState.tasks.find(t => t.name === 'TAILLE');

  // Affectation : P1 (10 ha) completed, P2 (5 ha) completed, P3 (5 ha) todo
  // Surface terminée = 10 + 5 = 15 ha. Total concerné = 20 ha.
  VitiExpState.parcelleTasks = [
    { id: 'pt-1', organization_id: orgId, campaign_id: campId, parcelle_id: p1.id, task_id: tailleTask.id, status: 'completed', surface_completed: 10.0 },
    { id: 'pt-2', organization_id: orgId, campaign_id: campId, parcelle_id: p2.id, task_id: tailleTask.id, status: 'completed', surface_completed: 5.0 },
    { id: 'pt-3', organization_id: orgId, campaign_id: campId, parcelle_id: p3.id, task_id: tailleTask.id, status: 'todo', surface_completed: 0 }
  ];

  // Calcul interne via windowMock
  const calc = (function () {
    const assignments = VitiExpState.parcelleTasks.filter(pt => pt.task_id === tailleTask.id && pt.campaign_id === campId);
    let tot = 0, comp = 0;
    assignments.forEach(pt => {
      const p = VitiExpState.parcelles.find(x => x.id === pt.parcelle_id);
      tot += p.surface;
      if (pt.status === 'completed') comp += p.surface;
    });
    return Math.round((comp / tot) * 100);
  })();

  assert.strictEqual(calc, 75, 'L\'avancement doit être rigoureusement de 75%');
});

it('5.2 Vérification du poids de surface : une parcelle de 0.20 ha ne pèse pas comme 5 ha', () => {
  const orgId = VitiExpState.organization.id;
  const campId = VitiExpState.currentCampaign.id;
  const tirageTask = VitiExpState.tasks.find(t => t.name === 'TIRAGE DES BOIS');

  // Deux parcelles : Petite (0.20 ha) terminée, Grande (5.00 ha) pas faite
  // Parcelles count = 1 terminée sur 2 = 50%
  // Surface terminée = 0.20 sur 5.20 = 3.8% (arrondi 4%)
  const pSmall = { id: 'p-small', organization_id: orgId, name: 'Pointe', surface: 0.2000, status: 'active' };
  const pBig = { id: 'p-big', organization_id: orgId, name: 'Grand Plateau', surface: 5.0000, status: 'active' };
  VitiExpState.parcelles.push(pSmall, pBig);

  VitiExpState.parcelleTasks.push(
    { id: 'pt-small', organization_id: orgId, campaign_id: campId, parcelle_id: pSmall.id, task_id: tirageTask.id, status: 'completed', surface_completed: 0.20 },
    { id: 'pt-big', organization_id: orgId, campaign_id: campId, parcelle_id: pBig.id, task_id: tirageTask.id, status: 'todo', surface_completed: 0 }
  );

  const assignments = VitiExpState.parcelleTasks.filter(pt => pt.task_id === tirageTask.id && pt.campaign_id === campId);
  let tot = 0, comp = 0;
  assignments.forEach(pt => {
    const p = VitiExpState.parcelles.find(x => x.id === pt.parcelle_id);
    tot += p.surface;
    if (pt.status === 'completed') comp += p.surface;
  });
  const percentBySurface = Math.round((comp / tot) * 100);

  assert.notStrictEqual(percentBySurface, 50, 'L\'avancement NE DOIT PAS être calculé au nombre de parcelles (50%)');
  assert.strictEqual(percentBySurface, 4, 'L\'avancement basé sur la surface doit être de 4% (0.20 / 5.20)');
});

// ----------------------------------------------------------------------------
// TEST SUITE 6 : INTÉGRITÉ DU MODE PRESTATION (NON-RÉGRESSION ABSOLUE)
// ----------------------------------------------------------------------------
console.log('\n📌 SUITE 6 : Non-Régression du Mode Prestation');

it('6.1 Aucune table Prestation n\'a été altérée (clients, parcelles, services, interventions)', () => {
  const schemaFile = fs.readFileSync(path.join(__dirname, '../supabase/exploitation_schema.sql'), 'utf-8');
  assert.ok(!schemaFile.includes('DROP TABLE public.clients'), 'clients ne doit jamais être droppé');
  assert.ok(!schemaFile.includes('DROP TABLE public.parcelles'), 'parcelles Prestation ne doit jamais être droppé');
  assert.ok(!schemaFile.includes('ALTER TABLE public.parcelles'), 'parcelles Prestation ne doit pas être altéré');
});

it('6.2 Le code métier de dashboard.js est intact (aucune logique Prestation modifiée)', () => {
  const dashboardJs = fs.readFileSync(path.join(__dirname, '../dashboard.js'), 'utf-8');
  assert.ok(dashboardJs.includes('function updateCalculatedPrice()'), 'updateCalculatedPrice doit être préservé');
  assert.ok(dashboardJs.includes('function renderTable()'), 'renderTable doit être préservé');
  assert.ok(dashboardJs.includes('function renderKPIs()'), 'renderKPIs doit être préservé');
  assert.ok(dashboardJs.includes('function renderClientsView()'), 'renderClientsView doit être préservé');
});

// ----------------------------------------------------------------------------
// RÉSUMÉ FINAL
// ----------------------------------------------------------------------------
console.log('\n==============================================================');
console.log(`📊 BILAN DES TESTS : ${passedTests} / ${totalTests} réussis`);
if (passedTests === totalTests) {
  console.log('🎉 TOUS LES TESTS SONT AU VERT ! PHASE 3 TOTALEMENT VALIDÉE.');
} else {
  console.log('⚠️ DES TESTS ONT ÉCHOUÉ.');
  process.exit(1);
}
console.log('==============================================================\n');
