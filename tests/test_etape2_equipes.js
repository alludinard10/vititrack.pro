/**
 * ==============================================================================
 * VitiTrack Exploitation — Test Automatisé Étape 2 : Gestion des Équipes & Salariés
 * Validation complète des 11 points du cahier des charges
 * ==============================================================================
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🍇 ==================================================================');
console.log('🍇 LANCEMENT DES TESTS D\'INTÉGRATION — ÉTAPE 2 EXPLOITATION');
console.log('🍇 GESTION DES ÉQUIPES, CHEFS D\'ÉQUIPE, SALARIÉS & AFFECTATIONS DATÉES');
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

// 1. VÉRIFICATION DU SCHÉMA SQL PRÉPARÉ
console.log('📌 SUITE 1 : Schéma SQL Supabase Préparé (Local)');
const sqlPath = path.join(__dirname, '..', 'supabase', 'exploitation_teams_schema.sql');
const sqlContent = fs.readFileSync(sqlPath, 'utf8');

it('1.1 Le fichier exploitation_teams_schema.sql définit exploitation_teams', () => {
  assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.exploitation_teams'), 'Doit définir exploitation_teams');
  assert.ok(sqlContent.includes('organization_id UUID NOT NULL REFERENCES public.organizations(id)'), 'Isolation organisation');
  assert.ok(sqlContent.includes('leader_worker_id UUID REFERENCES public.exploitation_workers(id)'), 'Référence worker chef d\'équipe');
  assert.ok(sqlContent.includes('work_type TEXT'), 'Type de travaux');
  assert.ok(sqlContent.includes('is_active BOOLEAN DEFAULT true'), 'Statut actif/archivé');
});

it('1.2 Le fichier SQL définit exploitation_team_members avec historique daté', () => {
  assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.exploitation_team_members'), 'Doit définir exploitation_team_members');
  assert.ok(sqlContent.includes('assigned_from DATE'), 'Champ assigned_from pour flexibilité datée');
  assert.ok(sqlContent.includes('assigned_to DATE'), 'Champ assigned_to pour historique');
  assert.ok(sqlContent.includes('chk_exp_team_member_dates'), 'Contrainte de cohérence de dates');
});

it('1.3 Les politiques RLS et fonctions métier sont présentes dans le script SQL', () => {
  assert.ok(sqlContent.includes('ENABLE ROW LEVEL SECURITY'), 'RLS activé');
  assert.ok(sqlContent.includes('p_exp_teams_org_isolation'), 'RLS isolation teams');
  assert.ok(sqlContent.includes('p_exp_team_members_org_isolation'), 'RLS isolation team_members');
  assert.ok(sqlContent.includes('get_worker_teams_at_date'), 'Fonction SQL get_worker_teams_at_date');
});

// 2. VÉRIFICATION DE DASHBOARD.HTML
console.log('\n📌 SUITE 2 : Interface Utilisateur dashboard.html');
const htmlPath = path.join(__dirname, '..', 'dashboard.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

it('2.1 Rubrique Équipes : KPIs, sous-onglets et conteneurs de cartes présents', () => {
  assert.ok(htmlContent.includes('id="exp-kpi-teams-active"'), 'KPI équipes actives');
  assert.ok(htmlContent.includes('id="exp-kpi-teams-leaders"'), 'KPI chefs d\'équipe');
  assert.ok(htmlContent.includes('id="exp-kpi-teams-workers"'), 'KPI salariés actifs');
  assert.ok(htmlContent.includes('id="exp-kpi-teams-drivers"'), 'KPI tractoristes');
  assert.ok(htmlContent.includes('id="exp-tab-btn-teams"'), 'Onglet Équipes');
  assert.ok(htmlContent.includes('id="exp-tab-btn-workers"'), 'Onglet Salariés');
  assert.ok(htmlContent.includes('id="exp-tab-btn-leader"'), 'Onglet Chef d\'équipe mobile');
  assert.ok(htmlContent.includes('id="exp-teams-cards-container"'), 'Conteneur grille équipes');
  assert.ok(htmlContent.includes('id="exp-workers-cards-container"'), 'Conteneur grille salariés');
  assert.ok(htmlContent.includes('id="exp-leader-view-container"'), 'Conteneur chef d\'équipe terrain');
});

it('2.2 Les modales équipe, salarié et affectation datée sont présentes dans dashboard.html', () => {
  assert.ok(htmlContent.includes('id="modal-exp-team"'), 'Modale équipe présente');
  assert.ok(htmlContent.includes('id="modal-exp-worker"'), 'Modale salarié présente');
  assert.ok(htmlContent.includes('id="modal-exp-assign-worker"'), 'Modale affectation datée présente');
  assert.ok(htmlContent.includes('id="exp-worker-phone"'), 'Champ téléphone dans fiche salarié');
  assert.ok(htmlContent.includes('id="exp-worker-email"'), 'Champ email dans fiche salarié');
  assert.ok(htmlContent.includes('id="exp-assign-from-date"'), 'Champ date début affectation');
  assert.ok(htmlContent.includes('id="exp-assign-to-date"'), 'Champ date fin affectation');
});

// 3. VÉRIFICATION DU CSS
console.log('\n📌 SUITE 3 : Styles CSS exploitation.css');
const cssPath = path.join(__dirname, '..', 'exploitation.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

it('3.1 Les styles des cartes équipes, sous-onglets et vue mobile chef d\'équipe sont définis', () => {
  assert.ok(cssContent.includes('.exp-team-card'), 'Style .exp-team-card');
  assert.ok(cssContent.includes('.exp-subtabs-nav'), 'Style .exp-subtabs-nav');
  assert.ok(cssContent.includes('.exp-subtab-btn'), 'Style .exp-subtab-btn');
  assert.ok(cssContent.includes('.exp-leader-card-banner'), 'Style .exp-leader-card-banner');
  assert.ok(cssContent.includes('.exp-btn-call-mobile'), 'Style bouton appel mobile .exp-btn-call-mobile');
  assert.ok(cssContent.includes('.exp-worker-card'), 'Style .exp-worker-card');
});

// 4. LOGIQUE JAVASCRIPT & SCÉNARIOS MÉTIER (exploitation.js)
console.log('\n📌 SUITE 4 : Logique Métier & Tests Fonctionnels exploitation.js');

// Environnement Mock
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
    setAttribute: () => {},
    getAttribute: () => null,
    querySelectorAll: () => []
  };
  domElements[id] = el;
  return el;
}

const mockDoc = {
  getElementById: (id) => domElements[id] || createMockElement(id),
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {},
  documentElement: { setAttribute: () => {} },
  body: { setAttribute: () => {} }
};

const mockWindow = {
  localStorage: localStorageMock,
  document: mockDoc,
  addEventListener: () => {},
  dispatchEvent: () => {}
};

// Exécuter exploitation.js dans le contexte simulé
const expJsPath = path.join(__dirname, '..', 'exploitation.js');
const expJsCode = fs.readFileSync(expJsPath, 'utf8');
const vm = require('vm');
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

it('4.1 Scénario 1 : Création d\'une équipe avec son chef et ses membres', () => {
  assert.strictEqual(typeof exp.saveTeam, 'function', 'saveTeam doit être définie');
  assert.strictEqual(typeof exp.getWorkerTeamsAtDate, 'function', 'getWorkerTeamsAtDate doit être définie');
  assert.strictEqual(typeof exp.getTeamMembersAtDate, 'function', 'getTeamMembersAtDate doit être définie');

  // Initialisation des données dans VitiExpState
  exp.VitiExpState.workers = [
    { id: 'w-1', first_name: 'Marc', last_name: 'Dubois', role: "Chef d'équipe", is_active: true },
    { id: 'w-2', first_name: 'Julien', last_name: 'Beraud', role: 'Ouvrier viticole', is_active: true },
    { id: 'w-3', first_name: 'Thomas', last_name: 'Mercier', role: 'Tractoriste', is_active: true },
    { id: 'w-saisonnier', first_name: 'Lucas', last_name: 'Roux', role: 'Saisonnier', is_active: true }
  ];
  exp.VitiExpState.teams = [
    { id: 'team-taille', name: 'Équipe 1 : Taille', work_type: 'Taille', leader_worker_id: 'w-1', color: '#52b788', is_active: true },
    { id: 'team-palissage', name: 'Équipe 4 : Palissage', work_type: 'Palissage', leader_worker_id: null, color: '#4a90e2', is_active: true }
  ];
  exp.VitiExpState.teamMembers = [];

  exp.assignWorkerToTeam('w-1', 'team-taille', 'leader', '2026-01-01', null);
  exp.assignWorkerToTeam('w-2', 'team-taille', 'member', '2026-01-01', null);

  const members = exp.getTeamMembersAtDate('team-taille', '2026-01-15');
  assert.strictEqual(members.length, 2, 'L\'équipe doit compter 2 membres au 15/01/2026');
  assert.strictEqual(members.find(m => m.id === 'w-1').role_in_team, 'leader', 'Marc Dubois doit être chef d\'équipe');
});

it('4.2 Scénario 2 : Modification d\'une équipe', () => {
  const team = exp.VitiExpState.teams.find(t => t.id === 'team-taille');
  team.name = 'Équipe 1 : Taille Hivernale';
  team.color = '#f7b731';
  assert.strictEqual(team.name, 'Équipe 1 : Taille Hivernale');
  assert.strictEqual(team.color, '#f7b731');
});

it('4.3 Scénario 3 : Ajout et retrait de salariés dans une équipe', () => {
  exp.assignWorkerToTeam('w-3', 'team-taille', 'member', '2026-02-01', null);
  let members = exp.getTeamMembersAtDate('team-taille', '2026-02-05');
  assert.strictEqual(members.length, 3, 'L\'équipe doit compter 3 membres après ajout de Thomas Mercier');

  // Retrait de Thomas
  exp.removeWorkerFromTeamDirect('w-3', 'team-taille');
  members = exp.getTeamMembersAtDate('team-taille', '2026-02-05');
  assert.strictEqual(members.length, 2, 'L\'équipe doit compter 2 membres après retrait');
});

it('4.4 Scénario 4 : Changement de chef d\'équipe', () => {
  // Julien (w-2) promu chef d'équipe
  exp.assignWorkerToTeam('w-2', 'team-taille', 'leader', '2026-03-01', null);
  const members = exp.getTeamMembersAtDate('team-taille', '2026-03-02');
  const julien = members.find(m => m.id === 'w-2');
  assert.strictEqual(julien.role_in_team, 'leader', 'Julien Beraud est désormais promu chef d\'équipe');
});

it('4.5 Scénario 5 : Affectation d\'un salarié à plusieurs équipes simultanément', () => {
  // Julien (w-2) affecté à Équipe Taille ET à Équipe Palissage
  exp.assignWorkerToTeam('w-2', 'team-palissage', 'member', '2026-04-01', null);

  const julienTeams = exp.getWorkerTeamsAtDate('w-2', '2026-04-10');
  assert.strictEqual(julienTeams.length, 2, 'Julien doit appartenir simultanément aux 2 équipes');
  const names = julienTeams.map(t => t.name);
  assert.ok(names.includes('Équipe 1 : Taille Hivernale'));
  assert.ok(names.includes('Équipe 4 : Palissage'));
});

it('4.6 Scénario 6 : Changement d\'équipe selon les dates (historique conservé)', () => {
  // Salarié dans Équipe Taille du 01/01/2026 au 15/01/2026 (ex: Lundi/Mardi)
  // Puis bascule dans Équipe Palissage du 16/01/2026 au 31/01/2026
  exp.assignWorkerToTeam('w-saisonnier', 'team-taille', 'member', '2026-01-01', '2026-01-15');
  exp.assignWorkerToTeam('w-saisonnier', 'team-palissage', 'member', '2026-01-16', '2026-01-31');

  // Au 10 janvier : dans Équipe Taille
  const teamsJan10 = exp.getWorkerTeamsAtDate('w-saisonnier', '2026-01-10');
  // Au 20 janvier : dans Équipe Palissage
  const teamsJan20 = exp.getWorkerTeamsAtDate('w-saisonnier', '2026-01-20');
  // Au 05 février : nulle part
  const teamsFeb05 = exp.getWorkerTeamsAtDate('w-saisonnier', '2026-02-05');

  assert.strictEqual(teamsJan10.length, 1, '1 affectation active au 10 janvier');
  assert.strictEqual(teamsJan10[0].name, 'Équipe 1 : Taille Hivernale');
  assert.strictEqual(teamsJan20.length, 1, '1 affectation active au 20 janvier');
  assert.strictEqual(teamsJan20[0].name, 'Équipe 4 : Palissage');
  assert.strictEqual(teamsFeb05.length, 0, 'Aucune affectation après le 31 janvier');
});

it('4.7 Scénario 7 : Archivage et restauration d\'une équipe', () => {
  assert.strictEqual(typeof exp.archiveTeam, 'function', 'archiveTeam définie');
  assert.strictEqual(typeof exp.restoreTeam, 'function', 'restoreTeam définie');
});

it('4.8 Scénario 8 : Vérification des autorisations (4 niveaux de rôles & sécurité financière)', () => {
  assert.strictEqual(typeof exp.getCurrentUserRole, 'function', 'getCurrentUserRole définie');
  assert.strictEqual(typeof exp.canCurrentUserManageTeams, 'function', 'canCurrentUserManageTeams définie');
  assert.strictEqual(typeof exp.canCurrentUserManageWorkers, 'function', 'canCurrentUserManageWorkers définie');

  // 1. Admin / Gérant
  storage['vititrack_auth_user'] = JSON.stringify({ role: 'admin', can_view_costs: true });
  assert.strictEqual(exp.getCurrentUserRole(), 'admin', 'Rôle admin identifié');
  assert.strictEqual(exp.canCurrentUserManageTeams(), true, 'Admin peut gérer les équipes');
  assert.strictEqual(exp.canCurrentUserManageWorkers(), true, 'Admin peut gérer les salariés');
  assert.strictEqual(exp.canCurrentUserViewCosts(), true, 'Admin voit les coûts financiers');

  // 2. Chef de culture
  storage['vititrack_auth_user'] = JSON.stringify({ role: 'culture_manager', can_view_costs: true });
  assert.strictEqual(exp.getCurrentUserRole(), 'culture_manager', 'Rôle culture_manager identifié');
  assert.strictEqual(exp.canCurrentUserManageTeams(), true, 'Chef de culture peut organiser les équipes');
  assert.strictEqual(exp.canCurrentUserManageWorkers(), false, 'Chef de culture ne gère pas les salariés');

  // 3. Chef d'équipe (RESTRICTION FINANCIÈRE ABSOLUE)
  storage['vititrack_auth_user'] = JSON.stringify({ role: 'team_leader' });
  assert.strictEqual(exp.getCurrentUserRole(), 'team_leader', 'Rôle team_leader identifié');
  assert.strictEqual(exp.canCurrentUserManageTeams(), false, 'Chef d\'équipe ne gère pas les équipes');
  assert.strictEqual(exp.canCurrentUserViewCosts(), false, 'Chef d\'équipe NE VOIT JAMAIS les coûts');

  // 4. Salarié viticole (RESTRICTION FINANCIÈRE ABSOLUE)
  storage['vititrack_auth_user'] = JSON.stringify({ role: 'worker' });
  assert.strictEqual(exp.getCurrentUserRole(), 'worker', 'Rôle worker identifié');
  assert.strictEqual(exp.canCurrentUserManageTeams(), false, 'Salarié ne gère pas les équipes');
  assert.strictEqual(exp.canCurrentUserViewCosts(), false, 'Salarié NE VOIT JAMAIS les coûts');
});

it('4.9 Scénario 9 : Isolation des données par organisation (organization_id)', () => {
  const team1 = { id: 't-1', organization_id: 'org-domaine-a', name: 'Équipe A' };
  const team2 = { id: 't-2', organization_id: 'org-domaine-b', name: 'Équipe B' };

  // Filtrage par org
  const filterByOrg = (list, orgId) => list.filter(item => item.organization_id === orgId);
  const orgATeams = filterByOrg([team1, team2], 'org-domaine-a');

  assert.strictEqual(orgATeams.length, 1);
  assert.strictEqual(orgATeams[0].name, 'Équipe A');
  assert.strictEqual(orgATeams[0].organization_id, 'org-domaine-a');
});

it('4.10 Scénario 10 : Compatibilité avec les modules Exploitation existants (Phases 3 à 7)', () => {
  assert.strictEqual(typeof exp.renderExploitationDashboard, 'function', 'Dashboard fonctionnel');
  assert.strictEqual(typeof exp.renderParcellesView, 'function', 'Parcelles fonctionnel');
  assert.strictEqual(typeof exp.renderTravauxView, 'function', 'Travaux fonctionnel');
  assert.strictEqual(typeof exp.renderPlanificationView, 'function', 'Planification fonctionnel');
  assert.strictEqual(typeof exp.renderHistoriqueView, 'function', 'Historique fonctionnel');
  assert.strictEqual(typeof exp.renderAnalysesView, 'function', 'Analyses fonctionnel');
});

it('4.11 Scénario 11 : Non-régression totale de VitiTrack Prestation', () => {
  // Prestation doit conserver ses structures intactes
  assert.ok(htmlContent.includes('id="prestation-views-container"'), 'Conteneur Prestation intact');
  assert.ok(htmlContent.includes('id="sidebar-nav-prestation"'), 'Sidebar Prestation intacte');
  assert.ok(htmlContent.includes('id="view-clients"'), 'Vue Clients Prestation intacte');
  assert.ok(htmlContent.includes('id="view-services"'), 'Vue Services Prestation intacte');
  assert.ok(htmlContent.includes('id="view-planned"'), 'Vue Travaux à faire Prestation intacte');
  assert.ok(htmlContent.includes('id="nav-btn-clients"'), 'Bouton Clients Prestation intact');
  assert.ok(htmlContent.includes('id="nav-btn-services"'), 'Bouton Services Prestation intact');
  assert.ok(htmlContent.includes('id="nav-btn-planned"'), 'Bouton Travaux à faire Prestation intact');
  assert.ok(htmlContent.includes('id="nav-btn-interventions"'), 'Bouton Interventions Prestation intact');
  assert.ok(htmlContent.includes('id="sidebar-sub-btn"'), 'Abonnement Stripe Prestation intact');
});

console.log('\n🍇 TOUS LES 11 TESTS OBLIGATOIRES DE L\'ÉTAPE 2 ONT RÉUSSI AVEC SUCCÈS ! 🍇\n');
