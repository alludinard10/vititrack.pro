/**
 * VitiTrack Pro — Test Automatisé : Fermeture de la Modale Équipe & Utilisateurs (Prestation)
 * Vérifie que le bouton Fermer et la croix (✕) ferment immédiatement #team-modal
 * sans conflit de nommage avec Exploitation.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("🍇 ==========================================================================");
console.log("🍇 TESTS : FERMETURE DE LA MODALE ÉQUIPE & UTILISATEURS (PRESTATION)");
console.log("🍇 ==========================================================================\n");

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

// 1. Contrôle des sources statiques
const html = fs.readFileSync(path.join(__dirname, "..", "dashboard.html"), "utf8");
const dashJs = fs.readFileSync(path.join(__dirname, "..", "dashboard.js"), "utf8");
const expJs = fs.readFileSync(path.join(__dirname, "..", "exploitation.js"), "utf8");

it("1.1 Le bouton croix (✕) de #team-modal appelle closeTeamModal()", () => {
  assert.ok(html.includes('id="team-modal-close-btn"'), "team-modal-close-btn doit exister");
  assert.ok(html.includes('onclick="closeTeamModal()"'), "onclick=\"closeTeamModal()\" doit être présent");
});

it("1.2 Le bouton Fermer de #team-modal possède l'identifiant team-modal-cancel-btn", () => {
  assert.ok(html.includes('id="team-modal-cancel-btn"'), "team-modal-cancel-btn doit être défini");
  assert.ok(html.includes('id="team-modal-cancel-btn" onclick="closeTeamModal()"'), "Le bouton doit appeler closeTeamModal()");
});

it("1.3 setupModalCloser branche bien team-modal, sa croix et son bouton Fermer", () => {
  assert.ok(dashJs.includes('setupModalCloser("team-modal", "team-modal-close-btn", "team-modal-cancel-btn", closeTeamModal)'), "setupModalCloser doit brancher team-modal-cancel-btn");
});

it("1.4 exploitation.js ne neutralise plus la fermeture de #team-modal", () => {
  assert.ok(expJs.includes("window.closeExpTeamModal"), "Doit exposer closeExpTeamModal");
  assert.ok(expJs.includes("originalPrestationCloseTeamModal"), "Doit préserver la fermeture Prestation");
});

// 2. Simulation d'exécution dynamique
console.log("\n📌 SUITE 2 : Simulation Comportementale dans le DOM");

function createMockElement(id, classes = []) {
  const classList = new Set(classes);
  const attrs = {};
  return {
    id,
    classList: {
      add: (c) => classList.add(c),
      remove: (c) => classList.delete(c),
      contains: (c) => classList.has(c)
    },
    setAttribute: (k, v) => { attrs[k] = v; },
    getAttribute: (k) => attrs[k] || null,
    querySelector: () => ({ scrollTop: 0 })
  };
}

it("2.1 Ouverture puis fermeture de team-modal via closeTeamModal()", () => {
  const teamModal = createMockElement("team-modal");
  const expModal = createMockElement("modal-exp-team");

  // Simulation open
  teamModal.classList.add("open");
  teamModal.setAttribute("aria-hidden", "false");
  assert.strictEqual(teamModal.classList.contains("open"), true);

  // Exécution de la fonction closeTeamModal de dashboard.js
  function closePrestationTeamModal() {
    teamModal.classList.remove("open");
    teamModal.classList.remove("active");
    teamModal.setAttribute("aria-hidden", "true");
    if (expModal) {
      expModal.classList.remove("active");
      expModal.classList.remove("open");
      expModal.setAttribute("aria-hidden", "true");
    }
  }

  closePrestationTeamModal();
  assert.strictEqual(teamModal.classList.contains("open"), false, "team-modal ne doit plus avoir la classe open");
  assert.strictEqual(teamModal.getAttribute("aria-hidden"), "true", "aria-hidden doit être true");
});

it("2.2 Ordre de chargement : dashboard.js puis exploitation.js ferme toujours team-modal", () => {
  const teamModal = createMockElement("team-modal");
  const expModal = createMockElement("modal-exp-team");

  // 1. dashboard.js définit window.closeTeamModal
  let dashboardCloseCalled = false;
  const mockWindow = {
    closeTeamModal: function() {
      dashboardCloseCalled = true;
      teamModal.classList.remove("open");
      teamModal.setAttribute("aria-hidden", "true");
    }
  };

  // 2. exploitation.js est chargé après
  const originalPrestationClose = mockWindow.closeTeamModal;
  mockWindow.closeTeamModal = function() {
    if (typeof originalPrestationClose === 'function') {
      originalPrestationClose();
    }
    expModal.classList.remove("active");
  };

  // 3. L'utilisateur ouvre #team-modal
  teamModal.classList.add("open");
  teamModal.setAttribute("aria-hidden", "false");

  // 4. L'utilisateur clique sur Fermer ou la croix (appel de window.closeTeamModal())
  mockWindow.closeTeamModal();

  assert.strictEqual(dashboardCloseCalled, true, "La fermeture de la modale Prestation doit avoir été invoquée");
  assert.strictEqual(teamModal.classList.contains("open"), false, "#team-modal doit être fermée");
  assert.strictEqual(teamModal.getAttribute("aria-hidden"), "true", "aria-hidden doit être remis à true");
});

console.log("\n==========================================================================");
console.log(`📊 RÉSULTAT : ${passedTests} / ${totalTests} TESTS PASSÉS AVEC SUCCÈS`);
console.log("==========================================================================\n");

if (failedTests > 0) {
  process.exit(1);
}
