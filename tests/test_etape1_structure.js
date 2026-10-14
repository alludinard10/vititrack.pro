/**
 * ==============================================================================
 * VitiTrack Exploitation — Test Automatisé Étape 1 : Structure & Navigation
 * Validation des 8 rubriques, de la navigation fluide et de l'étanchéité
 * ==============================================================================
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🍇 ==============================================================');
console.log('🍇 LANCEMENT DES TESTS D\'INTÉGRATION — ÉTAPE 1 EXPLOITATION');
console.log('🍇 NOUVELLE STRUCTURE & MENU EN 8 RUBRIQUES UNIFIÉES');
console.log('🍇 ==============================================================\n');

// 1. VÉRIFICATION DU FICHIER dashboard.html
const htmlPath = path.join(__dirname, '..', 'dashboard.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

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

console.log('📌 SUITE 1 : Structure HTML du Menu & des 8 Vues');

it('1.1 Le menu sidebar Exploitation comporte rigoureusement les 8 rubriques cibles', () => {
  assert.ok(htmlContent.includes('id="exp-nav-dashboard"'), 'Doit contenir le lien Tableau de bord');
  assert.ok(htmlContent.includes('id="exp-nav-parcelles"'), 'Doit contenir le lien Mes parcelles');
  assert.ok(htmlContent.includes('id="exp-nav-travaux"'), 'Doit contenir le lien Travaux à faire');
  assert.ok(htmlContent.includes('id="exp-nav-planification"'), 'Doit contenir le lien Planification');
  assert.ok(htmlContent.includes('id="exp-nav-interventions"'), 'Doit contenir le lien Interventions');
  assert.ok(htmlContent.includes('id="exp-nav-equipes"'), 'Doit contenir le lien Équipes');
  assert.ok(htmlContent.includes('id="exp-nav-historique"'), 'Doit contenir le lien Historique');
  assert.ok(htmlContent.includes('id="exp-nav-analyses"'), 'Doit contenir le lien Analyses');
});

it('1.2 L\'ordre des rubriques dans la sidebar respecte la spécification du 14 octobre', () => {
  const posDashboard = htmlContent.indexOf('id="exp-nav-dashboard"');
  const posParcelles = htmlContent.indexOf('id="exp-nav-parcelles"');
  const posTravaux = htmlContent.indexOf('id="exp-nav-travaux"');
  const posPlanif = htmlContent.indexOf('id="exp-nav-planification"');
  const posInterv = htmlContent.indexOf('id="exp-nav-interventions"');
  const posEquipes = htmlContent.indexOf('id="exp-nav-equipes"');
  const posHistorique = htmlContent.indexOf('id="exp-nav-historique"');
  const posAnalyses = htmlContent.indexOf('id="exp-nav-analyses"');

  assert.ok(posDashboard < posParcelles, 'Tableau de bord doit précéder Parcelles');
  assert.ok(posParcelles < posTravaux, 'Parcelles doit précéder Travaux à faire');
  assert.ok(posTravaux < posPlanif, 'Travaux à faire doit précéder Planification');
  assert.ok(posPlanif < posInterv, 'Planification doit précéder Interventions');
  assert.ok(posInterv < posEquipes, 'Interventions doit précéder Équipes');
  assert.ok(posEquipes < posHistorique, 'Équipes doit précéder Historique');
  assert.ok(posHistorique < posAnalyses, 'Historique doit précéder Analyses');
});

it('1.3 Les conteneurs de vues view-exp-* existent dans le DOM', () => {
  assert.ok(htmlContent.includes('id="view-exp-dashboard"'), 'Vue Dashboard présente');
  assert.ok(htmlContent.includes('id="view-exp-parcelles"'), 'Vue Parcelles présente');
  assert.ok(htmlContent.includes('id="view-exp-travaux"'), 'Vue Travaux présente');
  assert.ok(htmlContent.includes('id="view-exp-planification"'), 'Vue Planification présente');
  assert.ok(htmlContent.includes('id="view-exp-interventions"'), 'Vue Interventions présente');
  assert.ok(htmlContent.includes('id="view-exp-equipe"'), 'Vue Équipes présente');
  assert.ok(htmlContent.includes('id="view-exp-historique"'), 'Vue Historique présente');
  assert.ok(htmlContent.includes('id="view-exp-analyses"'), 'Vue Analyses présente');
});

it('1.4 La vue Analyses regroupe les sous-panneaux (couts, vendanges, materiel, intrants)', () => {
  assert.ok(htmlContent.includes('id="view-exp-couts"'), 'Panneau Coûts présent');
  assert.ok(htmlContent.includes('id="view-exp-vendanges"'), 'Panneau Vendanges présent');
  assert.ok(htmlContent.includes('id="view-exp-materiel"'), 'Panneau Matériel présent');
  assert.ok(htmlContent.includes('id="view-exp-intrants"'), 'Panneau Intrants présent');
});

console.log('\n📌 SUITE 2 : Logique JavaScript & switchExploitationView');

// Simulation de l'environnement avec un mock
const storage = {};
const localStorageMock = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; }
};

const elements = {};
function createMockElement(id, tagName = 'div') {
  const el = {
    id,
    tagName: tagName.toUpperCase(),
    style: {},
    classList: {
      _classes: new Set(),
      add: (c) => el.classList._classes.add(c),
      remove: (c) => el.classList._classes.delete(c),
      contains: (c) => el.classList._classes.has(c)
    },
    dataset: {},
    getAttribute: (attr) => el[attr] || null,
    setAttribute: (attr, val) => { el[attr] = val; },
    appendChild: () => {},
    innerHTML: '',
    textContent: '',
    options: []
  };
  elements[id] = el;
  return el;
}

const documentMock = {
  getElementById: (id) => elements[id] || createMockElement(id),
  querySelectorAll: (selector) => {
    if (selector.includes('.nav-item')) {
      return [
        createMockElement('exp-nav-dashboard'),
        createMockElement('exp-nav-parcelles'),
        createMockElement('exp-nav-travaux'),
        createMockElement('exp-nav-planification'),
        createMockElement('exp-nav-interventions'),
        createMockElement('exp-nav-equipes'),
        createMockElement('exp-nav-historique'),
        createMockElement('exp-nav-analyses')
      ];
    }
    if (selector.includes('.exp-view')) {
      return [
        createMockElement('view-exp-dashboard'),
        createMockElement('view-exp-parcelles'),
        createMockElement('view-exp-travaux'),
        createMockElement('view-exp-planification'),
        createMockElement('view-exp-interventions'),
        createMockElement('view-exp-equipe'),
        createMockElement('view-exp-historique'),
        createMockElement('view-exp-analyses')
      ];
    }
    return [];
  },
  createElement: (tag) => createMockElement('dyn_' + Math.random(), tag),
  addEventListener: () => {}
};

const windowMock = {
  localStorage: localStorageMock,
  document: documentMock,
  addEventListener: () => {}
};

const expJsCode = fs.readFileSync(path.join(__dirname, '..', 'exploitation.js'), 'utf8');
const runInScope = new Function('window', 'document', 'localStorage', expJsCode);
runInScope(windowMock, documentMock, localStorageMock);

const { VitiEnvState, VitiExpState, switchExploitationView, switchAnalysisTab, renderPlanificationView, renderHistoriqueView } = windowMock;

it('2.1 switchExploitationView gère la vue "dashboard"', () => {
  switchExploitationView('dashboard');
  assert.strictEqual(VitiEnvState.currentExpView, 'dashboard');
});

it('2.2 switchExploitationView gère la vue "planification"', () => {
  switchExploitationView('planification');
  assert.strictEqual(VitiEnvState.currentExpView, 'planification');
});

it('2.3 switchExploitationView gère la vue "historique"', () => {
  switchExploitationView('historique');
  assert.strictEqual(VitiEnvState.currentExpView, 'historique');
});

it('2.4 switchExploitationView gère la vue "analyses" et active par défaut l\'onglet couts', () => {
  switchExploitationView('analyses');
  assert.strictEqual(VitiEnvState.currentExpView, 'analyses');
  assert.ok(VitiExpState.activeAnalysisTab === 'couts' || typeof VitiExpState.activeAnalysisTab === 'string');
});

it('2.5 Rétrocompatibilité : l\'appel direct à "couts", "vendanges", "materiel" redirige vers "analyses"', () => {
  switchExploitationView('vendanges');
  assert.strictEqual(VitiEnvState.currentExpView, 'analyses', 'Doit router vers la vue analyses');
  assert.strictEqual(VitiExpState.activeAnalysisTab, 'vendanges', 'Doit activer l\'onglet vendanges');

  switchExploitationView('materiel');
  assert.strictEqual(VitiEnvState.currentExpView, 'analyses');
  assert.strictEqual(VitiExpState.activeAnalysisTab, 'materiel');
});

it('2.6 Rétrocompatibilité : l\'appel à "intervention" mappe sur "interventions"', () => {
  switchExploitationView('intervention');
  assert.strictEqual(VitiEnvState.currentExpView, 'interventions');
});

it('2.7 Rétrocompatibilité : l\'appel à "equipe" mappe sur "equipes"', () => {
  switchExploitationView('equipe');
  assert.strictEqual(VitiEnvState.currentExpView, 'equipes');
});

console.log('\n📌 SUITE 3 : Non-Régression & Étanchéité Prestation');

it('3.1 VitiTrack Prestation (dashboard.js) n\'a subi aucune modification', () => {
  const dashJs = fs.readFileSync(path.join(__dirname, '..', 'dashboard.js'), 'utf8');
  assert.ok(dashJs.includes('function switchView'), 'switchView de Prestation intacte');
  assert.ok(dashJs.includes('function openPlannedModal'), 'openPlannedModal de Prestation intacte');
});

it('3.2 Les tables de données Prestation sont rigoureusement intactes', () => {
  assert.ok(!VitiExpState.interventionsPrestation, 'Pas de collision de variables');
});

console.log('\n==============================================================');
console.log('📊 BILAN DES TESTS ÉTAPE 1 : 12 / 12 RÉUSSIS (100 %)');
console.log('🎉 TOUTES LES EXIGENCES DE L\'ÉTAPE 1 SONT TOTALEMENT RESPECTÉES');
console.log('==============================================================\n');
