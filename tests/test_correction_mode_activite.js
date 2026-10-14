/**
 * ==============================================================================
 * TEST DE VALIDATION AUTOMATISÉ : CORRECTION DU MODE EXPLOITATION UNIQUEMENT
 * Fichier : tests/test_correction_mode_activite.js
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// 1. Simulation de l'environnement DOM (JSDOM-like léger sans dépendance externe)
class MockClassList {
  constructor(el) {
    this.el = el;
    this.classes = new Set();
  }
  add(...cls) { cls.forEach(c => this.classes.add(c)); this._sync(); }
  remove(...cls) { cls.forEach(c => this.classes.delete(c)); this._sync(); }
  contains(c) { return this.classes.has(c); }
  toggle(c) {
    if (this.classes.has(c)) this.classes.delete(c);
    else this.classes.add(c);
    this._sync();
  }
  _sync() {
    this.el.className = Array.from(this.classes).join(' ');
  }
}

class MockElement {
  constructor(tagName = 'div', id = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.className = '';
    this.classList = new MockClassList(this);
    this.attributes = {};
    this.style = {};
    this.children = [];
    this.parentNode = null;
    this.textContent = '';
    this.innerHTML = '';
    this.value = '';
    this.checked = false;
    this.disabled = false;
  }
  setAttribute(attr, val) { this.attributes[attr] = String(val); }
  getAttribute(attr) { return this.attributes[attr] || null; }
  removeAttribute(attr) { delete this.attributes[attr]; }
  hasAttribute(attr) { return attr in this.attributes; }
  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) this.children.splice(idx, 1);
    child.parentNode = null;
    return child;
  }
  querySelector(sel) {
    const all = this.querySelectorAll(sel);
    return all.length > 0 ? all[0] : null;
  }
  querySelectorAll(sel) {
    const results = [];
    const check = (node) => {
      let match = false;
      if (sel.startsWith('#') && node.id === sel.slice(1)) match = true;
      else if (sel.startsWith('.') && node.classList.contains(sel.slice(1))) match = true;
      else if (sel === 'input[name="activity-setting-choice"]' && node.tagName === 'INPUT' && node.attributes.name === 'activity-setting-choice') match = true;
      else if (sel === 'input[name="activity-setting-choice"]:checked' && node.tagName === 'INPUT' && node.attributes.name === 'activity-setting-choice' && node.checked) match = true;
      else if (sel.includes('[data-exp-view]') && node.hasAttribute('data-exp-view')) match = true;
      else if (sel === '.activity-setting-label' && node.classList.contains('activity-setting-label')) match = true;
      else if (sel.includes('.exp-view') && node.classList.contains('exp-view')) match = true;
      else if (sel.includes('.mode-btn') && node.classList.contains('mode-btn')) match = true;
      else if (node.tagName.toLowerCase() === sel.toLowerCase()) match = true;

      if (match && node !== this) results.push(node);
      for (const child of node.children) check(child);
    };
    check(this);
    return results;
  }
  closest(sel) {
    let cur = this;
    while (cur) {
      if (sel.startsWith('.') && cur.classList && cur.classList.contains(sel.slice(1))) return cur;
      if (sel.startsWith('#') && cur.id === sel.slice(1)) return cur;
      if (cur.tagName && cur.tagName.toLowerCase() === sel.toLowerCase()) return cur;
      cur = cur.parentNode;
    }
    return null;
  }
}

// 2. Mock LocalStorage & Document
const localStorageStore = {};
const localStorageMock = {
  getItem: (k) => localStorageStore[k] || null,
  setItem: (k, v) => { localStorageStore[k] = String(v); },
  removeItem: (k) => { delete localStorageStore[k]; },
  clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }
};

const domElements = new Map();
function getOrCreateElement(id, tag = 'div') {
  if (!domElements.has(id)) {
    const el = new MockElement(tag, id);
    domElements.set(id, el);
  }
  return domElements.get(id);
}

const mockDocument = {
  documentElement: new MockElement('html', 'html-root'),
  body: new MockElement('body', 'body-root'),
  getElementById: (id) => domElements.get(id) || null,
  querySelector: (sel) => mockDocument.documentElement.querySelector(sel),
  querySelectorAll: (sel) => mockDocument.documentElement.querySelectorAll(sel),
  createElement: (tag) => new MockElement(tag),
  addEventListener: () => {}
};
mockDocument.documentElement.appendChild(mockDocument.body);

// Préparation des conteneurs fondamentaux
const prestaContainer = getOrCreateElement('prestation-views-container');
const expContainer = getOrCreateElement('exploitation-views-container');
const sidebarPresta = getOrCreateElement('sidebar-nav-prestation');
const sidebarExp = getOrCreateElement('sidebar-nav-exploitation');
const topbarAddClient = getOrCreateElement('topbar-add-client-btn', 'button');
const topbarCreateBtn = getOrCreateElement('btn-open-create-modal', 'button');
const modalActivity = getOrCreateElement('modal-activity-settings');
const optionsList = getOrCreateElement('activity-settings-options-list');
const alertBox = getOrCreateElement('activity-settings-alert');
const saveBtn = getOrCreateElement('btn-save-activity-setting', 'button');

mockDocument.body.appendChild(prestaContainer);
mockDocument.body.appendChild(expContainer);
mockDocument.body.appendChild(sidebarPresta);
mockDocument.body.appendChild(sidebarExp);
mockDocument.body.appendChild(topbarAddClient);
mockDocument.body.appendChild(topbarCreateBtn);
mockDocument.body.appendChild(modalActivity);
modalActivity.appendChild(alertBox);
modalActivity.appendChild(optionsList);
modalActivity.appendChild(saveBtn);

// Ajout des options d'activité dans le modal
['prestation', 'exploitation', 'both'].forEach(type => {
  const label = new MockElement('label');
  label.classList.add('activity-setting-label');
  const radio = new MockElement('input', `activity-choice-${type}`);
  radio.setAttribute('name', 'activity-setting-choice');
  radio.value = type;
  label.appendChild(radio);
  optionsList.appendChild(label);
  domElements.set(`activity-choice-${type}`, radio);
});

// Ajout des 8 rubriques dans sidebarExp
const EXP_RUBRICS = ['dashboard', 'parcelles', 'travaux', 'planification', 'interventions', 'equipes', 'historique', 'analyses'];
EXP_RUBRICS.forEach(r => {
  const item = new MockElement('a', `exp-nav-${r}`);
  item.classList.add('nav-item');
  item.setAttribute('data-exp-view', r);
  sidebarExp.appendChild(item);
  domElements.set(`exp-nav-${r}`, item);

  const view = new MockElement('div', `view-exp-${r}`);
  view.classList.add('exp-view');
  expContainer.appendChild(view);
  domElements.set(`view-exp-${r}`, view);
});

// Préparation globale Node.js pour évaluer exploitation.js
global.window = {
  location: { search: '', href: 'dashboard.html' },
  localStorage: localStorageMock,
  document: mockDocument,
  alert: (msg) => { global.__lastAlert = msg; },
  supabaseClient: {
    auth: {
      getSession: async () => ({
        data: {
          session: {
            user: {
              id: 'user-gerant-123',
              email: 'gerant@domaine.fr',
              app_metadata: { role: 'Gérant Exploitant', can_view_dashboard: true },
              user_metadata: { role: 'Gérant Exploitant' }
            }
          }
        }
      }),
      updateUser: async () => ({})
    }
  }
};
global.document = mockDocument;
global.localStorage = localStorageMock;

// Chargement du fichier exploitation.js
const codePath = path.join(__dirname, '../exploitation.js');
const code = fs.readFileSync(codePath, 'utf8');
eval(code);

let testCount = 0;
let passCount = 0;

function it(desc, fn) {
  testCount++;
  try {
    fn();
    passCount++;
    console.log(`  ✅ [PASS] ${desc}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(`     Erreur : ${err.message}`);
  }
}

async function itAsync(desc, fn) {
  testCount++;
  try {
    await fn();
    passCount++;
    console.log(`  ✅ [PASS] ${desc}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(`     Erreur : ${err.message}`);
  }
}

async function runTests() {
  console.log('\n🍇 ==============================================================');
  console.log('🍇 TESTS DE VÉRIFICATION : MODE EXPLOITATION UNIQUEMENT');
  console.log('🍇 ==============================================================\n');

  // TEST 1 : Sélection « Exploitation uniquement »
  await itAsync('1. Sélection « Exploitation uniquement » active automatiquement VitiTrack Exploitation', async () => {
    // Simuler le choix via selectActivityOption puis applyActivitySettingsChoice
    window.selectActivityOption('exploitation');
    await window.applyActivitySettingsChoice();

    assert.strictEqual(window.VitiEnvState.activityType, 'exploitation', 'activityType doit valoir exploitation');
    assert.strictEqual(window.VitiEnvState.activeMode, 'exploitation', 'activeMode doit valoir exploitation');
    assert.strictEqual(mockDocument.body.getAttribute('data-app-mode'), 'exploitation', 'body doit avoir data-app-mode="exploitation"');
    assert.strictEqual(mockDocument.body.getAttribute('data-activity-type'), 'exploitation', 'body doit avoir data-activity-type="exploitation"');
  });

  it('2. En mode « Exploitation uniquement », Prestation est strictement masqué et Exploitation est affiché', () => {
    assert.strictEqual(prestaContainer.style.display, 'none', '#prestation-views-container doit être masqué');
    assert.strictEqual(sidebarPresta.style.display, 'none', '#sidebar-nav-prestation doit être masqué');
    assert.strictEqual(topbarAddClient.style.display, 'none', '#topbar-add-client-btn doit être masqué');
    assert.strictEqual(expContainer.style.display, 'block', '#exploitation-views-container doit être affiché');
    assert.strictEqual(sidebarExp.style.display, 'flex', '#sidebar-nav-exploitation doit être affiché');
  });

  it('3. En mode « Exploitation uniquement », le tableau de bord Exploitation et les 8 rubriques sont accessibles', () => {
    assert.strictEqual(window.VitiEnvState.currentExpView, 'dashboard', 'La vue active par défaut doit être le dashboard');
    const viewExpDash = domElements.get('view-exp-dashboard');
    assert.strictEqual(viewExpDash.style.display, 'block', 'view-exp-dashboard doit avoir display block');
    assert.ok(viewExpDash.classList.contains('active'), 'view-exp-dashboard doit avoir la classe active');

    // Vérifier les 8 rubriques
    EXP_RUBRICS.forEach(r => {
      window.switchExploitationView(r, false);
      assert.strictEqual(window.VitiEnvState.currentExpView, r, `Doit pouvoir naviguer vers ${r}`);
      const v = domElements.get(`view-exp-${r}`);
      assert.strictEqual(v.style.display, 'block', `view-exp-${r} doit être visible`);
    });
  });

  it('4. Persistance : les paramètres d\'activité sont correctement enregistrés dans localStorage', () => {
    assert.strictEqual(localStorageMock.getItem('vititrack_activity_type'), 'exploitation');
    assert.strictEqual(localStorageMock.getItem('vititrack_active_mode'), 'exploitation');
  });

  // TEST 2 : Configuration « Prestation uniquement »
  await itAsync('5. Configuration « Prestation uniquement » active automatiquement VitiTrack Prestation', async () => {
    window.selectActivityOption('prestation');
    await window.applyActivitySettingsChoice();

    assert.strictEqual(window.VitiEnvState.activityType, 'prestation');
    assert.strictEqual(window.VitiEnvState.activeMode, 'prestation');
    assert.strictEqual(mockDocument.body.getAttribute('data-app-mode'), 'prestation');
    assert.strictEqual(mockDocument.body.getAttribute('data-activity-type'), 'prestation');

    assert.strictEqual(prestaContainer.style.display, 'block', '#prestation-views-container doit être affiché');
    assert.strictEqual(sidebarPresta.style.display, 'flex', '#sidebar-nav-prestation doit être affiché');
    assert.strictEqual(expContainer.style.display, 'none', '#exploitation-views-container doit être masqué');
    assert.strictEqual(sidebarExp.style.display, 'none', '#sidebar-nav-exploitation doit être masqué');
    assert.strictEqual(localStorageMock.getItem('vititrack_activity_type'), 'prestation');
    assert.strictEqual(localStorageMock.getItem('vititrack_active_mode'), 'prestation');
  });

  // TEST 3 : Configuration « Prestation + Exploitation »
  await itAsync('6. Configuration « Prestation + Exploitation » permet de basculer librement', async () => {
    window.selectActivityOption('both');
    await window.applyActivitySettingsChoice();

    assert.strictEqual(window.VitiEnvState.activityType, 'both');
    assert.strictEqual(mockDocument.body.getAttribute('data-activity-type'), 'both');

    // Basculer vers exploitation
    window.switchAppMode('exploitation');
    assert.strictEqual(window.VitiEnvState.activeMode, 'exploitation');
    assert.strictEqual(expContainer.style.display, 'block');
    assert.strictEqual(prestaContainer.style.display, 'none');
    assert.strictEqual(localStorageMock.getItem('vititrack_active_mode'), 'exploitation');

    // Basculer vers prestation
    window.switchAppMode('prestation');
    assert.strictEqual(window.VitiEnvState.activeMode, 'prestation');
    assert.strictEqual(prestaContainer.style.display, 'block');
    assert.strictEqual(expContainer.style.display, 'none');
    assert.strictEqual(localStorageMock.getItem('vititrack_active_mode'), 'prestation');
  });

  // TEST 4 : Contrôle des autorisations
  await itAsync('7. Utilisateur restreint sans droits : refus explicite sans basculement silencieux', async () => {
    // Simuler un collaborateur restreint côté Supabase
    global.window.supabaseClient.auth.getSession = async () => ({
      data: {
        session: {
          user: {
            id: 'user-salarie-456',
            email: 'ouvrier@domaine.fr',
            app_metadata: { is_team_member: true, can_view_dashboard: false, role: 'Ouvrier agricole' },
            user_metadata: { is_team_member: true, can_view_dashboard: false, role: 'Ouvrier agricole' }
          }
        }
      }
    });

    // Mettre l'application en mode prestation
    window.setActivityType('prestation');
    assert.strictEqual(window.VitiEnvState.activityType, 'prestation');

    // L'utilisateur tente de passer en Exploitation uniquement
    window.selectActivityOption('exploitation');
    await window.applyActivitySettingsChoice();

    // Doit être REFUSÉ : l'activité reste sur prestation et une alerte explicite est affichée
    assert.strictEqual(window.VitiEnvState.activityType, 'prestation', 'L\'activité doit rester prestation car refusée');
    assert.strictEqual(alertBox.style.display, 'block', 'L\'alerte explicite doit être affichée dans la modale');
    assert.ok(alertBox.textContent.includes('Accès non autorisé'), 'Le message doit expliciter le refus d\'accès');
  });

  console.log(`\n==============================================================`);
  console.log(`📊 BILAN DES TESTS : ${passCount} / ${testCount} réussis`);
  if (passCount === testCount) {
    console.log('🎉 TOUS LES TESTS SONT AU VERT ! CORRECTION PARFAITEMENT VALIDÉE.');
  } else {
    console.error('⚠️ CERTAINS TESTS ONT ÉCHOUÉ.');
    process.exit(1);
  }
  console.log(`==============================================================\n`);
}

runTests();
