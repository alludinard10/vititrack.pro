/**
 * VitiTrack Pro — Dashboard Application Logic
 * Base de données neutre : Gestion des Clients, Parcelles et Interventions viticoles.
 */

// ==================== MULTI-TENANT STORAGE KEYS ====================
const STORAGE_CLIENTS_BASE = "vititrack_clients_user_v3";
const STORAGE_INTERVENTIONS_BASE = "vititrack_interventions_user_v3";
const STORAGE_SERVICES_BASE = "vititrack_services_user_v3";
const STORAGE_PLANNED_BASE = "vititrack_planned_works_user_v3";
const STORAGE_TEAM_BASE = "vititrack_team_users_v3";
const STORAGE_HARVEST_BASE = "vititrack_harvest_works_user_v3";

let currentAuthUser = null;

function getAuthUser() {
  if (currentAuthUser) return currentAuthUser;
  try {
    const raw = localStorage.getItem("vititrack_auth_user");
    if (raw) {
      currentAuthUser = JSON.parse(raw);
      return currentAuthUser;
    }
  } catch (e) {}
  return null;
}

function getAuthUserId() {
  const user = getAuthUser();
  // Si l'utilisateur connecté est un collaborateur / tractoriste invité,
  // il accède directement au compte et aux chantiers de l'administrateur gérant !
  if (user && user.isTeamMember && user.ownerUserId) {
    return user.ownerUserId;
  }
  if (user && user.id) return user.id;
  if (user && user.email) return user.email.replace(/[^a-zA-Z0-9_-]/g, "_");
  return "guest_user";
}

function getUserStorageKey(baseKey) {
  return `${baseKey}_${getAuthUserId()}`;
}

// ==================== RÈGLES FISCALES VITICOLES (TVA) ====================
// Charrue mécanique ou charrue hydraulique : 5%
// Tous les autres travaux : 20%
function getTvaRate(itemOrTask) {
  if (!itemOrTask) return 0.20;

  if (typeof itemOrTask === "object") {
    if (typeof itemOrTask.tvaRate === "number") {
      return itemOrTask.tvaRate > 1 ? itemOrTask.tvaRate / 100 : itemOrTask.tvaRate;
    }
    const name = itemOrTask.task || itemOrTask.name || "";
    return getTvaRate(name);
  }

  const str = String(itemOrTask).toLowerCase().trim();
  // Charrue mécanique, charrue hydraulique ou tout travail de charrue
  if (str.includes("charrue")) {
    return 0.05; // 5%
  }
  return 0.20; // 20% pour tous les autres travaux
}
window.getTvaRate = getTvaRate;

// ==================== DEFAULT PRESTATIONS CATALOG ====================
const DEFAULT_SERVICES = [
  {
    id: "srv-01",
    name: "Taille Guyot (Simple / Double)",
    category: "Taille & Végétal",
    rateType: "hourly",
    price: 38,
    description: "Taille d'hiver soignée avec respect des flux de sève, sélection des coursons et baguettes de rappel."
  },
  {
    id: "srv-02",
    name: "Taille Cordon de Royat",
    category: "Taille & Végétal",
    rateType: "hourly",
    price: 38,
    description: "Nettoyage des charpentières et taille des coursons à 2 yeux francs par courson."
  },
  {
    id: "srv-03",
    name: "Tirage des bois & Broyage",
    category: "Taille & Végétal",
    rateType: "hourly",
    price: 34,
    description: "Sortie des sarments taillés hors des fils et broyage fin direct dans l'interligne."
  },
  {
    id: "srv-04",
    name: "Ébourgeonnage & Épamprage",
    category: "Taille & Végétal",
    rateType: "hourly",
    price: 36,
    description: "Suppression manuelle des pampres sur le tronc et sélection des pousses utiles."
  },
  {
    id: "srv-05",
    name: "Palissage & Relevage des fils",
    category: "Palissage & Écimage",
    rateType: "hourly",
    price: 36,
    description: "Relevage des fils mobiles, maintien de la végétation avec agrafes et tuteurage."
  },
  {
    id: "srv-06",
    name: "Rognage & Écimage mécanique",
    category: "Palissage & Écimage",
    rateType: "surface",
    price: 75,
    description: "Passage au tracteur pour maîtrise de la hauteur de végétation et aération du feuillage."
  },
  {
    id: "srv-07",
    name: "Effeuillage manuel face levante",
    category: "Palissage & Écimage",
    rateType: "surface",
    price: 550,
    description: "Découverte raisonnée des grappes côté soleil levant pour optimiser l'état sanitaire (550 €/ha)."
  },
  {
    id: "srv-08",
    name: "Travail du sol & Interceps mécaniques",
    category: "Sol & Mécanisation",
    rateType: "surface",
    price: 110,
    description: "Travail du cavaillon sous le rang aux lames ou disques sans herbicide chimique."
  },
  {
    id: "srv-09",
    name: "Griffage & Décompactage interligne",
    category: "Sol & Mécanisation",
    rateType: "surface",
    price: 85,
    description: "Aération superficielle du sol et enfouissement léger du couvert végétal."
  },
  {
    id: "srv-charrue-meca",
    name: "Charrue mécanique",
    category: "Sol & Mécanisation",
    rateType: "surface",
    price: 95,
    tvaRate: 5,
    description: "Labour et travail du sol à la charrue mécanique (TVA réduite 5%)."
  },
  {
    id: "srv-charrue-hydro",
    name: "Charrue hydraulique",
    category: "Sol & Mécanisation",
    rateType: "surface",
    price: 120,
    tvaRate: 5,
    description: "Travail du sol et interceps de précision à la charrue hydraulique (TVA réduite 5%)."
  },
  {
    id: "srv-10",
    name: "Traitement anti-mildiou (cuivre & soufre)",
    category: "Traitements & Soins",
    rateType: "surface",
    price: 95,
    description: "Pulvérisation préventive homologuée bio contre le mildiou et l'oïdium."
  },
  {
    id: "srv-11",
    name: "Poudrage soufre fleur",
    category: "Traitements & Soins",
    rateType: "surface",
    price: 60,
    description: "Application de fleur de soufre pour assainir le feuillage au stade floraison."
  },
  {
    id: "srv-12",
    name: "Vendanges manuelles sélectives",
    category: "Vendanges & Récolte",
    rateType: "hourly",
    price: 42,
    description: "Récolte manuelle soignée en cagettes ajourées avec tri à la vigne."
  },
  {
    id: "srv-13",
    name: "Conduite benne & Transport vendange",
    category: "Vendanges & Récolte",
    rateType: "hourly",
    price: 45,
    description: "Acheminement sécurisé de la récolte depuis la parcelle jusqu'au pressoir du domaine."
  },
  {
    id: "srv-debardage-vendange",
    name: "Débardage vendange (tracteur / porteur)",
    category: "Vendanges & Récolte",
    rateType: "kilo",
    price: 0.15,
    description: "Évacuation des caisses et sorties de rang au tracteur interligne ou chenillard (0,15 €/kg)."
  },
  {
    id: "srv-coupe-vendange-kg",
    name: "Coupe vendange (au kilo)",
    category: "Vendanges & Récolte",
    rateType: "kilo",
    price: 0.35,
    description: "Coupe et récolte du raisin rémunérée directement au kilo récolté (€/kg)."
  },
  {
    id: "srv-recolte-kg",
    name: "Récolte & Vendanges au kilo",
    category: "Vendanges & Récolte",
    rateType: "kilo",
    price: 0.35,
    description: "Cueillette et récolte du raisin rémunérée au poids récolté (€/kg)."
  },
  {
    id: "srv-14",
    name: "Complantation & Remplacement de ceps",
    category: "Aménagement & Plantations",
    rateType: "hourly",
    price: 38,
    description: "Carottage, apport de terreau organique, plantation du greffon et tuteurage."
  },
  {
    id: "srv-15",
    name: "Audit de parcelle & Conseil viticole",
    category: "Aménagement & Plantations",
    rateType: "fixed",
    price: 250,
    description: "Diagnostic de vigueur, état phytosanitaire global et préconisations personnalisées."
  }
];

// ==================== APPLICATION STATE ====================
let clients = [];
let interventions = [];
let services = [];
let plannedWorks = [];
let convertingPlannedWorkId = null;
let teamUsers = [];
let teamSearchFilter = "";
let teamRoleFilter = "all";
let currentFilter = {
  search: "",
  client: "all",
  clients: [], // Multi-sélection de domaines clients (encoches)
  task: "all",
  tasks: [],   // Multi-sélection de prestations viticoles (encoches)
  status: "all",
  dateFrom: "",
  dateTo: "",
  datePreset: "all"
};
let clientsSearchFilter = "";
let servicesSearchFilter = "";
let servicesCategoryFilter = "all";
let servicesRateTypeFilter = "all";
let servicesActiveSubtab = "catalog";
let pendingInterventionFormState = null;

// Vendanges & Récoltes State
let harvestWorks = [];
let vendangesSearchFilter = "";
let vendangesClientFilter = "all";
let vendangesClientFilters = [];
let vendangesParcelFilters = [];
let vendangesStageFilters = ["leaf_todo", "leaf_done", "cut_todo", "cut_done", "haul_todo", "haul_done"];
let vendangesTeamFilters = [];

// ==================== UNIQUE IDENTIFIER GENERATORS & REPAIR UTILS ====================

/**
 * Générateur universel d'identifiants uniques fiables
 * Utilise crypto.randomUUID() en priorité avec repli sur timestamp étendu + composante aléatoire
 */
function generateUniqueId(prefix = "ID") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
window.generateUniqueId = generateUniqueId;

/**
 * Générateur unique pour les interventions
 * Conserve le format lisible VT-YYYY-NNN en calculant le max existant + 1 pour l'année
 */
function generateUniqueInterventionId(year = new Date().getFullYear()) {
  const currentYearStr = String(year);
  const regex = new RegExp(`^VT-${currentYearStr}-(\\d+)$`);
  let maxNum = 0;
  const existingIds = new Set();

  if (Array.isArray(interventions)) {
    interventions.forEach(inv => {
      if (inv && inv.id) {
        existingIds.add(inv.id);
        const match = String(inv.id).match(regex);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    });
  }

  let nextNum = maxNum + 1;
  let candidateId = `VT-${currentYearStr}-${String(nextNum).padStart(3, '0')}`;
  while (existingIds.has(candidateId)) {
    nextNum++;
    candidateId = `VT-${currentYearStr}-${String(nextNum).padStart(3, '0')}`;
  }
  return candidateId;
}
window.generateUniqueInterventionId = generateUniqueInterventionId;

/**
 * Validation stricte d'unicité des IDs dans un lot (payload) avant upsert Supabase
 */
function validatePayloadUniqueIds(payload, entityType) {
  if (!Array.isArray(payload) || payload.length === 0) {
    return { valid: true };
  }

  const seen = new Map();
  const duplicates = [];

  for (const item of payload) {
    const id = item?.id;
    if (!id) {
      console.error(`❌ [VitiTrack Pro] Erreur validation ${entityType} : élément sans ID !`, item);
      return { valid: false, reason: `Élément ${entityType} sans ID` };
    }
    if (seen.has(id)) {
      duplicates.push({
        id,
        firstItem: seen.get(id),
        duplicateItem: item
      });
    } else {
      seen.set(id, item);
    }
  }

  if (duplicates.length > 0) {
    console.error(`❌ [VitiTrack Pro] COLLISION D'IDENTIFIANTS DÉTECTÉE sur « ${entityType} » ! L'upsert Supabase est ANNULÉ.`);
    duplicates.forEach(d => {
      console.error(`   - ID en collision : "${d.id}"`);
      console.error(`     Premier objet :`, d.firstItem);
      console.error(`     Objet en collision :`, d.duplicateItem);
    });
    return {
      valid: false,
      reason: `Collision d'identifiant détectée sur ${entityType} (ID: ${duplicates[0].id})`,
      duplicates
    };
  }

  return { valid: true };
}
window.validatePayloadUniqueIds = validatePayloadUniqueIds;

/**
 * Répare les collisions d'identifiants locales existantes SANS supprimer aucune donnée
 * Conserve le premier objet, réattribue un nouvel ID unique au second, et met à jour les références
 */
function repairLocalCollisions() {
  let hasModified = false;
  const repairsLog = [];

  // 1. Clients
  if (Array.isArray(clients) && clients.length > 0) {
    const seenClientIds = new Set();
    clients.forEach((c) => {
      if (!c.id || seenClientIds.has(c.id)) {
        const oldId = c.id;
        const newId = generateUniqueId("CLI");
        c.id = newId;
        hasModified = true;
        repairsLog.push(`Client « ${c.name} » : ID ${oldId} réassigné à ${newId}`);
        if (Array.isArray(c.parcels)) {
          c.parcels.forEach(p => { p.client_id = newId; });
        }
        if (Array.isArray(interventions)) {
          interventions.forEach(inv => {
            if (inv.clientId === oldId || inv.client === c.name) {
              inv.clientId = newId;
            }
          });
        }
        if (Array.isArray(plannedWorks)) {
          plannedWorks.forEach(pw => {
            if (pw.clientId === oldId || pw.clientName === c.name) {
              pw.clientId = newId;
            }
          });
        }
      } else {
        seenClientIds.add(c.id);
      }
    });
  }

  // 2. Parcelles (collectées à travers l'ensemble des clients)
  if (Array.isArray(clients) && clients.length > 0) {
    const seenParcelIds = new Map(); // id -> { client, parcel }
    clients.forEach((c) => {
      if (Array.isArray(c.parcels)) {
        c.parcels.forEach((p) => {
          if (!p.id) {
            p.id = generateUniqueId("PAR");
            hasModified = true;
            repairsLog.push(`Parcelle « ${p.name} » (Client: ${c.name}) : ID manquant généré (${p.id})`);
          } else if (seenParcelIds.has(p.id)) {
            const firstEntry = seenParcelIds.get(p.id);
            const oldId = p.id;
            const newId = generateUniqueId("PAR");
            p.id = newId;
            hasModified = true;
            repairsLog.push(`Parcelle « ${p.name} » (Client: ${c.name}) : Collision résolue sur ID ${oldId} -> nouvel ID unique ${newId} (l'ID ${oldId} reste attribué à la parcelle « ${firstEntry.parcel.name} » de « ${firstEntry.client.name} »)`);

            // Mettre à jour les références d'interventions ciblant cette parcelle
            if (Array.isArray(interventions)) {
              interventions.forEach(inv => {
                const matchesClient = (inv.clientId === c.id || inv.client === c.name);
                const matchesParcel = (inv.parcelId === oldId || (inv.parcel && inv.parcel.includes(p.name)));
                if (matchesClient && matchesParcel) {
                  inv.parcelId = newId;
                }
              });
            }
            seenParcelIds.set(newId, { client: c, parcel: p });
          } else {
            seenParcelIds.set(p.id, { client: c, parcel: p });
          }
        });
      }
    });
  }

  // 3. Prestations (Services)
  if (Array.isArray(services) && services.length > 0) {
    const seenServiceIds = new Set();
    services.forEach((s) => {
      if (!s.id || seenServiceIds.has(s.id)) {
        const oldId = s.id;
        const newId = generateUniqueId("SRV");
        s.id = newId;
        hasModified = true;
        repairsLog.push(`Prestation « ${s.name} » : ID ${oldId} réassigné à ${newId}`);
        if (Array.isArray(interventions)) {
          interventions.forEach(inv => {
            if (inv.serviceId === oldId && inv.task === s.name) {
              inv.serviceId = newId;
            }
          });
        }
        seenServiceIds.add(newId);
      } else {
        seenServiceIds.add(s.id);
      }
    });
  }

  // 4. Interventions
  if (Array.isArray(interventions) && interventions.length > 0) {
    const seenInvIds = new Set();
    interventions.forEach((inv) => {
      if (!inv.id || seenInvIds.has(inv.id)) {
        const oldId = inv.id;
        const year = inv.datetime ? new Date(inv.datetime).getFullYear() : new Date().getFullYear();
        const newId = generateUniqueInterventionId(year);
        inv.id = newId;
        hasModified = true;
        repairsLog.push(`Intervention (${inv.client} - ${inv.task}) : Collision résolue sur ID ${oldId} -> nouvel ID ${newId}`);
        seenInvIds.add(newId);
      } else {
        seenInvIds.add(inv.id);
      }
    });
  }

  // 5. Travaux planifiés
  if (Array.isArray(plannedWorks) && plannedWorks.length > 0) {
    const seenPwIds = new Set();
    plannedWorks.forEach((pw) => {
      if (!pw.id || seenPwIds.has(pw.id)) {
        const oldId = pw.id;
        const newId = generateUniqueId("PLN");
        pw.id = newId;
        hasModified = true;
        repairsLog.push(`Travail planifié (${pw.clientName} - ${pw.service}) : ID ${oldId} réassigné à ${newId}`);
        seenPwIds.add(newId);
      } else {
        seenPwIds.add(pw.id);
      }
    });
  }

  if (hasModified) {
    saveClientsLocally();
    saveInterventionsLocally();
    saveServicesLocally();
    savePlannedWorksLocally();
    console.log("🛠️ [VitiTrack Pro] Réparation automatique des collisions locales effectuée :", repairsLog);
  }

  return repairsLog;
}
window.repairLocalCollisions = repairLocalCollisions;

// ==================== INITIALIZATION ====================
function initDashboard() {
  try {
    initTheme();
  } catch (e) {
    console.warn("Erreur initTheme :", e);
  }

  try {
    setupEventListeners();
  } catch (e) {
    console.error("Erreur setupEventListeners :", e);
  }

  try {
    loadDatabase();
  } catch (e) {
    console.error("Erreur loadDatabase :", e);
  }

  try {
    renderAll();
  } catch (e) {
    console.error("Erreur renderAll :", e);
  }

  // Vérification d'authentification asynchrone sans bloquer l'interactivité
  checkAuthUser().then(() => {
    // Chargement de l'abonnement Stripe
    if (typeof loadUserSubscription === "function") loadUserSubscription();

    // Vérification d'un paiement en attente depuis la landing page ou login
    const urlParams = new URLSearchParams(window.location.search);
    const checkoutPlan = urlParams.get("checkout_plan");
    if (checkoutPlan && window.VitiTrackStripe) {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("checkout_plan");
      window.history.replaceState({}, document.title, cleanUrl.pathname + (cleanUrl.search || ""));
      window.VitiTrackStripe.startCheckout(checkoutPlan);
    }
  }).catch(err => {
    console.warn("Notice vérification utilisateur :", err);
  });

  // Synchronisation Supabase en tâche de fond
  try {
    initSupabaseSync();
  } catch (err) {
    console.warn("Notice initialisation Supabase :", err);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDashboard);
} else {
  initDashboard();
}

// Demo data seeds used ONLY for the demo account
function getDemoClients() {
  return [
    {
      id: "CLI-1001",
      name: "Château Grand Chêne",
      commune: "Pauillac",
      contact: "Jean-Marc Delorme",
      phone: "06 12 34 56 78",
      email: "jm.delorme@grandchene.fr",
      notes: "Cépages nobles, taille guyot double exclusivement.",
      parcels: [
        { id: "PAR-01", name: "Les Hauts de Chêne", surface: 2.4500, grape: "Cabernet Sauvignon", soil: "Graves garonnaises" },
        { id: "PAR-02", name: "Le Clos du Moulin", surface: 1.8200, grape: "Merlot", soil: "Argilo-calcaire" }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: "CLI-1002",
      name: "Domaine Belle Vue",
      commune: "Saint-Émilion",
      contact: "Claire Bernard",
      phone: "06 98 76 54 32",
      email: "contact@domainebellevue.fr",
      notes: "Vignoble sur coteaux argilo-calcaires.",
      parcels: [
        { id: "PAR-03", name: "Le Plateau Sud", surface: 3.1250, grape: "Merlot", soil: "Calcaire à astéries" },
        { id: "PAR-04", name: "Les Terrasses", surface: 1.6400, grape: "Cabernet Franc", soil: "Argilo-sableux" }
      ],
      createdAt: new Date().toISOString()
    }
  ];
}

function getDemoInterventions() {
  return [
    {
      id: "VT-2026-001",
      datetime: new Date().toISOString().slice(0, 16),
      worker: "Alexandre L.",
      clientId: "CLI-1001",
      client: "Château Grand Chêne",
      parcelId: "PAR-01",
      parcel: "Les Hauts de Chêne",
      serviceId: "srv-01",
      task: "Taille Guyot (Simple / Double)",
      rateType: "hourly",
      quantity: 8,
      unit: "heures",
      unitPrice: 38,
      total: 304,
      status: "À facturer",
      notes: "Taille d'hiver soignée sur le bas de pente."
    }
  ];
}

function getDemoPlannedWorks() {
  return [
    {
      id: "PLN-101",
      clientId: "CLI-1001",
      clientName: "Château Grand Chêne",
      parcel: "Les Hauts de Chêne",
      service: "Tirage des bois & Broyage",
      worker: "Alexandre L.",
      date: new Date().toISOString().split("T")[0],
      quantity: 5,
      status: "À réaliser",
      notes: "Broyage inter-rang"
    }
  ];
}

function getDemoHarvestWorks() {
  const today = new Date().toISOString().split("T")[0];
  return [
    {
      id: "harv-demo-01",
      clientId: "CLI-1001",
      clientName: "Château Grand Chêne",
      parcelId: "PAR-01",
      parcelName: "Les Hauts de Chêne",
      surface: 2.4500,
      grapeVariety: "Cabernet Sauvignon",
      leafStatus: "effeuillee",
      leafServiceName: "Effeuillage manuel face levante",
      leafPrice: 550,
      cutStatus: "coupee",
      yieldKg: 12250,
      boxesCount: 612,
      yieldPricePerKg: 0.35,
      harvestServiceName: "Coupe vendange (au kilo)",
      totalAmountHT: 4287.50,
      haulStatus: "debardee",
      haulServiceName: "Débardage vendange (tracteur / porteur)",
      haulPrice: 0.15,
      worker: "Alexandre L.",
      harvestDate: today,
      notes: "Grappes saines, vendange manuelle terminée, caisses débardées au chai.",
      createdAt: new Date().toISOString()
    },
    {
      id: "harv-demo-02",
      clientId: "CLI-1001",
      clientName: "Château Grand Chêne",
      parcelId: "PAR-02",
      parcelName: "Le Clos du Moulin",
      surface: 1.8200,
      grapeVariety: "Merlot",
      leafStatus: "effeuillee",
      leafServiceName: "Effeuillage manuel face levante",
      leafPrice: 550,
      cutStatus: "coupee",
      yieldKg: 9100,
      boxesCount: 455,
      yieldPricePerKg: 0.35,
      harvestServiceName: "Coupe vendange (au kilo)",
      totalAmountHT: 3185.00,
      haulStatus: "a_debarder",
      haulServiceName: "Débardage vendange (tracteur / porteur)",
      haulPrice: 0.15,
      worker: "Alexandre L.",
      harvestDate: today,
      notes: "Coupe terminée en matinée. Caisses pleines en bout de rang à débarder.",
      createdAt: new Date().toISOString()
    },
    {
      id: "harv-demo-03",
      clientId: "CLI-1002",
      clientName: "Domaine Belle Vue",
      parcelId: "PAR-03",
      parcelName: "Le Plateau Sud",
      surface: 3.1250,
      grapeVariety: "Merlot",
      leafStatus: "effeuillee",
      leafServiceName: "Effeuillage manuel face levante",
      leafPrice: 550,
      cutStatus: "a_couper",
      yieldKg: 0,
      boxesCount: 0,
      yieldPricePerKg: 0.35,
      harvestServiceName: "Coupe vendange (au kilo)",
      totalAmountHT: 0,
      haulStatus: "a_debarder",
      haulServiceName: "Débardage vendange (tracteur / porteur)",
      haulPrice: 0.15,
      worker: "Thomas M.",
      harvestDate: today,
      notes: "Parcelle effeuillée côté levant, coupe programmée demain matin.",
      createdAt: new Date().toISOString()
    },
    {
      id: "harv-demo-04",
      clientId: "CLI-1002",
      clientName: "Domaine Belle Vue",
      parcelId: "PAR-04",
      parcelName: "Les Terrasses",
      surface: 1.6400,
      grapeVariety: "Cabernet Franc",
      leafStatus: "a_effeuiller",
      leafServiceName: "Effeuillage manuel face levante",
      leafPrice: 550,
      cutStatus: "a_couper",
      yieldKg: 0,
      boxesCount: 0,
      yieldPricePerKg: 0.35,
      harvestServiceName: "Coupe vendange (au kilo)",
      totalAmountHT: 0,
      haulStatus: "a_debarder",
      haulServiceName: "Débardage vendange (tracteur / porteur)",
      haulPrice: 0.15,
      worker: "Claire B.",
      harvestDate: "",
      notes: "Fin de véraison, à effeuiller avant vendange fin de semaine.",
      createdAt: new Date().toISOString()
    }
  ];
}

// Load isolated user database from localStorage (cache local immédiat)
function loadDatabase() {
  const user = getAuthUser();
  const isDemo = user && (user.isDemo === true || user.email === "exploitant@domaineludinard.fr");

  const clientsKey = getUserStorageKey(STORAGE_CLIENTS_BASE);
  const savedClients = localStorage.getItem(clientsKey);
  if (savedClients) {
    try {
      clients = JSON.parse(savedClients);
    } catch (e) {
      console.error("Erreur de parsing clients, réinitialisation", e);
      clients = [];
    }
  } else {
    // Si compte démo -> démo. Si NOUVEAU COMPTE UTILISATEUR -> 0 CLIENT (TABLEAU DE BORD NU)
    clients = isDemo ? getDemoClients() : [];
    saveClientsLocally();
  }

  const interventionsKey = getUserStorageKey(STORAGE_INTERVENTIONS_BASE);
  const savedInterventions = localStorage.getItem(interventionsKey);
  if (savedInterventions) {
    try {
      interventions = JSON.parse(savedInterventions);
    } catch (e) {
      console.error("Erreur de parsing interventions, réinitialisation", e);
      interventions = [];
    }
  } else {
    // NOUVEL UTILISATEUR -> 0 INTERVENTION (TABLEAU DE BORD NU)
    interventions = isDemo ? getDemoInterventions() : [];
    saveInterventionsLocally();
  }

  const servicesKey = getUserStorageKey(STORAGE_SERVICES_BASE);
  const savedServices = localStorage.getItem(servicesKey);
  if (savedServices) {
    try {
      services = JSON.parse(savedServices);
      let servicesChanged = false;
      if (Array.isArray(services)) {
        // Synchronisation automatique des tarifs effeuillage (550 €/ha) et débardage (0,15 €/kg) du catalogue Prestations
        services.forEach(s => {
          if (s.id === "srv-07" && (s.price === 37 || s.rateType === "hourly")) {
            s.price = 550;
            s.rateType = "surface";
            servicesChanged = true;
          }
          if ((s.id === "srv-debardage-vendange" || (s.name && (s.name.toLowerCase().includes("débardage") || s.name.toLowerCase().includes("debardage")))) && (s.price === 45 || s.rateType === "hourly")) {
            s.price = 0.15;
            s.rateType = "kilo";
            servicesChanged = true;
          }
        });

        if (services.length > 0 && !services.some(s => s.name && (s.name.toLowerCase().includes("débardage") || s.name.toLowerCase().includes("debardage")))) {
          services.push({
            id: "srv-debardage-vendange",
            name: "Débardage vendange (tracteur / porteur)",
            category: "Vendanges & Récolte",
            rateType: "kilo",
            price: 0.15,
            description: "Évacuation des caisses et sorties de rang au tracteur interligne ou chenillard (0,15 €/kg)."
          });
          servicesChanged = true;
        }

        if (servicesChanged) {
          saveServicesLocally();
        }
      }
    } catch (e) {
      console.error("Erreur de parsing prestations", e);
      services = [];
    }
  } else {
    // NOUVEL UTILISATEUR -> 0 PRESTATION DE NOTÉE (TABLEAU DE BORD NU)
    services = isDemo ? [...DEFAULT_SERVICES] : [];
    saveServicesLocally();
  }

  const plannedKey = getUserStorageKey(STORAGE_PLANNED_BASE);
  const savedPlanned = localStorage.getItem(plannedKey);
  if (savedPlanned) {
    try {
      plannedWorks = JSON.parse(savedPlanned);
    } catch (e) {
      console.error("Erreur de parsing travaux planifiés", e);
      plannedWorks = [];
    }
  } else {
    // NOUVEL UTILISATEUR -> 0 TRAVAIL PLANIFIÉ (TABLEAU DE BORD NU)
    plannedWorks = isDemo ? getDemoPlannedWorks() : [];
    savePlannedWorksLocally();
  }

  // VENDANGES & RÉCOLTES PAR PARCELLE
  const harvestKey = getUserStorageKey(STORAGE_HARVEST_BASE);
  const savedHarvest = localStorage.getItem(harvestKey);
  if (savedHarvest) {
    try {
      harvestWorks = JSON.parse(savedHarvest);
      let harvestChanged = false;
      if (Array.isArray(harvestWorks)) {
        harvestWorks.forEach(h => {
          if (h.leafPrice === 37) {
            h.leafPrice = 550;
            harvestChanged = true;
          }
          if (h.leafServiceName && !h.leafServiceName.toLowerCase().includes("effeuillage")) {
            h.leafServiceName = "Effeuillage manuel face levante";
            harvestChanged = true;
          }
          if (h.harvestServiceName && (h.harvestServiceName.toLowerCase().includes("débardage") || h.harvestServiceName.toLowerCase().includes("debardage"))) {
            h.harvestServiceName = "Coupe vendange (au kilo)";
            harvestChanged = true;
          }
          if (h.haulPrice === 45) {
            h.haulPrice = 0.15;
            harvestChanged = true;
          }
          if (h.haulServiceName && (h.haulServiceName.toLowerCase().includes("coupe") || h.haulServiceName.toLowerCase().includes("récolte") || h.haulServiceName.toLowerCase().includes("recolte"))) {
            h.haulServiceName = "Débardage vendange (tracteur / porteur)";
            harvestChanged = true;
          }
        });
        if (harvestChanged) {
          saveHarvestWorksLocally();
        }
      }
    } catch (e) {
      console.error("Erreur de parsing vendanges", e);
      harvestWorks = [];
    }
  } else {
    // NOUVEL UTILISATEUR -> 0 PARCELLE EN VENDANGE (TABLEAU DE BORD NU)
    harvestWorks = isDemo ? getDemoHarvestWorks() : [];
    saveHarvestWorksLocally();
  }

  // ÉQUIPE & UTILISATEURS DU DOMAINE
  const teamKey = getUserStorageKey(STORAGE_TEAM_BASE);
  const savedTeam = localStorage.getItem(teamKey);
  if (savedTeam) {
    try {
      teamUsers = JSON.parse(savedTeam);
    } catch (e) {
      console.error("Erreur de parsing équipe, réinitialisation", e);
      teamUsers = [];
    }
  } else {
    // Si compte démo -> 4 utilisateurs démo (1 gérant + 3 salariés/tractoristes).
    // Si nouvel utilisateur -> 1 utilisateur initial (Gérant)
    teamUsers = isDemo ? getDemoTeamUsers() : getFreshTeamUsers(user);
    saveTeamLocally();
  }
  syncGlobalTeamDirectory();
  // Synchronisation automatique de tous les membres d'équipe vers Supabase Auth
  if (!isDemo && Array.isArray(teamUsers) && teamUsers.length > 0) {
    teamUsers.forEach(member => {
      if (member && member.email) syncTeamUserToSupabaseAuth(member);
    });
  }

  // Détection et réparation immédiate des collisions d'IDs dans le stockage local
  repairLocalCollisions();
}

// Local cache functions (user-isolated)
function saveClientsLocally() {
  localStorage.setItem(getUserStorageKey(STORAGE_CLIENTS_BASE), JSON.stringify(clients));
}

function saveInterventionsLocally() {
  localStorage.setItem(getUserStorageKey(STORAGE_INTERVENTIONS_BASE), JSON.stringify(interventions));
}

function saveServicesLocally() {
  localStorage.setItem(getUserStorageKey(STORAGE_SERVICES_BASE), JSON.stringify(services));
}

function savePlannedWorksLocally() {
  localStorage.setItem(getUserStorageKey(STORAGE_PLANNED_BASE), JSON.stringify(plannedWorks));
}

function saveHarvestWorksLocally() {
  localStorage.setItem(getUserStorageKey(STORAGE_HARVEST_BASE), JSON.stringify(harvestWorks));
}

function saveHarvestWorks() {
  saveHarvestWorksLocally();
}

function saveTeamLocally() {
  localStorage.setItem(getUserStorageKey(STORAGE_TEAM_BASE), JSON.stringify(teamUsers));
}

function saveTeamUsers() {
  saveTeamLocally();
  syncGlobalTeamDirectory();
  if (typeof populateVendangesTeamFilter === "function") populateVendangesTeamFilter();
  // Synchronisation immédiate vers Supabase Auth pour chaque membre ayant un email
  const authUser = getAuthUser();
  const isDemo = authUser && (authUser.isDemo === true || authUser.email === "exploitant@domaineludinard.fr");
  if (!isDemo && Array.isArray(teamUsers)) {
    teamUsers.forEach(member => {
      if (member && member.email) syncTeamUserToSupabaseAuth(member);
    });
  }
}

// Unified save functions: Local cache + Background Supabase Sync
function saveClients() {
  saveClientsLocally();
  clients.forEach(c => syncClientToSupabase(c));
}

function saveInterventions(specificInv = null) {
  saveInterventionsLocally();
  if (specificInv) {
    syncInterventionToSupabase(specificInv);
  } else if (interventions.length > 0) {
    interventions.forEach(inv => syncInterventionToSupabase(inv));
  }
}

function saveServices() {
  saveServicesLocally();
  services.forEach(s => syncServiceToSupabase(s));
}

function savePlannedWorks(specificPw = null) {
  savePlannedWorksLocally();
  if (specificPw) {
    syncPlannedWorkToSupabase(specificPw);
  } else if (plannedWorks.length > 0) {
    plannedWorks.forEach(pw => syncPlannedWorkToSupabase(pw));
  }
}

// ==================== SUPABASE CLOUD SYNCHRONIZATION ====================

async function initSupabaseSync() {
  if (!window.supabaseClient) {
    if (window.updateSupabaseBadge) {
      window.updateSupabaseBadge(false, "Mode Local (Offline)");
    }
    return;
  }

  const isOnline = await window.testSupabaseConnection();
  if (!isOnline) {
    console.log("🍇 [VitiTrack Pro] Supabase non prêt ou tables à initialiser. Fonctionnement sur cache local.");
    return;
  }

  console.log("🍇 [VitiTrack Pro] Supabase en ligne ! Chargement des données utilisateur...");
  await loadFromSupabase();
}

async function loadFromSupabase() {
  try {
    const sb = window.supabaseClient;
    const userId = getAuthUserId();

    // 1. Fetch Clients with Parcelles strictly for current user
    const { data: dbClients, error: errClients } = await sb
      .from("clients")
      .select("*, parcelles(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    // 2. Fetch Interventions strictly for current user
    const { data: dbInv, error: errInv } = await sb
      .from("interventions")
      .select("*")
      .eq("user_id", userId)
      .order("datetime", { ascending: false });

    // 3. Fetch Services strictly for current user
    const { data: dbSrv, error: errSrv } = await sb
      .from("services")
      .select("*")
      .eq("user_id", userId)
      .order("id", { ascending: true });

    // 4. Fetch Planned Works strictly for current user
    const { data: dbPw, error: errPw } = await sb
      .from("planned_works")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (errClients || errInv || errSrv || errPw) {
      console.warn("⚠️ [VitiTrack Pro] Notice Supabase :", errClients || errInv || errSrv || errPw);
      return;
    }

    const hasCloudData = (dbClients && dbClients.length > 0) || 
                         (dbInv && dbInv.length > 0) || 
                         (dbSrv && dbSrv.length > 0) || 
                         (dbPw && dbPw.length > 0);

    if (hasCloudData) {
      // Map Cloud Clients & Parcelles
      clients = (dbClients || []).map(c => ({
        id: c.id,
        name: c.name,
        commune: c.commune || "",
        contact: c.contact || "",
        phone: c.phone || "",
        email: c.email || "",
        notes: c.notes || "",
        createdAt: c.created_at || new Date().toISOString(),
        parcels: (c.parcelles || []).map(p => ({
          id: p.id,
          name: p.name,
          surface: parseFloat(p.surface || 0),
          grape: p.grape || "Non spécifié",
          soil: p.soil || "Non renseigné"
        }))
      }));

      // Map Cloud Interventions
      interventions = (dbInv || []).map(inv => ({
        id: inv.id,
        datetime: inv.datetime,
        worker: inv.worker || "",
        clientId: inv.client_id || "",
        client: inv.client,
        parcelId: inv.parcel_id || "",
        parcel: inv.parcel,
        serviceId: inv.service_id || "",
        task: inv.task,
        rateType: inv.rate_type || "hourly",
        quantity: parseFloat(inv.quantity || 0),
        unit: inv.unit || "",
        unitPrice: parseFloat(inv.unit_price || 0),
        total: parseFloat(inv.total || 0),
        status: inv.status || "À facturer",
        notes: inv.notes || ""
      }));

      // Map Cloud Services if present
      if (dbSrv && dbSrv.length > 0) {
        services = dbSrv.map(s => ({
          id: s.id,
          name: s.name,
          category: s.category,
          rateType: s.rate_type,
          price: parseFloat(s.price || 0),
          description: s.description || ""
        }));
      } else {
        services = [];
      }

      // Map Cloud Planned Works
      if (dbPw) {
        plannedWorks = dbPw.map(pw => ({
          id: pw.id,
          clientId: pw.client_id || "",
          clientName: pw.client_name,
          parcel: pw.parcel,
          service: pw.service,
          worker: pw.worker || "Non assigné",
          date: pw.date || "",
          quantity: parseFloat(pw.quantity || 0),
          status: pw.status || "À réaliser",
          notes: pw.notes || ""
        }));
      }

      // Détection et réparation préventive des éventuelles collisions avant mise en cache local
      repairLocalCollisions();

      // Save fresh data to user's isolated local cache
      saveClientsLocally();
      saveInterventionsLocally();
      saveServicesLocally();
      savePlannedWorksLocally();

      // Récupération et synchronisation des collaborateurs du domaine depuis Cloud Supabase Auth
      if (typeof window.fetchTeamMembersFromCloud === "function") {
        try {
          const authUser = getAuthUser();
          const cloudMembers = await window.fetchTeamMembersFromCloud(userId, authUser?.email || "");
          if (cloudMembers && cloudMembers.length > 0) {
            let teamChanged = false;
            cloudMembers.forEach(cm => {
              const existingIdx = (teamUsers || []).findIndex(u => 
                (u.email && u.email.toLowerCase() === (cm.email || "").toLowerCase()) || u.id === cm.id
              );
              if (existingIdx !== -1) {
                teamUsers[existingIdx] = { ...teamUsers[existingIdx], ...cm };
                teamChanged = true;
              } else {
                teamUsers.push(cm);
                teamChanged = true;
              }
            });
            if (teamChanged) {
              saveTeamLocally();
              syncGlobalTeamDirectory();
              renderTeamList();
              renderKPIs();
              populatePlannedWorkerSelect();
            }
          }
        } catch (e) {
          console.warn("Notice fetchTeamMembersFromCloud in loadFromSupabase:", e);
        }
      }

      renderAll();
      if (window.updateSupabaseBadge) {
        window.updateSupabaseBadge(true, "Cloud Supabase synchronisé");
      }
    } else {
      // Utilisateur sans données cloud existantes
      const user = getAuthUser();
      const isDemo = user && (user.isDemo === true || user.email === "exploitant@domaineludinard.fr");
      if (!isDemo) {
        // TABLEAU DE BORD INTÉGRALEMENT NU (0 client, 0 parcelle, 0 prestation, 0 intervention)
        clients = [];
        interventions = [];
        services = [];
        plannedWorks = [];
        saveClientsLocally();
        saveInterventionsLocally();
        saveServicesLocally();
        savePlannedWorksLocally();
        renderAll();
      }
      if (window.updateSupabaseBadge) {
        window.updateSupabaseBadge(true, "Cloud connecté • Prêt");
      }
    }
  } catch (e) {
    console.error("❌ [VitiTrack Pro] Erreur chargement Supabase :", e);
  }
}

// Bulk sync from local data to Supabase Cloud (with user_id isolation)
window.migrateAllToSupabase = async function() {
  if (!window.supabaseClient) {
    showToast("SDK Supabase non connecté.", "warning");
    return;
  }

  showToast("Synchronisation vers Supabase en cours...", "info");

  try {
    // 0. Réparation préventive des collisions d'identifiants avant envoi
    repairLocalCollisions();

    const sb = window.supabaseClient;
    const userId = getAuthUserId();

    // 1. Clients
    if (clients.length > 0) {
      const clientsPayload = clients.map(c => ({
        id: c.id,
        user_id: userId,
        name: c.name,
        commune: c.commune || "",
        contact: c.contact || "",
        phone: c.phone || "",
        email: c.email || "",
        notes: c.notes || ""
      }));

      const valCli = validatePayloadUniqueIds(clientsPayload, "clients");
      if (!valCli.valid) throw new Error(valCli.reason);

      const { error: errCli } = await sb.from("clients").upsert(clientsPayload);
      if (errCli) throw errCli;

      // 2. Parcelles
      const allParcels = [];
      clients.forEach(c => {
        if (c.parcels && c.parcels.length > 0) {
          c.parcels.forEach(p => {
            allParcels.push({
              id: p.id,
              user_id: userId,
              client_id: c.id,
              name: p.name,
              surface: p.surface,
              grape: p.grape || "",
              soil: p.soil || ""
            });
          });
        }
      });
      if (allParcels.length > 0) {
        const valParc = validatePayloadUniqueIds(allParcels, "parcelles");
        if (!valParc.valid) throw new Error(valParc.reason);

        const { error: errParc } = await sb.from("parcelles").upsert(allParcels);
        if (errParc) throw errParc;
      }
    }

    // 3. Prestations
    if (services.length > 0) {
      const servicesPayload = services.map(s => ({
        id: s.id,
        user_id: userId,
        name: s.name,
        category: s.category,
        rate_type: s.rateType,
        price: s.price,
        description: s.description || ""
      }));

      const valSrv = validatePayloadUniqueIds(servicesPayload, "prestations (services)");
      if (!valSrv.valid) throw new Error(valSrv.reason);

      const { error: errSrv } = await sb.from("services").upsert(servicesPayload);
      if (errSrv) throw errSrv;
    }

    // 4. Interventions
    if (interventions.length > 0) {
      const interventionsPayload = interventions.map(inv => ({
        id: inv.id,
        user_id: userId,
        client_id: inv.clientId || null,
        client: inv.client,
        parcel_id: inv.parcelId || "",
        parcel: inv.parcel,
        service_id: inv.serviceId || "",
        task: inv.task,
        worker: inv.worker || "",
        datetime: inv.datetime || new Date().toISOString(),
        quantity: inv.quantity || 1,
        rate_type: inv.rateType || "hourly",
        unit: inv.unit || "",
        unit_price: inv.unitPrice || 0,
        total: inv.total || 0,
        status: inv.status || "À facturer",
        notes: inv.notes || ""
      }));

      const valInv = validatePayloadUniqueIds(interventionsPayload, "interventions");
      if (!valInv.valid) throw new Error(valInv.reason);

      const { error: errInv } = await sb.from("interventions").upsert(interventionsPayload);
      if (errInv) throw errInv;
    }

    // 5. Travaux Planifiés
    if (plannedWorks.length > 0) {
      const plannedPayload = plannedWorks.map(pw => ({
        id: pw.id,
        user_id: userId,
        client_id: pw.clientId || null,
        client_name: pw.clientName,
        parcel: pw.parcel,
        service: pw.service,
        worker: pw.worker || "Non assigné",
        date: pw.date || "",
        quantity: pw.quantity || 0,
        status: pw.status || "À réaliser",
        notes: pw.notes || ""
      }));

      const valPw = validatePayloadUniqueIds(plannedPayload, "travaux planifiés (planned_works)");
      if (!valPw.valid) throw new Error(valPw.reason);

      const { error: errPw } = await sb.from("planned_works").upsert(plannedPayload);
      if (errPw) throw errPw;
    }

    if (window.updateSupabaseBadge) {
      window.updateSupabaseBadge(true, "Cloud Supabase synchronisé");
    }
    showToast("Toutes vos données sont désormais synchronisées sur Supabase !", "success");
  } catch (err) {
    console.error("❌ Erreur de synchronisation Supabase :", err);
    showToast(`Erreur de synchronisation : ${err.message || err}`, "danger");
  }
};

// Sync single Client + Parcelles
async function syncClientToSupabase(client) {
  if (!window.supabaseClient || !window.isSupabaseOnline) return;
  try {
    const userId = getAuthUserId();
    const { error: errCli } = await window.supabaseClient
      .from("clients")
      .upsert({
        id: client.id,
        user_id: userId,
        name: client.name,
        commune: client.commune || "",
        contact: client.contact || "",
        phone: client.phone || "",
        email: client.email || "",
        notes: client.notes || "",
        updated_at: new Date().toISOString()
      });
    if (errCli) {
      console.error(`❌ [VitiTrack Pro] Erreur sync client « ${client.name} » :`, errCli);
      return;
    }

    if (client.parcels && client.parcels.length > 0) {
      const parcelsData = client.parcels.map(p => ({
        id: p.id,
        user_id: userId,
        client_id: client.id,
        name: p.name,
        surface: p.surface,
        grape: p.grape || "",
        soil: p.soil || ""
      }));

      const val = validatePayloadUniqueIds(parcelsData, `parcelles de « ${client.name} »`);
      if (!val.valid) {
        console.error(`❌ [VitiTrack Pro] Upsert parcelles annulé pour « ${client.name} » : collision détectée ! (${val.reason})`);
        return;
      }

      const { error: errParc } = await window.supabaseClient.from("parcelles").upsert(parcelsData);
      if (errParc) {
        console.error(`❌ [VitiTrack Pro] Erreur sync parcelles pour « ${client.name} » :`, errParc);
      }
    }
  } catch (err) {
    console.error(`❌ [VitiTrack Pro] Exception syncClientToSupabase pour « ${client.name} » :`, err);
  }
}

// Delete Client from Supabase
async function deleteClientFromSupabase(clientId) {
  if (!window.supabaseClient || !window.isSupabaseOnline) return;
  try {
    await window.supabaseClient
      .from("clients")
      .delete()
      .eq("id", clientId)
      .eq("user_id", getAuthUserId());
  } catch (err) {
    console.warn("Notice suppression client Supabase :", err);
  }
}

// Sync single Parcel to Supabase
async function syncParcelToSupabase(clientId, parcel) {
  if (!window.supabaseClient || !window.isSupabaseOnline) return;
  try {
    await window.supabaseClient.from("parcelles").upsert({
      id: parcel.id,
      user_id: getAuthUserId(),
      client_id: clientId,
      name: parcel.name,
      surface: parcel.surface,
      grape: parcel.grape || "",
      soil: parcel.soil || ""
    });
  } catch (err) {
    console.warn("Notice sync parcelle Supabase :", err);
  }
}

// Delete Parcel from Supabase
async function deleteParcelFromSupabase(parcelId) {
  if (!window.supabaseClient || !window.isSupabaseOnline) return;
  try {
    await window.supabaseClient
      .from("parcelles")
      .delete()
      .eq("id", parcelId)
      .eq("user_id", getAuthUserId());
  } catch (err) {
    console.warn("Notice suppression parcelle Supabase :", err);
  }
}

// Sync single Intervention to Supabase
async function syncInterventionToSupabase(inv) {
  if (!window.supabaseClient || !window.isSupabaseOnline) return;
  try {
    await window.supabaseClient
      .from("interventions")
      .upsert({
        id: inv.id,
        user_id: getAuthUserId(),
        client_id: inv.clientId || null,
        client: inv.client,
        parcel_id: inv.parcelId || "",
        parcel: inv.parcel,
        service_id: inv.serviceId || "",
        task: inv.task,
        worker: inv.worker || "",
        datetime: inv.datetime || new Date().toISOString(),
        quantity: inv.quantity || 1,
        rate_type: inv.rateType || "hourly",
        unit: inv.unit || "",
        unit_price: inv.unitPrice || 0,
        total: inv.total || 0,
        status: inv.status || "À facturer",
        notes: inv.notes || "",
        updated_at: new Date().toISOString()
      });
  } catch (err) {
    console.warn("Notice sync intervention Supabase :", err);
  }
}

// Sync status toggle to Supabase
async function syncInterventionStatusToSupabase(id, newStatus) {
  if (!window.supabaseClient || !window.isSupabaseOnline) return;
  try {
    await window.supabaseClient
      .from("interventions")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", getAuthUserId());
  } catch (err) {
    console.warn("Notice mise à jour statut intervention Supabase :", err);
  }
}

// Delete Intervention from Supabase
async function deleteInterventionFromSupabase(id) {
  if (!window.supabaseClient || !window.isSupabaseOnline) return;
  try {
    await window.supabaseClient
      .from("interventions")
      .delete()
      .eq("id", id)
      .eq("user_id", getAuthUserId());
  } catch (err) {
    console.warn("Notice suppression intervention Supabase :", err);
  }
}

// Sync single Service to Supabase
async function syncServiceToSupabase(srv) {
  if (!window.supabaseClient || !window.isSupabaseOnline) return;
  try {
    await window.supabaseClient.from("services").upsert({
      id: srv.id,
      user_id: getAuthUserId(),
      name: srv.name,
      category: srv.category,
      rate_type: srv.rateType,
      price: srv.price,
      description: srv.description || ""
    });
  } catch (err) {
    console.warn("Notice sync prestation Supabase :", err);
  }
}

// Delete Service from Supabase
async function deleteServiceFromSupabase(id) {
  if (!window.supabaseClient || !window.isSupabaseOnline) return;
  try {
    await window.supabaseClient
      .from("services")
      .delete()
      .eq("id", id)
      .eq("user_id", getAuthUserId());
  } catch (err) {
    console.warn("Notice suppression prestation Supabase :", err);
  }
}

// Sync Planned Work to Supabase
async function syncPlannedWorkToSupabase(pw) {
  if (!window.supabaseClient || !window.isSupabaseOnline) return;
  try {
    await window.supabaseClient.from("planned_works").upsert({
      id: pw.id,
      user_id: getAuthUserId(),
      client_id: pw.clientId || null,
      client_name: pw.clientName,
      parcel: pw.parcel,
      service: pw.service,
      worker: pw.worker || "Non assigné",
      date: pw.date || "",
      quantity: pw.quantity || 0,
      status: pw.status || "À réaliser",
      notes: pw.notes || ""
    });
  } catch (err) {
    console.warn("Notice sync travail planifié Supabase :", err);
  }
}

// Delete Planned Work from Supabase
async function deletePlannedWorkFromSupabase(id) {
  if (!window.supabaseClient || !window.isSupabaseOnline) return;
  try {
    await window.supabaseClient
      .from("planned_works")
      .delete()
      .eq("id", id)
      .eq("user_id", getAuthUserId());
  } catch (err) {
    console.warn("Notice suppression travail planifié Supabase :", err);
  }
}

// ==================== EVENT LISTENERS SETUP ====================
function setupEventListeners() {
  // Mobile Sidebar
  const mobileMenuToggle = document.getElementById("mobile-menu-toggle");
  const sidebar = document.getElementById("sidebar");
  const sidebarClose = document.getElementById("sidebar-close");
  const sidebarBackdrop = document.getElementById("sidebar-backdrop");

  if (mobileMenuToggle && sidebar) {
    mobileMenuToggle.addEventListener("click", () => {
      sidebar.classList.add("open");
      if (sidebarBackdrop) sidebarBackdrop.classList.add("active");
    });
  }

  const closeSidebar = () => {
    if (sidebar) sidebar.classList.remove("open");
    if (sidebarBackdrop) sidebarBackdrop.classList.remove("active");
  };

  if (sidebarClose) sidebarClose.addEventListener("click", closeSidebar);
  if (sidebarBackdrop) sidebarBackdrop.addEventListener("click", closeSidebar);

  // Navigation View Switching
  const navOverview = document.getElementById("nav-btn-overview");
  const navCalendar = document.getElementById("nav-btn-calendar");
  const navClients = document.getElementById("nav-btn-clients");
  const navServices = document.getElementById("nav-btn-services");
  const navPlanned = document.getElementById("nav-btn-planned");
  const navVendanges = document.getElementById("nav-btn-vendanges");
  const navClientHistory = document.getElementById("nav-btn-client-history");
  const navInterventions = document.getElementById("nav-btn-interventions");
  const navBilling = document.getElementById("nav-btn-billing");

  if (navOverview) navOverview.addEventListener("click", (e) => { e.preventDefault(); switchView("overview"); closeSidebar(); });
  if (navCalendar) navCalendar.addEventListener("click", (e) => { e.preventDefault(); switchView("calendar"); closeSidebar(); });
  if (navClientHistory) navClientHistory.addEventListener("click", (e) => { e.preventDefault(); switchView("client-history"); closeSidebar(); });
  if (navClients) navClients.addEventListener("click", (e) => { e.preventDefault(); switchView("clients"); closeSidebar(); });
  if (navServices) navServices.addEventListener("click", (e) => { e.preventDefault(); switchView("services"); closeSidebar(); });
  if (navPlanned) navPlanned.addEventListener("click", (e) => { e.preventDefault(); switchView("planned"); closeSidebar(); });
  if (navVendanges) navVendanges.addEventListener("click", (e) => { e.preventDefault(); switchView("vendanges"); closeSidebar(); });
  if (navInterventions) navInterventions.addEventListener("click", (e) => {
    e.preventDefault();
    switchView("interventions");
    closeSidebar();
  });
  if (navBilling) navBilling.addEventListener("click", (e) => {
    e.preventDefault();
    switchView("billing");
    closeSidebar();
  });

  if (typeof initCalendarControls === "function") {
    initCalendarControls();
  }

  // Mobile Bottom Navigation Bar Listeners
  const mNavOverview = document.getElementById("mobile-nav-overview");
  const mNavClients = document.getElementById("mobile-nav-clients");
  const mNavServices = document.getElementById("mobile-nav-services");
  const mNavCreate = document.getElementById("mobile-nav-create");
  const mNavMenu = document.getElementById("mobile-nav-menu");

  if (mNavOverview) mNavOverview.addEventListener("click", () => { switchView("overview"); closeSidebar(); });
  if (mNavClients) mNavClients.addEventListener("click", () => { switchView("clients"); closeSidebar(); });
  if (mNavServices) mNavServices.addEventListener("click", () => { switchView("services"); closeSidebar(); });
  if (mNavCreate) mNavCreate.addEventListener("click", () => { openCreateModal(); closeSidebar(); });
  if (mNavMenu) mNavMenu.addEventListener("click", () => {
    if (sidebar) sidebar.classList.add("open");
    if (sidebarBackdrop) sidebarBackdrop.classList.add("active");
  });

  // User Logout handlers
  const topbarLogoutBtn = document.getElementById("btn-topbar-logout");
  const sidebarLogoutBtn = document.getElementById("sidebar-logout-btn");

  if (topbarLogoutBtn) topbarLogoutBtn.addEventListener("click", handleLogout);
  if (sidebarLogoutBtn) sidebarLogoutBtn.addEventListener("click", handleLogout);

  // Client creation buttons
  const topbarAddClient = document.getElementById("topbar-add-client-btn");
  const sidebarAddClient = document.getElementById("sidebar-add-client-btn");
  const viewAddClient = document.getElementById("btn-view-add-client");
  const emptyFirstClient = document.getElementById("btn-create-first-client");
  const emptyAddClient = document.getElementById("btn-empty-add-client");
  const quickAddClient = document.getElementById("btn-quick-add-client");

  const openClientHandler = (e) => {
    if (e) e.preventDefault();
    openClientModal();
    closeSidebar();
  };

  if (topbarAddClient) topbarAddClient.addEventListener("click", openClientHandler);
  if (sidebarAddClient) sidebarAddClient.addEventListener("click", openClientHandler);
  if (viewAddClient) viewAddClient.addEventListener("click", openClientHandler);
  if (emptyFirstClient) emptyFirstClient.addEventListener("click", openClientHandler);
  if (emptyAddClient) emptyAddClient.addEventListener("click", openClientHandler);
  if (quickAddClient) quickAddClient.addEventListener("click", openClientHandler);

  // Stripe Subscription button
  const sidebarSubBtn = document.getElementById("sidebar-sub-btn");
  if (sidebarSubBtn) {
    sidebarSubBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openSubscriptionModal();
      closeSidebar();
    });
  }

  // Prestations & Travaux creation buttons
  const sidebarAddService = document.getElementById("sidebar-add-service-btn");
  const viewAddService = document.getElementById("btn-view-add-service");
  const sidebarAddPlanned = document.getElementById("sidebar-add-planned-btn");
  const viewAddPlanned = document.getElementById("btn-view-add-planned");
  const addPlannedTable = document.getElementById("btn-add-planned-table");
  const emptyAddPlanned = document.getElementById("btn-empty-add-planned");

  if (sidebarAddService) sidebarAddService.addEventListener("click", (e) => { e.preventDefault(); openServiceModal(); closeSidebar(); });
  if (viewAddService) viewAddService.addEventListener("click", () => openServiceModal());
  if (sidebarAddPlanned) sidebarAddPlanned.addEventListener("click", (e) => { e.preventDefault(); openPlannedModal(); closeSidebar(); });
  if (viewAddPlanned) viewAddPlanned.addEventListener("click", () => openPlannedModal());
  if (addPlannedTable) addPlannedTable.addEventListener("click", () => openPlannedModal());
  if (emptyAddPlanned) emptyAddPlanned.addEventListener("click", () => openPlannedModal());

  // Services View Subnav Tabs & Filters
  const tabBtnCatalog = document.getElementById("tab-btn-catalog");
  const tabBtnPlanned = document.getElementById("tab-btn-planned");

  if (tabBtnCatalog) {
    tabBtnCatalog.addEventListener("click", () => {
      servicesActiveSubtab = "catalog";
      tabBtnCatalog.classList.add("active");
      if (tabBtnPlanned) tabBtnPlanned.classList.remove("active");
      const catContent = document.getElementById("services-catalog-tab-content");
      const planContent = document.getElementById("services-planned-tab-content");
      if (catContent) catContent.style.display = "block";
      if (planContent) planContent.style.display = "none";
      const searchWrapper = document.getElementById("services-search-wrapper");
      if (searchWrapper) searchWrapper.style.display = "block";

      const navSrv = document.getElementById("nav-btn-services");
      const navPln = document.getElementById("nav-btn-planned");
      if (navSrv) navSrv.classList.add("active");
      if (navPln) navPln.classList.remove("active");
    });
  }

  if (tabBtnPlanned) {
    tabBtnPlanned.addEventListener("click", () => {
      servicesActiveSubtab = "planned";
      tabBtnPlanned.classList.add("active");
      if (tabBtnCatalog) tabBtnCatalog.classList.remove("active");
      const catContent = document.getElementById("services-catalog-tab-content");
      const planContent = document.getElementById("services-planned-tab-content");
      if (catContent) catContent.style.display = "none";
      if (planContent) planContent.style.display = "block";
      const searchWrapper = document.getElementById("services-search-wrapper");
      if (searchWrapper) searchWrapper.style.display = "none";

      const navSrv = document.getElementById("nav-btn-services");
      const navPln = document.getElementById("nav-btn-planned");
      if (navPln) navPln.classList.add("active");
      if (navSrv) navSrv.classList.remove("active");

      renderPlannedWorks();
    });
  }

  const servicesSearchInput = document.getElementById("services-search-input");
  if (servicesSearchInput) {
    servicesSearchInput.addEventListener("input", (e) => {
      servicesSearchFilter = e.target.value.toLowerCase().trim();
      renderServices();
    });
  }

  // Dropdown Filter for Services Categories
  const servicesFilterCategory = document.getElementById("services-filter-category");
  const wrapServicesCat = document.getElementById("wrap-services-cat");
  if (servicesFilterCategory) {
    servicesFilterCategory.addEventListener("change", (e) => {
      servicesCategoryFilter = e.target.value;
      if (wrapServicesCat) {
        wrapServicesCat.classList.toggle("is-active", servicesCategoryFilter !== "all");
      }
      updateServicesFilterResetBtn();
      renderServices();
    });
  }

  // Dropdown Filter for Services Rate Types
  const servicesFilterRate = document.getElementById("services-filter-rate");
  const wrapServicesRate = document.getElementById("wrap-services-rate");
  if (servicesFilterRate) {
    servicesFilterRate.addEventListener("change", (e) => {
      servicesRateTypeFilter = e.target.value;
      if (wrapServicesRate) {
        wrapServicesRate.classList.toggle("is-active", servicesRateTypeFilter !== "all");
      }
      updateServicesFilterResetBtn();
      renderServices();
    });
  }

  // Modal Service Rate Type Select (Nouvelle Prestation)
  const serviceRateSelect = document.getElementById("input-service-rate-type");
  if (serviceRateSelect) {
    serviceRateSelect.addEventListener("change", (e) => {
      updateServicePriceLabel(e.target.value);
    });
  }

  // Intervention creation buttons
  const openModalBtn = document.getElementById("btn-open-create-modal");
  const openModalBottomBtn = document.getElementById("btn-open-create-bottom");
  const emptyAddIntervention = document.getElementById("btn-empty-add-intervention");
  const createTableTopBtn = document.getElementById("btn-create-table-top");
  const exportTableTopBtn = document.getElementById("btn-export-table-top");

  if (openModalBtn) openModalBtn.addEventListener("click", () => openCreateModal());
  if (openModalBottomBtn) openModalBottomBtn.addEventListener("click", () => openCreateModal());
  if (emptyAddIntervention) emptyAddIntervention.addEventListener("click", () => openCreateModal());
  if (createTableTopBtn) createTableTopBtn.addEventListener("click", () => openCreateModal());
  if (exportTableTopBtn) exportTableTopBtn.addEventListener("click", exportCSV);

  // Modal Closers
  setupModalCloser("create-modal", "modal-close-btn", "modal-cancel-btn", closeCreateModal);
  setupModalCloser("client-modal", "client-modal-close-btn", "client-modal-cancel-btn", closeClientModal);
  setupModalCloser("parcel-modal", "parcel-modal-close-btn", "parcel-modal-cancel-btn", closeParcelModal);
  setupModalCloser("detail-modal", "detail-close-btn", "detail-dismiss-btn", closeDetailModal);
  setupModalCloser("service-modal", "service-modal-close-btn", "service-modal-cancel-btn", closeServiceModal);
  setupModalCloser("planned-modal", "planned-modal-close-btn", "planned-modal-cancel-btn", closePlannedModal);
  setupModalCloser("client-dossier-modal", "dossier-modal-close-btn", "dossier-modal-dismiss-btn", closeClientDossier);
  setupModalCloser("subscription-modal", "subscription-modal-close-btn", "sub-modal-close-btn", closeSubscriptionModal);
  setupModalCloser("team-modal", "team-modal-close-btn", null, closeTeamModal);
  setupModalCloser("team-member-modal", null, null, closeTeamMemberModal);
  setupModalCloser("harvest-modal", "harvest-modal-close-btn", null, closeHarvestModal);
  setupModalCloser("harvest-yield-modal", null, null, closeYieldModal);

  // Forms Submissions
  const clientForm = document.getElementById("create-client-form");
  if (clientForm) clientForm.addEventListener("submit", handleCreateClientSubmit);

  const parcelForm = document.getElementById("create-parcel-form");
  if (parcelForm) parcelForm.addEventListener("submit", handleCreateParcelSubmit);

  const interventionForm = document.getElementById("create-intervention-form");
  if (interventionForm) interventionForm.addEventListener("submit", handleCreateInterventionSubmit);

  const serviceForm = document.getElementById("create-service-form");
  if (serviceForm) serviceForm.addEventListener("submit", handleCreateServiceSubmit);

  const plannedForm = document.getElementById("create-planned-form");
  if (plannedForm) plannedForm.addEventListener("submit", handleCreatePlannedSubmit);

  // Vendanges Forms & Buttons
  const harvestForm = document.getElementById("harvest-form");
  if (harvestForm) harvestForm.addEventListener("submit", handleHarvestFormSubmit);

  const yieldQuickForm = document.getElementById("yield-quick-form");
  if (yieldQuickForm) yieldQuickForm.addEventListener("submit", handleYieldQuickFormSubmit);

  const quickYieldKg = document.getElementById("quick-input-yield-kg");
  const quickYieldPrice = document.getElementById("quick-input-yield-price");
  if (quickYieldKg) quickYieldKg.addEventListener("input", updateYieldModalLiveCalculation);
  if (quickYieldPrice) quickYieldPrice.addEventListener("input", updateYieldModalLiveCalculation);

  const harvestYieldKg = document.getElementById("input-harvest-yield-kg");
  const harvestYieldPrice = document.getElementById("input-harvest-price-kg");
  if (harvestYieldKg) harvestYieldKg.addEventListener("input", updateHarvestModalLiveCalculation);
  if (harvestYieldPrice) harvestYieldPrice.addEventListener("input", updateHarvestModalLiveCalculation);

  const sidebarAddHarvestBtn = document.getElementById("sidebar-add-harvest-btn");
  const btnOpenHarvestModal = document.getElementById("btn-open-harvest-modal");
  if (sidebarAddHarvestBtn) sidebarAddHarvestBtn.addEventListener("click", (e) => { e.preventDefault(); openHarvestModal(); closeSidebar(); });
  if (btnOpenHarvestModal) btnOpenHarvestModal.addEventListener("click", () => openHarvestModal());

  const harvestClientSelect = document.getElementById("input-harvest-client");
  if (harvestClientSelect) harvestClientSelect.addEventListener("change", handleHarvestClientChange);

  const harvestParcelSelect = document.getElementById("input-harvest-parcel");
  if (harvestParcelSelect) harvestParcelSelect.addEventListener("change", handleHarvestParcelChange);

  const harvestCutSelect = document.getElementById("input-harvest-cut");
  if (harvestCutSelect) {
    harvestCutSelect.addEventListener("change", (e) => {
      const yieldBox = document.getElementById("harvest-yield-box");
      if (yieldBox) {
        yieldBox.style.display = e.target.value === "coupee" ? "block" : "none";
      }
    });
  }

  const vendangesSearchInput = document.getElementById("vendanges-search-input");
  const vendangesSearchClear = document.getElementById("vendanges-search-clear");
  const vendangesFilterClient = document.getElementById("vendanges-filter-client");
  const vendangesFilterStage = document.getElementById("vendanges-filter-stage");

  if (vendangesSearchInput) {
    vendangesSearchInput.addEventListener("input", (e) => {
      vendangesSearchFilter = e.target.value.toLowerCase().trim();
      if (vendangesSearchClear) vendangesSearchClear.style.display = vendangesSearchFilter ? "block" : "none";
      renderVendangesTable();
    });
  }
  if (vendangesSearchClear) {
    vendangesSearchClear.addEventListener("click", () => {
      if (vendangesSearchInput) vendangesSearchInput.value = "";
      vendangesSearchFilter = "";
      vendangesSearchClear.style.display = "none";
      renderVendangesTable();
    });
  }
  initVendangesClientFilterMultiSelect();
  initVendangesStageFilterDropdown();
  initClientHistoryFilterMultiSelect();
  initClientHistoryParcelFilterMultiSelect();

  const btnResetVendanges = document.getElementById("btn-reset-vendanges-filters");
  if (btnResetVendanges) {
    btnResetVendanges.addEventListener("click", () => {
      resetVendangesFilters();
    });
  }

  // Historique Client Search Listener
  const chSearchInput = document.getElementById("ch-search-input");
  const chSearchClear = document.getElementById("ch-search-clear");
  if (chSearchInput) {
    chSearchInput.addEventListener("input", (e) => {
      clientHistorySearchFilter = e.target.value.toLowerCase().trim();
      if (chSearchClear) chSearchClear.style.display = clientHistorySearchFilter ? "block" : "none";
      updateClientHistoryData();
    });
  }
  if (chSearchClear) {
    chSearchClear.addEventListener("click", () => {
      if (chSearchInput) chSearchInput.value = "";
      clientHistorySearchFilter = "";
      chSearchClear.style.display = "none";
      updateClientHistoryData();
    });
  }

  // Client Selection in Intervention Modal -> Updates Parcelles Dropdown
  const modalClientSelect = document.getElementById("input-client");
  const modalParcelSelect = document.getElementById("input-parcel");
  const parcelHint = document.getElementById("parcel-hint");
  const quickAddParcelBtn = document.getElementById("btn-quick-add-parcel");
  const toggleAllParcelsBtn = document.getElementById("btn-toggle-all-parcels");

  if (modalClientSelect) {
    modalClientSelect.addEventListener("change", (e) => {
      const clientId = e.target.value;
      if (clientId === "__create_client__") {
        modalClientSelect.value = "";
        openClientModal();
        return;
      }
      populateParcelSelectForClient(clientId);
    });
  }

  if (toggleAllParcelsBtn) {
    toggleAllParcelsBtn.addEventListener("click", () => {
      const parcelContainer = document.getElementById("parcel-checkbox-list");
      if (!parcelContainer) return;
      const checkboxes = Array.from(parcelContainer.querySelectorAll(".parcel-checkbox-input"));
      if (checkboxes.length === 0) return;
      const allChecked = checkboxes.every(cb => cb.checked);
      checkboxes.forEach(cb => {
        cb.checked = !allChecked;
        const item = cb.closest(".parcel-checkbox-item");
        if (!allChecked) item?.classList.add("selected");
        else item?.classList.remove("selected");
      });
      const clientId = modalClientSelect ? modalClientSelect.value : "";
      const client = clients.find(c => c.id === clientId);
      updateParcelSelectionSummary(client);
    });
  }

  if (quickAddParcelBtn) {
    quickAddParcelBtn.addEventListener("click", () => {
      const clientId = modalClientSelect.value;
      if (clientId) {
        openParcelModal(clientId);
      }
    });
  }

  // Multi-sélection Clients & Parcelles dans le Modal de Planification
  setupPlannedModalEvents();
  // Multi-sélection Clients & Parcelles dans le Modal Vendanges
  setupHarvestModalDropdownEvents();

  // Task Selection in Intervention Modal -> auto sets rate type and unit price
  const modalTaskSelect = document.getElementById("input-task");
  if (modalTaskSelect) {
    modalTaskSelect.addEventListener("change", (e) => {
      const selectedTaskName = e.target.value;
      let foundService = services.find(s => s.name === selectedTaskName);
      if (!foundService && typeof DEFAULT_SERVICES !== "undefined") {
        foundService = DEFAULT_SERVICES.find(s => s.name === selectedTaskName);
      }
      if (!foundService && selectedTaskName.toLowerCase().includes("mildiou")) {
        foundService = services.find(s => s.name.toLowerCase().includes("mildiou")) || 
          (typeof DEFAULT_SERVICES !== "undefined" ? DEFAULT_SERVICES.find(s => s.name.toLowerCase().includes("mildiou")) : null);
      }
      if (foundService) {
        const rateSelect = document.getElementById("input-rate-type");
        const priceInput = document.getElementById("input-unit-price");
        if (rateSelect) {
          rateSelect.value = foundService.rateType;
          rateSelect.dispatchEvent(new Event("change"));
        }
        if (priceInput) {
          priceInput.value = foundService.price;
        }
        updateCalculatedPrice();
      }
    });
  }

  // Live Price Calculation in Intervention Form
  const rateTypeSelect = document.getElementById("input-rate-type");
  const labelQuantity = document.getElementById("label-quantity");
  const iconQuantity = document.getElementById("icon-quantity");
  const inputQuantity = document.getElementById("input-quantity");
  const inputUnitPrice = document.getElementById("input-unit-price");
  const labelUnitPrice = document.getElementById("label-unit-price");

  if (rateTypeSelect) {
    rateTypeSelect.addEventListener("change", (e) => {
      const mode = e.target.value;
      const badgeUnit = document.getElementById("badge-quantity-unit");
      if (inputUnitPrice) inputUnitPrice.step = "0.01";
      if (mode === "hourly") {
        labelQuantity.innerHTML = '<span>Durée travaillée</span> <span class="required">*</span>';
        if (badgeUnit) badgeUnit.textContent = "heures";
        inputQuantity.step = "0.25";
        inputQuantity.min = "0.25";
        inputQuantity.value = "4.0";
        labelUnitPrice.innerHTML = '<span>Taux horaire HT (€/h)</span>';
        if (!inputUnitPrice.value || inputUnitPrice.value === "110" || inputUnitPrice.value === "95" || inputUnitPrice.value === "250" || inputUnitPrice.value === "0.35") {
          inputUnitPrice.value = "38";
        }
      } else if (mode === "surface") {
        labelQuantity.innerHTML = '<span>Surface travaillée</span> <span class="required">*</span>';
        if (badgeUnit) badgeUnit.textContent = "ha";
        inputQuantity.step = "0.0001";
        inputQuantity.min = "0.0001";
        
        // Auto-detect parcel surfaces from checked boxes!
        const parcelContainer = document.getElementById("parcel-checkbox-list");
        const checked = parcelContainer ? Array.from(parcelContainer.querySelectorAll(".parcel-checkbox-input:checked")) : [];
        if (checked.length > 0) {
          const totalSurface = checked.reduce((sum, cb) => sum + parseFloat(cb.dataset.surface || 0), 0);
          inputQuantity.value = parseFloat(totalSurface.toFixed(4));
        } else {
          inputQuantity.value = "1.0000";
        }

        labelUnitPrice.innerHTML = '<span>Forfait par hectare HT (€/ha)</span>';
        if (!inputUnitPrice.value || inputUnitPrice.value === "38" || inputUnitPrice.value === "250" || inputUnitPrice.value === "0.35") {
          inputUnitPrice.value = "95";
        }
      } else if (mode === "kilo") {
        labelQuantity.innerHTML = '<span>Poids récolté / travaillé</span> <span class="required">*</span>';
        if (badgeUnit) badgeUnit.textContent = "kg";
        inputQuantity.step = "1";
        inputQuantity.min = "0.1";
        inputQuantity.value = "1000";
        labelUnitPrice.innerHTML = '<span>Tarif au kilo HT (€/kg)</span>';
        if (!inputUnitPrice.value || inputUnitPrice.value === "38" || inputUnitPrice.value === "110" || inputUnitPrice.value === "95" || inputUnitPrice.value === "250") {
          inputUnitPrice.value = "0.35";
        }
      } else {
        labelQuantity.innerHTML = '<span>Quantité forfaitaire</span> <span class="required">*</span>';
        if (badgeUnit) badgeUnit.textContent = "forfait";
        inputQuantity.step = "1";
        inputQuantity.min = "1";
        inputQuantity.value = "1";
        labelUnitPrice.innerHTML = '<span>Montant forfaitaire HT (€)</span>';
        if (!inputUnitPrice.value || inputUnitPrice.value === "38" || inputUnitPrice.value === "110" || inputUnitPrice.value === "95" || inputUnitPrice.value === "0.35") {
          inputUnitPrice.value = "250";
        }
      }
      updateCalculatedPrice();
    });
  }

  if (inputQuantity) inputQuantity.addEventListener("input", updateCalculatedPrice);
  if (inputUnitPrice) inputUnitPrice.addEventListener("input", updateCalculatedPrice);

  // Search and Filters on Interventions Table
  const searchInput = document.getElementById("filter-search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentFilter.search = e.target.value.toLowerCase().trim();
      renderTable();
    });
  }

  // Multi-select dropdown filters with checkboxes (encoches)
  initFilterMultiSelects();

  // Date Range Filter in Interventions Table
  const datePresetSelect = document.getElementById("filter-date-preset");
  const dateRangeInputs = document.getElementById("date-range-inputs");
  const filterDateFrom = document.getElementById("filter-date-from");
  const filterDateTo = document.getElementById("filter-date-to");

  function applyDatePreset(preset) {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const toYMD = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    let from = "";
    let to = "";

    if (preset === "all") {
      from = "";
      to = "";
      if (dateRangeInputs) dateRangeInputs.style.display = "none";
    } else if (preset === "today") {
      from = toYMD(now);
      to = from;
      if (dateRangeInputs) dateRangeInputs.style.display = "flex";
    } else if (preset === "this_week") {
      const day = now.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      from = toYMD(monday);
      to = toYMD(sunday);
      if (dateRangeInputs) dateRangeInputs.style.display = "flex";
    } else if (preset === "this_month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      from = toYMD(firstDay);
      to = toYMD(lastDay);
      if (dateRangeInputs) dateRangeInputs.style.display = "flex";
    } else if (preset === "last_30_days") {
      const past30 = new Date(now);
      past30.setDate(now.getDate() - 30);
      from = toYMD(past30);
      to = toYMD(now);
      if (dateRangeInputs) dateRangeInputs.style.display = "flex";
    } else if (preset === "this_year") {
      from = `${now.getFullYear()}-01-01`;
      to = `${now.getFullYear()}-12-31`;
      if (dateRangeInputs) dateRangeInputs.style.display = "flex";
    } else if (preset === "custom") {
      if (dateRangeInputs) dateRangeInputs.style.display = "flex";
      from = filterDateFrom?.value || "";
      to = filterDateTo?.value || "";
    }

    currentFilter.datePreset = preset;
    currentFilter.dateFrom = from;
    currentFilter.dateTo = to;

    if (filterDateFrom && preset !== "custom") filterDateFrom.value = from;
    if (filterDateTo && preset !== "custom") filterDateTo.value = to;

    renderTable();
  }

  if (datePresetSelect) {
    datePresetSelect.addEventListener("change", (e) => {
      applyDatePreset(e.target.value);
    });
  }

  if (filterDateFrom) {
    filterDateFrom.addEventListener("change", (e) => {
      currentFilter.dateFrom = e.target.value;
      currentFilter.datePreset = "custom";
      if (datePresetSelect) datePresetSelect.value = "custom";
      renderTable();
    });
  }

  if (filterDateTo) {
    filterDateTo.addEventListener("change", (e) => {
      currentFilter.dateTo = e.target.value;
      currentFilter.datePreset = "custom";
      if (datePresetSelect) datePresetSelect.value = "custom";
      renderTable();
    });
  }

  // Status Tabs
  const statusTabs = document.querySelectorAll(".status-tab");
  statusTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      statusTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentFilter.status = tab.getAttribute("data-status");
      renderTable();
    });
  });

  // Reset Table Filters Button
  const resetTableFiltersBtn = document.getElementById("btn-reset-table-filters");
  if (resetTableFiltersBtn) {
    resetTableFiltersBtn.addEventListener("click", () => {
      currentFilter.search = "";
      currentFilter.client = "all";
      currentFilter.clients = [];
      currentFilter.task = "all";
      currentFilter.tasks = [];
      currentFilter.status = "all";
      currentFilter.dateFrom = "";
      currentFilter.dateTo = "";
      currentFilter.datePreset = "all";

      const searchInput = document.getElementById("filter-search");
      if (searchInput) searchInput.value = "";

      // Reset client checkboxes & UI
      const clientCheckboxes = document.querySelectorAll("#list-filter-client .filter-client-cb");
      clientCheckboxes.forEach(cb => {
        cb.checked = false;
        const item = cb.closest(".filter-ms-item");
        if (item) item.classList.remove("is-checked");
      });
      const searchFilterClient = document.getElementById("search-filter-client");
      if (searchFilterClient) {
        searchFilterClient.value = "";
        const items = document.querySelectorAll("#list-filter-client .filter-ms-item");
        items.forEach(item => item.style.display = "flex");
      }
      if (typeof updateClientFilterUI === "function") updateClientFilterUI();

      // Reset task checkboxes & UI
      const taskCheckboxes = document.querySelectorAll("#list-filter-task .filter-task-cb");
      taskCheckboxes.forEach(cb => {
        cb.checked = false;
        const item = cb.closest(".filter-ms-item");
        if (item) item.classList.remove("is-checked");
      });
      const searchFilterTask = document.getElementById("search-filter-task");
      if (searchFilterTask) {
        searchFilterTask.value = "";
        const items = document.querySelectorAll("#list-filter-task .filter-ms-item");
        items.forEach(item => item.style.display = "flex");
      }
      if (typeof updateTaskFilterUI === "function") updateTaskFilterUI();

      if (datePresetSelect) datePresetSelect.value = "all";
      if (dateRangeInputs) dateRangeInputs.style.display = "none";
      if (filterDateFrom) filterDateFrom.value = "";
      if (filterDateTo) filterDateTo.value = "";

      const statusTabs = document.querySelectorAll(".status-tab");
      statusTabs.forEach(t => {
        if (t.getAttribute("data-status") === "all") t.classList.add("active");
        else t.classList.remove("active");
      });

      renderTable();
      showToast("Filtres réinitialisés.", "info");
    });
  }

  // Clients View Search
  const clientsSearch = document.getElementById("clients-search-input");
  if (clientsSearch) {
    clientsSearch.addEventListener("input", (e) => {
      clientsSearchFilter = e.target.value.toLowerCase().trim();
      renderClientsView();
    });
  }

  // Export CSV
  const exportTopbarBtn = document.getElementById("btn-export-topbar");
  const exportBottomBtn = document.getElementById("btn-export-bottom");
  const sidebarExportBtn = document.getElementById("sidebar-export-btn");

  if (exportTopbarBtn) exportTopbarBtn.addEventListener("click", exportCSV);
  if (exportBottomBtn) exportBottomBtn.addEventListener("click", exportCSV);
  if (sidebarExportBtn) sidebarExportBtn.addEventListener("click", (e) => { e.preventDefault(); exportCSV(); });

  // Sync Supabase Cloud Button
  const sidebarSyncSupabaseBtn = document.getElementById("sidebar-sync-supabase-btn");
  if (sidebarSyncSupabaseBtn) {
    sidebarSyncSupabaseBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      closeSidebar();
      await window.migrateAllToSupabase();
    });
  }

  // Reset / Clear Database Button
  const resetBtn = document.getElementById("sidebar-reset-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (confirm("Voulez-vous réinitialiser complètement la base de données (vider les clients, interventions et travaux) ?")) {
        clients = [];
        interventions = [];
        plannedWorks = [];
        services = [...DEFAULT_SERVICES];
        saveClients();
        saveInterventions();
        savePlannedWorks();
        saveServices();
        renderAll();
        showToast("Base de données réinitialisée à l'état neutre.", "info");
      }
    });
  }
}

function setupModalCloser(overlayId, closeBtnId, cancelBtnId, closeFn) {
  const overlay = document.getElementById(overlayId);
  const closeBtn = document.getElementById(closeBtnId);
  const cancelBtn = document.getElementById(cancelBtnId);

  if (closeBtn) closeBtn.addEventListener("click", closeFn);
  if (cancelBtn) cancelBtn.addEventListener("click", closeFn);
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeFn();
    });
    // Prevent iOS Safari background scroll chaining & rubber-banding
    overlay.addEventListener("touchmove", (e) => {
      if (!e.target.closest(".modal-body")) {
        e.preventDefault();
      }
    }, { passive: false });
  }
}

// ==================== VIEW SWITCHING ====================
function switchView(viewName, preselectedClientId = null) {
  const viewOverview = document.getElementById("view-overview");
  const viewClients = document.getElementById("view-clients");
  const viewServices = document.getElementById("view-services");
  const viewVendanges = document.getElementById("view-vendanges");
  const viewClientHistory = document.getElementById("view-client-history");
  const viewCalendar = document.getElementById("view-calendar");

  const navOverview = document.getElementById("nav-btn-overview");
  const navCalendar = document.getElementById("nav-btn-calendar");
  const navClientHistory = document.getElementById("nav-btn-client-history");
  const navClients = document.getElementById("nav-btn-clients");
  const navServices = document.getElementById("nav-btn-services");
  const navPlanned = document.getElementById("nav-btn-planned");
  const navVendanges = document.getElementById("nav-btn-vendanges");
  const navInterventions = document.getElementById("nav-btn-interventions");
  const navBilling = document.getElementById("nav-btn-billing");

  // Deactivate all navigation links
  [navOverview, navCalendar, navClientHistory, navClients, navServices, navPlanned, navVendanges, navInterventions, navBilling].forEach(b => {
    if (b) b.classList.remove("active");
  });

  const mNavOverview = document.getElementById("mobile-nav-overview");
  const mNavClients = document.getElementById("mobile-nav-clients");
  const mNavServices = document.getElementById("mobile-nav-services");
  [mNavOverview, mNavClients, mNavServices].forEach(b => {
    if (b) b.classList.remove("active");
  });

  // Masquer toutes les vues
  [viewOverview, viewClients, viewServices, viewVendanges, viewClientHistory, viewCalendar].forEach(v => {
    if (v) {
      v.style.display = "none";
      v.classList.remove("active");
    }
  });

  if (viewName === "calendar") {
    if (viewCalendar) {
      viewCalendar.style.display = "flex";
      viewCalendar.classList.add("active");
    }
    if (navCalendar) navCalendar.classList.add("active");
    renderCalendarView();
  } else if (viewName === "client-history") {
    if (viewClientHistory) {
      viewClientHistory.style.display = "flex";
      viewClientHistory.classList.add("active");
    }
    if (navClientHistory) navClientHistory.classList.add("active");
    renderClientHistoryView(preselectedClientId);
  } else if (viewName === "clients") {
    if (viewClients) {
      viewClients.style.display = "flex";
      viewClients.classList.add("active");
    }
    if (navClients) navClients.classList.add("active");
    if (mNavClients) mNavClients.classList.add("active");
    renderClientsView();
  } else if (viewName === "services") {
    if (viewServices) {
      viewServices.style.display = "flex";
      viewServices.classList.add("active");
    }
    if (navServices) navServices.classList.add("active");
    if (mNavServices) mNavServices.classList.add("active");

    // Activer l'onglet Catalogue Prestations
    servicesActiveSubtab = "catalog";
    const tabBtnCatalog = document.getElementById("tab-btn-catalog");
    const tabBtnPlanned = document.getElementById("tab-btn-planned");
    if (tabBtnCatalog) tabBtnCatalog.classList.add("active");
    if (tabBtnPlanned) tabBtnPlanned.classList.remove("active");
    const catContent = document.getElementById("services-catalog-tab-content");
    const planContent = document.getElementById("services-planned-tab-content");
    if (catContent) catContent.style.display = "block";
    if (planContent) planContent.style.display = "none";
    const searchWrapper = document.getElementById("services-search-wrapper");
    if (searchWrapper) searchWrapper.style.display = "block";

    renderServicesView();
  } else if (viewName === "planned") {
    if (viewServices) {
      viewServices.style.display = "flex";
      viewServices.classList.add("active");
    }
    if (navPlanned) navPlanned.classList.add("active");

    // Activer l'onglet Travaux à faire & Planification
    servicesActiveSubtab = "planned";
    const tabBtnCatalog = document.getElementById("tab-btn-catalog");
    const tabBtnPlanned = document.getElementById("tab-btn-planned");
    if (tabBtnPlanned) tabBtnPlanned.classList.add("active");
    if (tabBtnCatalog) tabBtnCatalog.classList.remove("active");
    const catContent = document.getElementById("services-catalog-tab-content");
    const planContent = document.getElementById("services-planned-tab-content");
    if (catContent) catContent.style.display = "none";
    if (planContent) planContent.style.display = "block";
    const searchWrapper = document.getElementById("services-search-wrapper");
    if (searchWrapper) searchWrapper.style.display = "none";

    renderPlannedWorks();
    renderServicesKPIs();
  } else if (viewName === "vendanges") {
    if (viewVendanges) {
      viewVendanges.style.display = "flex";
      viewVendanges.classList.add("active");
    }
    if (navVendanges) navVendanges.classList.add("active");
    renderVendangesView();
  } else if (viewName === "interventions") {
    if (viewOverview) {
      viewOverview.style.display = "flex";
      viewOverview.classList.add("active");
    }
    if (navInterventions) navInterventions.classList.add("active");
    if (mNavOverview) mNavOverview.classList.add("active");
    filterByStatus("all");
    renderTable();
    renderKPIs();
  } else if (viewName === "billing") {
    if (viewOverview) {
      viewOverview.style.display = "flex";
      viewOverview.classList.add("active");
    }
    if (navBilling) navBilling.classList.add("active");
    if (mNavOverview) mNavOverview.classList.add("active");
    filterByStatus("À facturer");
    renderTable();
    renderKPIs();
  } else {
    // Default Overview
    if (viewOverview) {
      viewOverview.style.display = "flex";
      viewOverview.classList.add("active");
    }
    if (navOverview) navOverview.classList.add("active");
    if (mNavOverview) mNavOverview.classList.add("active");
    renderTable();
    renderKPIs();
  }
}

function scrollToInterventions() {
  const journalSec = document.getElementById("journal-interventions-section");
  if (journalSec) {
    setTimeout(() => {
      journalSec.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }
}
window.scrollToInterventions = scrollToInterventions;

function filterByStatus(status) {
  currentFilter.status = status;
  const statusTabs = document.querySelectorAll(".status-tab");
  statusTabs.forEach(t => {
    if (t.getAttribute("data-status") === status) t.classList.add("active");
    else t.classList.remove("active");
  });
  renderTable();
}

// ==================== BULLETPROOF BODY SCROLL LOCKING FOR IOS SAFARI ====================
let bodyScrollPos = 0;
let activeModalsCount = 0;

function syncBodyScrollLock() {
  const openModals = document.querySelectorAll(".modal-overlay.open");
  activeModalsCount = openModals.length;
  if (activeModalsCount === 0) {
    document.documentElement.style.overflow = "";
    document.documentElement.style.height = "";
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    document.body.style.height = "";
    document.body.style.overflow = "";
    if (bodyScrollPos > 0) {
      window.scrollTo(0, bodyScrollPos);
      bodyScrollPos = 0;
    }
  }
}

function lockBodyScroll() {
  const openModals = document.querySelectorAll(".modal-overlay.open");
  const openCount = openModals.length;

  if (document.body.style.position !== "fixed") {
    bodyScrollPos = window.pageYOffset || document.documentElement.scrollTop || 0;
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.height = "100%";
    document.body.style.position = "fixed";
    document.body.style.top = `-${bodyScrollPos}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.height = "100%";
    document.body.style.overflow = "hidden";
  }
  activeModalsCount = Math.max(1, openCount);
}

function unlockBodyScroll() {
  // Petite temporisation ou vérification immédiate après le retrait de .open
  setTimeout(() => {
    syncBodyScrollLock();
  }, 10);
  syncBodyScrollLock();
}

// ==================== CLIENT MANAGEMENT ====================
function openClientModal(clientId = null) {
  const modal = document.getElementById("client-modal");
  const form = document.getElementById("create-client-form");
  const modalTitle = document.getElementById("client-modal-title");
  const modalSubtitle = document.getElementById("client-modal-subtitle");
  const submitText = document.getElementById("client-modal-submit-text");
  const editIdInput = document.getElementById("client-edit-id");
  const parcelSection = document.getElementById("client-initial-parcel-section");

  if (form) form.reset();

  if (clientId) {
    // Mode EDIT client
    const client = clients.find(c => c.id === clientId);
    if (client) {
      if (editIdInput) editIdInput.value = client.id;
      if (modalTitle) modalTitle.textContent = "Modifier le Client / Domaine Viticole";
      if (modalSubtitle) modalSubtitle.textContent = `Mise à jour des coordonnées de ${client.name}`;
      if (submitText) submitText.textContent = "💾 Mettre à jour le client";
      if (parcelSection) parcelSection.style.display = "none";

      const nameInput = document.getElementById("input-new-client-name");
      const communeInput = document.getElementById("input-new-client-commune");
      const contactInput = document.getElementById("input-new-client-contact");
      const phoneInput = document.getElementById("input-new-client-phone");
      const emailInput = document.getElementById("input-new-client-email");
      const notesInput = document.getElementById("input-new-client-notes");

      if (nameInput) nameInput.value = client.name || "";
      if (communeInput) communeInput.value = client.commune || "";
      if (contactInput) contactInput.value = client.contact || "";
      if (phoneInput) phoneInput.value = client.phone || "";
      if (emailInput) emailInput.value = client.email || "";
      if (notesInput) notesInput.value = client.notes || "";
    }
  } else {
    // Mode CREATE new client
    if (editIdInput) editIdInput.value = "";
    if (modalTitle) modalTitle.textContent = "Nouveau Client / Domaine Viticole";
    if (modalSubtitle) modalSubtitle.textContent = "Ajouter un partenaire viticole dans votre base de données";
    if (submitText) submitText.textContent = "💾 Enregistrer le client";
    if (parcelSection) parcelSection.style.display = "block";
  }

  if (modal) {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    lockBodyScroll();
    const modalBody = modal.querySelector(".modal-body");
    if (modalBody) modalBody.scrollTop = 0;
  }
}

window.openEditClientModal = function(clientId) {
  openClientModal(clientId);
};

function closeClientModal() {
  const modal = document.getElementById("client-modal");
  if (modal) {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    unlockBodyScroll();
  }
}

function handleCreateClientSubmit(e) {
  e.preventDefault();

  const editId = document.getElementById("client-edit-id")?.value;
  const name = document.getElementById("input-new-client-name")?.value.trim();
  const commune = document.getElementById("input-new-client-commune")?.value.trim() || "";
  const contact = document.getElementById("input-new-client-contact")?.value.trim() || "";
  const phone = document.getElementById("input-new-client-phone")?.value.trim() || "";
  const email = document.getElementById("input-new-client-email")?.value.trim() || "";
  const notes = document.getElementById("input-new-client-notes")?.value.trim() || "";

  if (!name) {
    showToast("Le nom du domaine / client est obligatoire.", "warning");
    return;
  }

  if (editId) {
    // Mode UPDATE
    const client = clients.find(c => c.id === editId);
    if (client) {
      const oldName = client.name;
      client.name = name;
      client.commune = commune;
      client.contact = contact;
      client.phone = phone;
      client.email = email;
      client.notes = notes;

      // Propagate name change to interventions and planned works if name was updated
      if (oldName !== name) {
        interventions.forEach(inv => {
          if (inv.clientId === editId || inv.client === oldName) {
            inv.client = name;
          }
        });
        saveInterventions();

        plannedWorks.forEach(pw => {
          if (pw.clientId === editId || pw.clientName === oldName) {
            pw.clientName = name;
          }
        });
        savePlannedWorks();
      }

      saveClients();
      closeClientModal();
      renderAll();
      showToast(`Domaine « ${name} » mis à jour avec succès !`, "success");
      return;
    }
  }

  // Mode CREATE
  const clientId = generateUniqueId("CLI");

  // Optional initial parcel
  const initialParcelName = document.getElementById("input-initial-parcel-name")?.value.trim();
  const initialParcelSurface = parseFloat(document.getElementById("input-initial-parcel-surface")?.value || 0);
  const initialParcelGrape = document.getElementById("input-initial-parcel-grape")?.value.trim() || "Non spécifié";

  const parcels = [];
  if (initialParcelName) {
    parcels.push({
      id: generateUniqueId("PAR"),
      name: initialParcelName,
      surface: initialParcelSurface > 0 ? initialParcelSurface : 1.0,
      grape: initialParcelGrape,
      soil: "Sol non renseigné"
    });
  }

  const newClient = {
    id: clientId,
    name,
    commune,
    contact,
    phone,
    email,
    notes,
    parcels,
    createdAt: new Date().toISOString()
  };

  clients.unshift(newClient);
  saveClients();

  closeClientModal();
  renderAll();

  // If intervention modal is open, auto-select this new client!
  const createModal = document.getElementById("create-modal");
  if (createModal && createModal.classList.contains("open")) {
    const modalClientSelect = document.getElementById("input-client");
    if (modalClientSelect) {
      populateClientSelect();
      modalClientSelect.value = clientId;
      populateParcelSelectForClient(clientId);
    }
  }

  showToast(`Domaine « ${name} » enregistré dans la base !`, "success");
}

window.deleteClient = function(clientId) {
  const client = clients.find(c => c.id === clientId);
  if (!client) return;

  if (confirm(`Confirmez-vous la suppression du client « ${client.name} » et de ses parcelles ?`)) {
    clients = clients.filter(c => c.id !== clientId);
    saveClientsLocally();
    deleteClientFromSupabase(clientId);
    renderAll();
    showToast(`Client « ${client.name} » supprimé.`, "info");
  }
};

// ==================== PARCEL MANAGEMENT ====================
let activeClientIdForParcel = null;

window.openParcelModal = function(clientId) {
  const client = clients.find(c => c.id === clientId);
  if (!client) return;

  activeClientIdForParcel = clientId;
  const modal = document.getElementById("parcel-modal");
  const title = document.getElementById("parcel-modal-client-name");
  const form = document.getElementById("create-parcel-form");
  const hiddenInput = document.getElementById("parcel-client-id");

  if (title) title.textContent = `Client : ${client.name}`;
  if (hiddenInput) hiddenInput.value = clientId;
  if (form) form.reset();

  if (modal) {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    lockBodyScroll();
    const modalBody = modal.querySelector(".modal-body");
    if (modalBody) modalBody.scrollTop = 0;
  }
};

function closeParcelModal() {
  const modal = document.getElementById("parcel-modal");
  if (modal) {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    unlockBodyScroll();
  }
}

function handleCreateParcelSubmit(e) {
  e.preventDefault();

  const clientId = activeClientIdForParcel || document.getElementById("parcel-client-id")?.value;
  const client = clients.find(c => c.id === clientId);
  if (!client) return;

  const name = document.getElementById("input-parcel-name")?.value.trim();
  const surface = parseFloat(document.getElementById("input-parcel-surface")?.value || 0);
  const grape = document.getElementById("input-parcel-grape")?.value.trim() || "Non spécifié";
  const soil = document.getElementById("input-parcel-soil")?.value.trim() || "Non renseigné";

  if (!name || isNaN(surface) || surface <= 0) {
    showToast("Veuillez renseigner le nom de la parcelle et sa surface en hectares.", "warning");
    return;
  }

  const newParcel = {
    id: generateUniqueId("PAR"),
    name,
    surface,
    grape,
    soil
  };

  if (!client.parcels) client.parcels = [];
  client.parcels.push(newParcel);
  saveClients();

  closeParcelModal();
  renderAll();

  if (activeDossierClientId === clientId) {
    openClientDossier(clientId);
  }

  // If intervention modal is open, refresh parcel dropdown and auto-select
  const modalClientSelect = document.getElementById("input-client");
  if (modalClientSelect && modalClientSelect.value === clientId) {
    populateParcelSelectForClient(clientId);
    const parcelSelect = document.getElementById("input-parcel");
    if (parcelSelect) {
      parcelSelect.value = `${newParcel.name} (${formatSurface(newParcel.surface)} ha - ${newParcel.grape})`;
    }
  }

  showToast(`Parcelle « ${name} » (${formatSurface(surface)} ha) ajoutée à ${client.name} !`, "success");
}

window.deleteParcel = function(clientId, parcelId) {
  const client = clients.find(c => c.id === clientId);
  if (!client || !client.parcels) return;

  if (confirm("Supprimer cette parcelle ?")) {
    client.parcels = client.parcels.filter(p => p.id !== parcelId);
    saveClientsLocally();
    deleteParcelFromSupabase(parcelId);
    renderAll();
    showToast("Parcelle supprimée.", "info");
  }
};

// ==================== MULTI-PARCEL SELECTION & SURFACE CALCULATION ====================
function populateParcelSelectForClient(clientId, selectedParcelsStr = null) {
  const parcelContainer = document.getElementById("parcel-checkbox-list");
  const hiddenParcelInput = document.getElementById("input-parcel");
  const parcelHint = document.getElementById("parcel-hint");
  const quickAddParcelBtn = document.getElementById("btn-quick-add-parcel");
  const toggleAllParcelsBtn = document.getElementById("btn-toggle-all-parcels");
  const summaryBar = document.getElementById("parcel-summary-bar");

  if (!parcelContainer) return;

  if (!clientId) {
    parcelContainer.innerHTML = '<div class="parcel-list-empty">Sélectionnez d\'abord un client pour charger ses parcelles.</div>';
    if (hiddenParcelInput) hiddenParcelInput.value = selectedParcelsStr || "";
    if (parcelHint) parcelHint.textContent = "Sélectionnez un client pour charger ses parcelles.";
    if (quickAddParcelBtn) quickAddParcelBtn.style.display = "none";
    if (toggleAllParcelsBtn) toggleAllParcelsBtn.style.display = "none";
    if (summaryBar) summaryBar.style.display = "none";
    return;
  }

  const client = clients.find(c => c.id === clientId);
  if (!client) return;

  if (quickAddParcelBtn) quickAddParcelBtn.style.display = "inline-block";

  if (!client.parcels || client.parcels.length === 0) {
    parcelContainer.innerHTML = `<div class="parcel-list-empty">⚠️ Ce client n'a pas encore de parcelle.<br><a href="#" onclick="openParcelModal('${client.id}'); return false;" style="color:var(--color-primary-lighter); text-decoration:underline; font-weight:600; display:inline-block; margin-top:0.35rem;">＋ Ajouter une première parcelle</a></div>`;
    if (hiddenParcelInput) hiddenParcelInput.value = selectedParcelsStr || "";
    if (parcelHint) parcelHint.textContent = "Aucune parcelle répertoriée pour ce domaine.";
    if (toggleAllParcelsBtn) toggleAllParcelsBtn.style.display = "none";
    if (summaryBar) summaryBar.style.display = "none";
    return;
  }

  // Populate parcels with custom checkboxes
  parcelContainer.innerHTML = "";
  if (toggleAllParcelsBtn) {
    toggleAllParcelsBtn.style.display = client.parcels.length > 1 ? "inline-block" : "none";
    toggleAllParcelsBtn.textContent = "Tout cocher";
  }

  client.parcels.forEach((p, idx) => {
    const itemLabel = document.createElement("label");
    itemLabel.className = "parcel-checkbox-item";
    itemLabel.setAttribute("for", `chk-parcel-${idx}`);

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = `chk-parcel-${idx}`;
    cb.className = "parcel-checkbox-input";
    cb.value = p.name;
    cb.dataset.surface = p.surface || 0;
    cb.dataset.grape = p.grape || "";

    const infoDiv = document.createElement("div");
    infoDiv.className = "parcel-item-info";

    const textDiv = document.createElement("div");
    textDiv.className = "parcel-item-text";
    textDiv.innerHTML = `<span class="parcel-item-name">${escapeHTML(p.name)}</span>` +
      `<span class="parcel-item-sub">${escapeHTML(p.grape || 'Cépage non spécifié')}${p.soil ? ' • ' + escapeHTML(p.soil) : ''}</span>`;

    const badgeSpan = document.createElement("span");
    badgeSpan.className = "parcel-item-surface-badge";
    badgeSpan.textContent = `${formatSurface(p.surface)} ha`;

    infoDiv.appendChild(textDiv);
    infoDiv.appendChild(badgeSpan);

    itemLabel.appendChild(cb);
    itemLabel.appendChild(infoDiv);

    cb.addEventListener("change", () => {
      if (cb.checked) {
        itemLabel.classList.add("selected");
      } else {
        itemLabel.classList.remove("selected");
      }
      updateParcelSelectionSummary(client);
    });

    parcelContainer.appendChild(itemLabel);
  });

  if (parcelHint) {
    parcelHint.textContent = `${client.parcels.length} parcelle(s) disponible(s) pour ${client.name}. Cochez celle(s) travaillée(s).`;
  }

  if (selectedParcelsStr) {
    // Mode ÉDITION ou présélection spécifique
    let matchedAny = false;
    const checkboxes = Array.from(parcelContainer.querySelectorAll(".parcel-checkbox-input"));
    checkboxes.forEach(cb => {
      if (selectedParcelsStr.includes(cb.value)) {
        cb.checked = true;
        cb.closest(".parcel-checkbox-item")?.classList.add("selected");
        matchedAny = true;
      }
    });

    if (matchedAny) {
      updateParcelSelectionSummary(client, false);
    } else {
      if (hiddenParcelInput) hiddenParcelInput.value = selectedParcelsStr;
    }
  } else {
    // Preselect the first parcel by default so user has immediate visual confirmation & calculated total
    const firstCb = parcelContainer.querySelector(".parcel-checkbox-input");
    if (firstCb) {
      firstCb.checked = true;
      firstCb.closest(".parcel-checkbox-item")?.classList.add("selected");
      updateParcelSelectionSummary(client, true);
    }
  }
}

function updateParcelSelectionSummary(client, autoUpdateQuantity = true) {
  const parcelContainer = document.getElementById("parcel-checkbox-list");
  const hiddenParcelInput = document.getElementById("input-parcel");
  const summaryBar = document.getElementById("parcel-summary-bar");
  const summaryCount = document.getElementById("parcel-summary-count");
  const summarySurface = document.getElementById("parcel-summary-surface");
  const toggleAllParcelsBtn = document.getElementById("btn-toggle-all-parcels");
  const inputQuantity = document.getElementById("input-quantity");
  const rateTypeSelect = document.getElementById("input-rate-type");

  if (!parcelContainer) return;

  const checkboxes = Array.from(parcelContainer.querySelectorAll(".parcel-checkbox-input"));
  const checked = checkboxes.filter(cb => cb.checked);

  let totalSurface = 0;
  const names = [];

  checked.forEach(cb => {
    const s = parseFloat(cb.dataset.surface || 0);
    totalSurface += s;
    names.push(`${cb.value} (${formatSurface(s)} ha)`);
  });

  if (hiddenParcelInput) {
    hiddenParcelInput.value = names.join(", ");
  }

  if (toggleAllParcelsBtn) {
    if (checked.length === checkboxes.length && checkboxes.length > 0) {
      toggleAllParcelsBtn.textContent = "Tout décocher";
    } else {
      toggleAllParcelsBtn.textContent = "Tout cocher";
    }
  }

  if (checked.length > 0) {
    if (summaryBar) summaryBar.style.display = "flex";
    if (summaryCount) summaryCount.textContent = `${checked.length} parcelle${checked.length > 1 ? 's' : ''} cochée${checked.length > 1 ? 's' : ''}`;
    if (summarySurface) summarySurface.textContent = `Surface cumulée : ${formatSurface(totalSurface)} ha`;

    // If mode is surface (or default), automatically report the cumulative surface!
    const mode = rateTypeSelect?.value || "surface";
    if (mode === "surface" && inputQuantity && autoUpdateQuantity) {
      inputQuantity.value = parseFloat(totalSurface.toFixed(4));
      updateCalculatedPrice();
    }
  } else {
    if (summaryBar) summaryBar.style.display = "none";
    if (rateTypeSelect?.value === "surface" && inputQuantity && autoUpdateQuantity) {
      inputQuantity.value = "0.0000";
      updateCalculatedPrice();
    }
  }
}

// ==================== INTERVENTION CREATION & MODIFICATION ====================
function openCreateModal(interventionId = null, prefillDate = null) {
  convertingPlannedWorkId = null;
  const modal = document.getElementById("create-modal");
  const form = document.getElementById("create-intervention-form");
  const editIdInput = document.getElementById("intervention-edit-id");
  const modalTitle = document.getElementById("intervention-modal-title");
  const modalSubtitle = document.getElementById("intervention-modal-subtitle");
  const submitText = document.getElementById("intervention-modal-submit-text");
  const datetimeInput = document.getElementById("input-datetime");
  const clientSelect = document.getElementById("input-client");
  const taskSelect = document.getElementById("input-task");
  const rateTypeSelect = document.getElementById("input-rate-type");
  const quantityInput = document.getElementById("input-quantity");
  const unitPriceInput = document.getElementById("input-unit-price");
  const notesInput = document.getElementById("input-notes");
  const statusSelect = document.getElementById("input-status");

  populateClientSelect();

  // Affichage du bandeau collaborateur terrain si connecté avec son compte
  const authUser = getAuthUser();
  const operatorBanner = document.getElementById("intervention-operator-banner");
  const operatorName = document.getElementById("intervention-operator-name");
  const operatorDomain = document.getElementById("intervention-operator-domain");

  if (operatorBanner) {
    if (authUser && authUser.isTeamMember) {
      operatorBanner.style.display = "flex";
      if (operatorName) operatorName.textContent = authUser.name || authUser.fullName || "Collaborateur";
      if (operatorDomain) operatorDomain.textContent = authUser.ownerDomain ? `Compte du ${authUser.ownerDomain}` : "Enregistré pour le domaine";
    } else {
      operatorBanner.style.display = "none";
    }
  }

  if (interventionId) {
    // Mode MODIFIER une intervention existante
    const item = interventions.find(i => i.id === interventionId);
    if (!item) return;

    if (editIdInput) editIdInput.value = item.id;
    if (modalTitle) modalTitle.textContent = `Modifier l'intervention #${item.id}`;
    if (modalSubtitle) modalSubtitle.textContent = `Mise à jour du chantier réalisé pour ${item.client}`;
    if (submitText) submitText.textContent = "💾 Enregistrer les modifications";

    // Date & Heure
    if (datetimeInput) {
      if (item.datetime) {
        datetimeInput.value = item.datetime.slice(0, 16);
      } else {
        const now = new Date();
        datetimeInput.value = now.toISOString().slice(0, 16);
      }
    }

    // Client & Parcelles
    if (clientSelect) {
      let targetClientId = item.clientId;
      if (!targetClientId) {
        const found = clients.find(c => c.name === item.client);
        if (found) targetClientId = found.id;
      }
      if (targetClientId) {
        clientSelect.value = targetClientId;
        populateParcelSelectForClient(targetClientId, item.parcel);
      } else {
        populateParcelSelectForClient("", item.parcel);
      }
    }

    // Prestation viticole
    if (taskSelect) {
      const exists = Array.from(taskSelect.options).some(o => o.value === item.task);
      if (!exists && item.task) {
        const opt = document.createElement("option");
        opt.value = item.task;
        opt.textContent = item.task;
        taskSelect.appendChild(opt);
      }
      taskSelect.value = item.task;
    }

    // Mode facturation & Labels
    const mode = item.rateType || (item.unit === 'ha' ? 'surface' : (item.unit === 'heures' ? 'hourly' : (item.unit === 'kg' ? 'kilo' : 'fixed')));
    if (rateTypeSelect) {
      rateTypeSelect.value = mode;
      const badgeUnit = document.getElementById("badge-quantity-unit");
      const labelQuantity = document.getElementById("label-quantity");
      const labelUnitPrice = document.getElementById("label-unit-price");
      if (unitPriceInput) unitPriceInput.step = "0.01";
      if (mode === "hourly") {
        if (labelQuantity) labelQuantity.innerHTML = '<span>Durée travaillée</span> <span class="required">*</span>';
        if (badgeUnit) badgeUnit.textContent = "heures";
        if (quantityInput) {
          quantityInput.step = "0.25";
          quantityInput.min = "0.25";
        }
        if (labelUnitPrice) labelUnitPrice.innerHTML = '<span>Taux horaire HT (€/h)</span>';
      } else if (mode === "surface") {
        if (labelQuantity) labelQuantity.innerHTML = '<span>Surface travaillée</span> <span class="required">*</span>';
        if (badgeUnit) badgeUnit.textContent = "ha";
        if (quantityInput) {
          quantityInput.step = "0.0001";
          quantityInput.min = "0.0001";
        }
        if (labelUnitPrice) labelUnitPrice.innerHTML = '<span>Forfait par hectare HT (€/ha)</span>';
      } else if (mode === "kilo") {
        if (labelQuantity) labelQuantity.innerHTML = '<span>Poids récolté / travaillé</span> <span class="required">*</span>';
        if (badgeUnit) badgeUnit.textContent = "kg";
        if (quantityInput) {
          quantityInput.step = "1";
          quantityInput.min = "0.1";
        }
        if (labelUnitPrice) labelUnitPrice.innerHTML = '<span>Tarif au kilo HT (€/kg)</span>';
      } else {
        if (labelQuantity) labelQuantity.innerHTML = '<span>Quantité forfaitaire</span> <span class="required">*</span>';
        if (badgeUnit) badgeUnit.textContent = "forfait";
        if (quantityInput) {
          quantityInput.step = "1";
          quantityInput.min = "1";
        }
        if (labelUnitPrice) labelUnitPrice.innerHTML = '<span>Montant forfaitaire HT (€)</span>';
      }
    }

    // Quantité & Prix unitaire
    if (quantityInput) {
      quantityInput.value = item.unit === "ha" ? parseFloat(Number(item.quantity).toFixed(4)) : item.quantity;
    }
    if (unitPriceInput) {
      unitPriceInput.value = item.unitPrice;
    }
    updateCalculatedPrice();

    // Notes & Statut
    if (notesInput) notesInput.value = item.notes || "";
    if (statusSelect) statusSelect.value = item.status || "À facturer";

  } else {
    // Mode NOUVELLE INTERVENTION
    if (form) form.reset();
    if (editIdInput) editIdInput.value = "";
    if (modalTitle) modalTitle.textContent = "Nouvelle intervention viticole";
    if (modalSubtitle) modalSubtitle.textContent = "Enregistrement rapide des travaux de parcelle pour facturation";
    if (submitText) submitText.textContent = "Enregistrer l'intervention";

    if (datetimeInput) {
      if (prefillDate) {
        datetimeInput.value = `${prefillDate}T08:00`;
      } else {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        datetimeInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
      }
    }

    // Reset rateType labels to default (surface)
    if (rateTypeSelect) {
      rateTypeSelect.value = "surface";
      const badgeUnit = document.getElementById("badge-quantity-unit");
      const labelQuantity = document.getElementById("label-quantity");
      const labelUnitPrice = document.getElementById("label-unit-price");
      if (labelQuantity) labelQuantity.innerHTML = '<span>Surface travaillée</span> <span class="required">*</span>';
      if (badgeUnit) badgeUnit.textContent = "ha";
      if (quantityInput) {
        quantityInput.step = "0.0001";
        quantityInput.min = "0.0001";
        quantityInput.value = "1.0000";
      }
      if (labelUnitPrice) labelUnitPrice.innerHTML = '<span>Forfait par hectare HT (€/ha)</span>';
      if (unitPriceInput) {
        unitPriceInput.step = "0.01";
        unitPriceInput.value = "95";
      }
    }

    if (clientSelect) clientSelect.value = "";
    populateParcelSelectForClient("");
    updateCalculatedPrice();
  }

  if (modal) {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    lockBodyScroll();
    const modalBody = modal.querySelector(".modal-body");
    if (modalBody) modalBody.scrollTop = 0;
  }
}

window.openEditInterventionModal = function(id) {
  openCreateModal(id);
};

function closeCreateModal() {
  const modal = document.getElementById("create-modal");
  const editIdInput = document.getElementById("intervention-edit-id");
  if (editIdInput) editIdInput.value = "";
  convertingPlannedWorkId = null;
  if (modal) {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    unlockBodyScroll();
  }
}

// ==================== FILTRES MULTI-SÉLECTION À ENCOCHES (CLIENTS & PRESTATIONS) ====================
let _filterMsInitialized = false;

function initFilterMultiSelects() {
  if (_filterMsInitialized) return;
  _filterMsInitialized = true;

  const wrapClient = document.getElementById("wrap-filter-client");
  const btnClient = document.getElementById("btn-filter-client");
  const dropdownClient = document.getElementById("dropdown-filter-client");
  const searchClient = document.getElementById("search-filter-client");
  const btnSelectAllClients = document.getElementById("btn-select-all-clients");
  const btnClearClients = document.getElementById("btn-clear-clients");
  const btnMsNewClient = document.getElementById("btn-ms-new-client");

  const wrapTask = document.getElementById("wrap-filter-task");
  const btnTask = document.getElementById("btn-filter-task");
  const dropdownTask = document.getElementById("dropdown-filter-task");
  const searchTask = document.getElementById("search-filter-task");
  const btnSelectAllTasks = document.getElementById("btn-select-all-tasks");
  const btnClearTasks = document.getElementById("btn-clear-tasks");

  // Bascule du menu Client
  if (btnClient && dropdownClient) {
    btnClient.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = dropdownClient.style.display === "flex";
      closeAllFilterMultiSelects();
      if (!isOpen) {
        dropdownClient.style.display = "flex";
        if (wrapClient) wrapClient.classList.add("is-open");
        btnClient.setAttribute("aria-expanded", "true");
        if (searchClient) {
          setTimeout(() => searchClient.focus(), 60);
        }
      }
    });
  }

  // Bascule du menu Prestation
  if (btnTask && dropdownTask) {
    btnTask.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = dropdownTask.style.display === "flex";
      closeAllFilterMultiSelects();
      if (!isOpen) {
        dropdownTask.style.display = "flex";
        if (wrapTask) wrapTask.classList.add("is-open");
        btnTask.setAttribute("aria-expanded", "true");
        if (searchTask) {
          setTimeout(() => searchTask.focus(), 60);
        }
      }
    });
  }

  // Éviter la fermeture lors du clic à l'intérieur des menus déroulants
  if (dropdownClient) {
    dropdownClient.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }
  if (dropdownTask) {
    dropdownTask.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }

  // Recherche dans la liste des clients
  if (searchClient) {
    searchClient.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase().trim();
      const items = document.querySelectorAll("#list-filter-client .filter-ms-item");
      items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(q) ? "flex" : "none";
      });
    });
  }

  // Recherche dans la liste des prestations
  if (searchTask) {
    searchTask.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase().trim();
      const items = document.querySelectorAll("#list-filter-task .filter-ms-item");
      items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(q) ? "flex" : "none";
      });

      // Gestion de la visibilité des en-têtes de catégories
      const catTitles = document.querySelectorAll("#list-filter-task .filter-ms-category-title");
      catTitles.forEach(title => {
        if (!q) {
          title.style.display = "block";
        } else {
          let next = title.nextElementSibling;
          let anyVisible = false;
          while (next && !next.classList.contains("filter-ms-category-title")) {
            if (next.style.display !== "none") anyVisible = true;
            next = next.nextElementSibling;
          }
          title.style.display = anyVisible ? "block" : "none";
        }
      });
    });
  }

  // Clients : Tout cocher
  if (btnSelectAllClients) {
    btnSelectAllClients.addEventListener("click", (e) => {
      e.preventDefault();
      const checkboxes = document.querySelectorAll("#list-filter-client .filter-client-cb");
      currentFilter.clients = [];
      checkboxes.forEach(cb => {
        cb.checked = true;
        const item = cb.closest(".filter-ms-item");
        if (item) item.classList.add("is-checked");
        currentFilter.clients.push(cb.value);
      });
      currentFilter.client = "all";
      updateClientFilterUI();
      renderTable();
    });
  }

  // Clients : Tout décocher
  if (btnClearClients) {
    btnClearClients.addEventListener("click", (e) => {
      e.preventDefault();
      const checkboxes = document.querySelectorAll("#list-filter-client .filter-client-cb");
      checkboxes.forEach(cb => {
        cb.checked = false;
        const item = cb.closest(".filter-ms-item");
        if (item) item.classList.remove("is-checked");
      });
      currentFilter.clients = [];
      currentFilter.client = "all";
      updateClientFilterUI();
      renderTable();
    });
  }

  // Prestations : Tout cocher
  if (btnSelectAllTasks) {
    btnSelectAllTasks.addEventListener("click", (e) => {
      e.preventDefault();
      const checkboxes = document.querySelectorAll("#list-filter-task .filter-task-cb");
      currentFilter.tasks = [];
      checkboxes.forEach(cb => {
        cb.checked = true;
        const item = cb.closest(".filter-ms-item");
        if (item) item.classList.add("is-checked");
        currentFilter.tasks.push(cb.value);
      });
      currentFilter.task = "all";
      updateTaskFilterUI();
      renderTable();
    });
  }

  // Prestations : Tout décocher
  if (btnClearTasks) {
    btnClearTasks.addEventListener("click", (e) => {
      e.preventDefault();
      const checkboxes = document.querySelectorAll("#list-filter-task .filter-task-cb");
      checkboxes.forEach(cb => {
        cb.checked = false;
        const item = cb.closest(".filter-ms-item");
        if (item) item.classList.remove("is-checked");
      });
      currentFilter.tasks = [];
      currentFilter.task = "all";
      updateTaskFilterUI();
      renderTable();
    });
  }

  // Bouton Ajouter un client dans le menu déroulant
  if (btnMsNewClient) {
    btnMsNewClient.addEventListener("click", (e) => {
      e.preventDefault();
      closeAllFilterMultiSelects();
      openClientModal();
    });
  }

  // Fermeture lors d'un clic en dehors
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#wrap-filter-client") &&
        !e.target.closest("#wrap-filter-task") &&
        !e.target.closest("#wrap-vendanges-filter-client") &&
        !e.target.closest("#wrap-vendanges-filter-parcel") &&
        !e.target.closest("#wrap-vendanges-filter-stage") &&
        !e.target.closest("#wrap-ch-filter-client") &&
        !e.target.closest("#wrap-ch-filter-parcel")) {
      closeAllFilterMultiSelects();
    }
  });

  // Fermeture par touche Échap
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllFilterMultiSelects();
    }
  });
}

function closeAllFilterMultiSelects() {
  const dropdownClient = document.getElementById("dropdown-filter-client");
  const wrapClient = document.getElementById("wrap-filter-client");
  const btnClient = document.getElementById("btn-filter-client");

  const dropdownTask = document.getElementById("dropdown-filter-task");
  const wrapTask = document.getElementById("wrap-filter-task");
  const btnTask = document.getElementById("btn-filter-task");

  const dropdownVendanges = document.getElementById("dropdown-vendanges-filter-client");
  const wrapVendanges = document.getElementById("wrap-vendanges-filter-client");
  const btnVendanges = document.getElementById("btn-vendanges-filter-client");

  const dropdownVendangesParcel = document.getElementById("dropdown-vendanges-filter-parcel");
  const wrapVendangesParcel = document.getElementById("wrap-vendanges-filter-parcel");
  const btnVendangesParcel = document.getElementById("btn-vendanges-filter-parcel");

  const dropdownVendangesStage = document.getElementById("dropdown-vendanges-filter-stage");
  const wrapVendangesStage = document.getElementById("wrap-vendanges-filter-stage");
  const btnVendangesStage = document.getElementById("btn-vendanges-filter-stage");

  const dropdownVendangesTeam = document.getElementById("dropdown-vendanges-filter-team");
  const wrapVendangesTeam = document.getElementById("wrap-vendanges-filter-team");
  const btnVendangesTeam = document.getElementById("btn-vendanges-filter-team");

  const dropdownCH = document.getElementById("dropdown-ch-filter-client");
  const wrapCH = document.getElementById("wrap-ch-filter-client");
  const btnCH = document.getElementById("btn-ch-filter-client");

  const dropdownCHParcel = document.getElementById("dropdown-ch-filter-parcel");
  const wrapCHParcel = document.getElementById("wrap-ch-filter-parcel");
  const btnCHParcel = document.getElementById("btn-ch-filter-parcel");

  if (dropdownClient) dropdownClient.style.display = "none";
  if (wrapClient) wrapClient.classList.remove("is-open");
  if (btnClient) btnClient.setAttribute("aria-expanded", "false");

  if (dropdownTask) dropdownTask.style.display = "none";
  if (wrapTask) wrapTask.classList.remove("is-open");
  if (btnTask) btnTask.setAttribute("aria-expanded", "false");

  if (dropdownVendanges) dropdownVendanges.style.display = "none";
  if (wrapVendanges) wrapVendanges.classList.remove("is-open");
  if (btnVendanges) btnVendanges.setAttribute("aria-expanded", "false");

  if (dropdownVendangesParcel) dropdownVendangesParcel.style.display = "none";
  if (wrapVendangesParcel) wrapVendangesParcel.classList.remove("is-open");
  if (btnVendangesParcel) btnVendangesParcel.setAttribute("aria-expanded", "false");

  if (dropdownVendangesStage) dropdownVendangesStage.style.display = "none";
  if (wrapVendangesStage) wrapVendangesStage.classList.remove("is-open");
  if (btnVendangesStage) btnVendangesStage.setAttribute("aria-expanded", "false");

  if (dropdownVendangesTeam) dropdownVendangesTeam.style.display = "none";
  if (wrapVendangesTeam) wrapVendangesTeam.classList.remove("is-open");
  if (btnVendangesTeam) btnVendangesTeam.setAttribute("aria-expanded", "false");

  if (dropdownCH) dropdownCH.style.display = "none";
  if (wrapCH) wrapCH.classList.remove("is-open");
  if (btnCH) btnCH.setAttribute("aria-expanded", "false");

  if (dropdownCHParcel) dropdownCHParcel.style.display = "none";
  if (wrapCHParcel) wrapCHParcel.classList.remove("is-open");
  if (btnCHParcel) btnCHParcel.setAttribute("aria-expanded", "false");
}

function renderClientMultiSelectFilter() {
  const listEl = document.getElementById("list-filter-client");
  if (!listEl) return;

  listEl.innerHTML = "";

  if (!clients || clients.length === 0) {
    listEl.innerHTML = '<div class="filter-ms-empty">Aucun domaine client enregistré</div>';
    updateClientFilterUI();
    return;
  }

  clients.forEach(c => {
    const isChecked = Array.isArray(currentFilter.clients) && currentFilter.clients.includes(c.name);
    const label = document.createElement("label");
    label.className = `filter-ms-item ${isChecked ? "is-checked" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "filter-ms-cb filter-client-cb";
    checkbox.value = c.name;
    checkbox.checked = isChecked;

    checkbox.addEventListener("change", () => {
      const allChecked = Array.from(document.querySelectorAll("#list-filter-client .filter-client-cb:checked")).map(cb => cb.value);
      currentFilter.clients = allChecked;
      currentFilter.client = "all";
      label.classList.toggle("is-checked", checkbox.checked);
      updateClientFilterUI();
      renderTable();
    });

    const infoWrap = document.createElement("div");
    infoWrap.className = "filter-ms-item-info";

    const nameSpan = document.createElement("span");
    nameSpan.className = "filter-ms-item-name";
    nameSpan.textContent = c.name;
    infoWrap.appendChild(nameSpan);

    if (c.commune) {
      const subSpan = document.createElement("span");
      subSpan.className = "filter-ms-item-sub";
      subSpan.textContent = c.commune;
      infoWrap.appendChild(subSpan);
    }

    label.appendChild(checkbox);
    label.appendChild(infoWrap);
    listEl.appendChild(label);
  });

  updateClientFilterUI();
}

function updateClientFilterUI() {
  const textEl = document.getElementById("filter-client-text");
  const badgeEl = document.getElementById("filter-client-badge");
  const wrapEl = document.getElementById("wrap-filter-client");

  const count = Array.isArray(currentFilter.clients) ? currentFilter.clients.length : 0;
  const total = clients ? clients.length : 0;

  if (textEl) {
    if (count === 0) {
      textEl.textContent = "Tous les clients";
    } else if (count === 1) {
      textEl.textContent = currentFilter.clients[0];
    } else if (count === total && total > 0) {
      textEl.textContent = `Tous les clients (${count})`;
    } else {
      textEl.textContent = `${count} clients sélectionnés`;
    }
  }

  if (badgeEl) {
    if (count === 0) {
      badgeEl.textContent = "Tous";
    } else {
      badgeEl.textContent = `${count} sélectionné${count > 1 ? "s" : ""}`;
    }
  }

  if (wrapEl) {
    wrapEl.classList.toggle("is-active", count > 0 && count < total);
  }
}

function renderTaskMultiSelectFilter() {
  const listEl = document.getElementById("list-filter-task");
  if (!listEl) return;

  listEl.innerHTML = "";

  const availableServices = (services && services.length > 0) ? services : (typeof DEFAULT_SERVICES !== "undefined" ? DEFAULT_SERVICES : []);

  if (availableServices.length === 0) {
    listEl.innerHTML = '<div class="filter-ms-empty">Aucune prestation disponible</div>';
    updateTaskFilterUI();
    return;
  }

  // Grouper par catégorie
  const categories = {};
  availableServices.forEach(s => {
    const cat = s.category || "Autres travaux viticoles";
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(s);
  });

  Object.keys(categories).forEach(cat => {
    const catTitle = document.createElement("div");
    catTitle.className = "filter-ms-category-title";
    catTitle.textContent = cat;
    listEl.appendChild(catTitle);

    categories[cat].forEach(s => {
      const isChecked = Array.isArray(currentFilter.tasks) && currentFilter.tasks.includes(s.name);
      const label = document.createElement("label");
      label.className = `filter-ms-item ${isChecked ? "is-checked" : ""}`;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "filter-ms-cb filter-task-cb";
      checkbox.value = s.name;
      checkbox.checked = isChecked;

      checkbox.addEventListener("change", () => {
        const allChecked = Array.from(document.querySelectorAll("#list-filter-task .filter-task-cb:checked")).map(cb => cb.value);
        currentFilter.tasks = allChecked;
        currentFilter.task = "all";
        label.classList.toggle("is-checked", checkbox.checked);
        updateTaskFilterUI();
        renderTable();
      });

      const infoWrap = document.createElement("div");
      infoWrap.className = "filter-ms-item-info";

      const nameSpan = document.createElement("span");
      nameSpan.className = "filter-ms-item-name";
      nameSpan.textContent = s.name;
      infoWrap.appendChild(nameSpan);

      const rateLabel = s.rateType === "hourly" ? `${s.price} €/h` : (s.rateType === "surface" ? `${s.price} €/ha` : (s.rateType === "kilo" ? `${s.price} €/kg` : `${s.price} € forfait`));
      const badge = document.createElement("span");
      badge.className = "filter-ms-rate-badge";
      badge.textContent = rateLabel;
      infoWrap.appendChild(badge);

      label.appendChild(checkbox);
      label.appendChild(infoWrap);
      listEl.appendChild(label);
    });
  });

  updateTaskFilterUI();
}

function updateTaskFilterUI() {
  const textEl = document.getElementById("filter-task-text");
  const badgeEl = document.getElementById("filter-task-badge");
  const wrapEl = document.getElementById("wrap-filter-task");

  const availableServices = (services && services.length > 0) ? services : (typeof DEFAULT_SERVICES !== "undefined" ? DEFAULT_SERVICES : []);
  const count = Array.isArray(currentFilter.tasks) ? currentFilter.tasks.length : 0;
  const total = availableServices.length;

  if (textEl) {
    if (count === 0) {
      textEl.textContent = "Toutes les prestations";
    } else if (count === 1) {
      textEl.textContent = currentFilter.tasks[0];
    } else if (count === total && total > 0) {
      textEl.textContent = `Toutes les prestations (${count})`;
    } else {
      textEl.textContent = `${count} prestations sélectionnées`;
    }
  }

  if (badgeEl) {
    if (count === 0) {
      badgeEl.textContent = "Toutes";
    } else {
      badgeEl.textContent = `${count} sélectionnée${count > 1 ? "s" : ""}`;
    }
  }

  if (wrapEl) {
    wrapEl.classList.toggle("is-active", count > 0 && count < total);
  }
}

function populateClientSelect() {
  const modalClientSelect = document.getElementById("input-client");
  const filterClientSelect = document.getElementById("filter-client");

  if (modalClientSelect) {
    if (clients.length === 0) {
      modalClientSelect.innerHTML = '<option value="">⚠️ Aucun client enregistré</option><option value="__create_client__">🍇 ＋ Créer mon premier client...</option>';
    } else {
      modalClientSelect.innerHTML = '<option value="">Sélectionner un domaine client...</option>';
      clients.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name + (c.commune ? ` (${c.commune})` : '');
        modalClientSelect.appendChild(opt);
      });
      const addOpt = document.createElement("option");
      addOpt.value = "__create_client__";
      addOpt.textContent = "🍇 ＋ Ajouter un nouveau client...";
      modalClientSelect.appendChild(addOpt);
    }
  }

  if (filterClientSelect) {
    filterClientSelect.innerHTML = '<option value="all">Tous les clients</option>';
    clients.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.name;
      opt.textContent = c.name;
      filterClientSelect.appendChild(opt);
    });
    const addOpt = document.createElement("option");
    addOpt.value = "__create_client__";
    addOpt.textContent = "🍇 ＋ Nouveau client...";
    filterClientSelect.appendChild(addOpt);
  }

  // Mettre à jour la liste multi-sélection avec encoches
  renderClientMultiSelectFilter();
}

function updateCalculatedPrice() {
  const quantity = parseFloat(document.getElementById("input-quantity")?.value || 0);
  const unitPrice = parseFloat(document.getElementById("input-unit-price")?.value || 0);
  const display = document.getElementById("calculated-total-display");

  const total = quantity * unitPrice;
  if (display) {
    display.textContent = `${total.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € HT`;
  }
}

function handleCreateInterventionSubmit(e) {
  e.preventDefault();

  const editId = document.getElementById("intervention-edit-id")?.value;

  const authUser = getAuthUser();
  const defaultWorker = authUser ? (authUser.fullName || authUser.name || "") : "";
  const workerInput = document.getElementById("input-worker");
  const worker = workerInput ? workerInput.value.trim() : defaultWorker;
  const datetime = document.getElementById("input-datetime")?.value;
  const clientId = document.getElementById("input-client")?.value;
  const parcel = document.getElementById("input-parcel")?.value?.trim();
  const task = document.getElementById("input-task")?.value;
  const rateType = document.getElementById("input-rate-type")?.value || "surface";
  const quantity = parseFloat(document.getElementById("input-quantity")?.value || 0);
  const unitPrice = parseFloat(document.getElementById("input-unit-price")?.value || 0);
  const notes = document.getElementById("input-notes")?.value || "";
  const status = document.getElementById("input-status")?.value || "À facturer";

  if (!datetime) {
    showToast("Veuillez renseigner la date et l'heure.", "error");
    return;
  }
  if (!clientId) {
    showToast("Veuillez sélectionner un domaine viticole client.", "error");
    return;
  }
  if (!parcel) {
    showToast("Veuillez renseigner le nom de la parcelle travaillée.", "error");
    return;
  }
  if (!task) {
    showToast("Veuillez sélectionner une prestation viticole.", "error");
    return;
  }
  if (quantity <= 0) {
    showToast("La quantité ou durée doit être supérieure à zéro.", "error");
    return;
  }

  const clientObj = clients.find(c => c.id === clientId);
  const clientName = clientObj ? clientObj.name : "Client Inconnu";
  const unit = rateType === "hourly" ? "heures" : (rateType === "surface" ? "ha" : (rateType === "kilo" ? "kg" : "forfait"));
  const total = quantity * unitPrice;
  const tvaRate = getTvaRate(task);
  const totalTTC = total * (1 + tvaRate);

  if (editId) {
    // Mode MODIFICATION
    const existingIndex = interventions.findIndex(i => i.id === editId);
    if (existingIndex !== -1) {
      const existing = interventions[existingIndex];
      existing.datetime = datetime;
      existing.clientId = clientId;
      existing.client = clientName;
      existing.parcel = parcel;
      existing.task = task;
      existing.rateType = rateType;
      existing.quantity = quantity;
      existing.unit = unit;
      existing.unitPrice = unitPrice;
      existing.total = total;
      existing.tvaRate = tvaRate;
      existing.totalTTC = totalTTC;
      existing.status = status;
      existing.notes = notes;
      if (worker) existing.worker = worker;

      saveInterventions(existing);
      syncInterventionToSupabase(existing);

      closeCreateModal();
      renderAll();

      if (typeof activeDossierClientId !== "undefined" && activeDossierClientId) {
        const dossierModal = document.getElementById("client-dossier-modal");
        if (dossierModal && dossierModal.classList.contains("open")) {
          populateDossierContent(activeDossierClientId);
        }
      }

      showToast(`✏️ Intervention #${editId} modifiée avec succès !`, "success");
      return;
    }
  }

  // Mode NOUVELLE INTERVENTION
  const id = generateUniqueInterventionId(datetime ? new Date(datetime).getFullYear() : new Date().getFullYear());

  if (services.length === 0 && typeof DEFAULT_SERVICES !== "undefined") {
    services = JSON.parse(JSON.stringify(DEFAULT_SERVICES));
    saveServices();
  }

  const newIntervention = {
    id,
    datetime,
    worker,
    clientId,
    client: clientName,
    parcel,
    task,
    rateType,
    quantity,
    unit,
    unitPrice,
    total,
    tvaRate,
    totalTTC,
    status,
    notes,
    isNewlyCreated: true
  };

  interventions.unshift(newIntervention);
  saveInterventions(newIntervention);

  // Synchronisation Cloud Supabase si session active
  syncInterventionToSupabase(newIntervention);

  // Si cette intervention provient de la validation d'un travail planifié
  const wasPlannedWork = !!convertingPlannedWorkId;
  if (convertingPlannedWorkId) {
    const pId = convertingPlannedWorkId;
    convertingPlannedWorkId = null;
    plannedWorks = plannedWorks.filter(w => w.id !== pId);
    savePlannedWorksLocally();
    deletePlannedWorkFromSupabase(pId);
  }

  closeCreateModal();
  renderAll();

  if (typeof activeDossierClientId !== "undefined" && activeDossierClientId) {
    const dossierModal = document.getElementById("client-dossier-modal");
    if (dossierModal && dossierModal.classList.contains("open")) {
      populateDossierContent(activeDossierClientId);
    }
  }

  if (wasPlannedWork) {
    switchView("overview");
    showToast(`✅ Intervention #${id} enregistrée et ajoutée au Tableau de Bord (${clientName}) !`, "success");
  } else {
    showToast(`✅ Intervention #${id} enregistrée avec succès (${clientName}) !`, "success");
  }
}

// ==================== RENDERING ALL ====================
function renderAll() {
  populateClientSelect();
  populateTaskSelects();
  renderKPIs();
  renderTable();
  renderClientsView();
  renderServicesView();
  renderVendangesView();
  if (typeof populateClientHistoryClientSelect === "function") {
    populateClientHistoryClientSelect();
  }
  if (typeof updateClientHistoryData === "function" && clientHistorySelectedClientId) {
    updateClientHistoryData();
  }
  if (typeof renderCalendarView === "function" && document.getElementById("view-calendar")?.classList.contains("active")) {
    renderCalendarView();
  }
}

function renderKPIs() {
  const totalInterventions = interventions.length;
  const totalClients = clients.length;

  let totalParcels = 0;
  let totalHectares = 0;
  clients.forEach(c => {
    if (c.parcels) {
      totalParcels += c.parcels.length;
      c.parcels.forEach(p => totalHectares += (p.surface || 0));
    }
  });

  let workedSurface = 0;
  let workedHours = 0;
  let unbilledAmount = 0;
  let unbilledAmountTTC = 0;
  let unbilledCount = 0;
  let billedAmount = 0;
  let billedAmountTTC = 0;
  let billedCount = 0;

  interventions.forEach(item => {
    if (item.unit === "ha") workedSurface += item.quantity;
    else if (item.unit === "heures") workedHours += item.quantity;

    const rate = getTvaRate(item);
    const itemTTC = (item.total || 0) * (1 + rate);

    if (item.status === "À facturer") {
      unbilledAmount += (item.total || 0);
      unbilledAmountTTC += itemTTC;
      unbilledCount++;
    } else {
      billedAmount += (item.total || 0);
      billedAmountTTC += itemTTC;
      billedCount++;
    }
  });

  // Overview KPIs
  setElemText("kpi-clients-count", totalClients);
  setElemText("kpi-parcels-count", `${totalParcels} parcelle${totalParcels > 1 ? 's' : ''}`);
  setElemText("kpi-total-surface", `${formatSurface(totalHectares)} ha répertoriés`);

  setElemText("kpi-total-count", totalInterventions);
  setElemText("kpi-surface-hours", `${formatSurface(workedSurface)} ha / ${Math.round(workedHours)} h travaillées`);

  setElemText("kpi-unbilled-amount", `${unbilledAmount.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} € HT`);
  setElemText("kpi-unbilled-ttc", `${unbilledAmountTTC.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} € TTC`);
  setElemText("kpi-unbilled-badge", `${unbilledCount} chantier${unbilledCount > 1 ? 's' : ''}`);

  setElemText("kpi-billed-amount", `${billedAmount.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} € HT`);
  setElemText("kpi-billed-ttc", `${billedAmountTTC.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} € TTC`);
  setElemText("kpi-billed-badge", `${billedCount} chantier${billedCount > 1 ? 's' : ''}`);

  // Équipe & Utilisateurs KPIs
  const totalTeam = Array.isArray(teamUsers) ? teamUsers.length : 0;
  const gerantsCount = (teamUsers || []).filter(u => (u.roleCategory === "gerant" || (u.role && u.role.toLowerCase().includes("gérant")))).length;
  const operatorsCount = totalTeam - gerantsCount;
  const gerantLabel = `${gerantsCount} gérant${gerantsCount > 1 ? 's' : ''}`;
  const operatorLabel = `${operatorsCount} salarié${operatorsCount > 1 ? 's' : ''}`;
  const activeCount = (teamUsers || []).filter(u => u.status === "Actif").length;

  setElemText("kpi-team-count", totalTeam);
  setElemText("kpi-team-roles", `${gerantLabel} • ${operatorLabel}`);
  setElemText("kpi-team-sub", `${activeCount} utilisateur${activeCount > 1 ? 's' : ''} actif${activeCount > 1 ? 's' : ''}`);

  // Sidebar badges
  setElemText("sidebar-clients-count", totalClients);
  setElemText("sidebar-interventions-count", totalInterventions);
  setElemText("sidebar-unbilled-count", unbilledCount);
  setElemText("sidebar-services-count", services.length);
  setElemText("sidebar-planned-count", (plannedWorks || []).length);
  setElemText("sidebar-team-count", totalTeam);

  // Sidebar badge Calendrier (nombre de chantiers prévus/faits aujourd'hui)
  if (typeof countCalendarEventsForDate === "function") {
    const todayStr = new Date().toISOString().split("T")[0];
    const todayCount = countCalendarEventsForDate(todayStr);
    const calBadge = document.getElementById("sidebar-calendar-count");
    if (calBadge) {
      calBadge.textContent = todayCount;
      calBadge.style.display = todayCount > 0 ? "inline-block" : "none";
    }
  }

  // Topbar badge
  setElemText("topbar-team-text", `Équipe (${totalTeam})`);

  // Clients view stats
  setElemText("clients-total-count", totalClients);
  setElemText("clients-total-parcels", totalParcels);
  setElemText("clients-total-ha", `${formatSurface(totalHectares)} ha`);

  renderServicesKPIs();
}

function setElemText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// Render Interventions Table
function renderTable() {
  const tbody = document.getElementById("interventions-tbody");
  const tableEmpty = document.getElementById("table-empty");
  const tableCountBadge = document.getElementById("table-results-count");
  const emptyMsg = document.getElementById("table-empty-message");

  if (!tbody) return;

  const filtered = interventions.filter(item => {
    if (currentFilter.status !== "all" && item.status !== currentFilter.status) return false;

    // Filtrage multi-sélection des clients (encoches)
    if (Array.isArray(currentFilter.clients) && currentFilter.clients.length > 0) {
      if (!currentFilter.clients.includes(item.client)) return false;
    } else if (currentFilter.client && currentFilter.client !== "all") {
      if (item.client !== currentFilter.client) return false;
    }

    // Filtrage multi-sélection des prestations (encoches)
    if (Array.isArray(currentFilter.tasks) && currentFilter.tasks.length > 0) {
      const matchesAny = currentFilter.tasks.some(t => item.task && item.task.includes(t));
      if (!matchesAny) return false;
    } else if (currentFilter.task && currentFilter.task !== "all") {
      if (!item.task || !item.task.includes(currentFilter.task)) return false;
    }

    if (currentFilter.dateFrom) {
      const itemDate = (item.datetime || "").split("T")[0];
      if (itemDate && itemDate < currentFilter.dateFrom) return false;
    }
    if (currentFilter.dateTo) {
      const itemDate = (item.datetime || "").split("T")[0];
      if (itemDate && itemDate > currentFilter.dateTo) return false;
    }
    if (currentFilter.search) {
      const q = currentFilter.search;
      const match = item.client.toLowerCase().includes(q) ||
                    item.parcel.toLowerCase().includes(q) ||
                    item.worker.toLowerCase().includes(q) ||
                    item.task.toLowerCase().includes(q) ||
                    (item.notes && item.notes.toLowerCase().includes(q)) ||
                    item.id.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  if (tableCountBadge) {
    tableCountBadge.textContent = `${filtered.length} enregistrée${filtered.length > 1 ? 's' : ''}`;
  }

  // Update Status Badges in Segmented Control
  const countAll = interventions.length;
  const countPending = interventions.filter(i => i.status === "À facturer").length;
  const countBilled = interventions.filter(i => i.status === "Facturée").length;
  setElemText("count-status-all", countAll);
  setElemText("count-status-pending", countPending);
  setElemText("count-status-billed", countBilled);

  // Update Active State on Filter Dropdowns
  const isClientActive = (Array.isArray(currentFilter.clients) && currentFilter.clients.length > 0) || (currentFilter.client && currentFilter.client !== "all");
  const wrapClient = document.getElementById("wrap-filter-client");
  if (wrapClient) {
    wrapClient.classList.toggle("is-active", isClientActive);
  }

  const isTaskActive = (Array.isArray(currentFilter.tasks) && currentFilter.tasks.length > 0) || (currentFilter.task && currentFilter.task !== "all");
  const wrapTask = document.getElementById("wrap-filter-task");
  if (wrapTask) {
    wrapTask.classList.toggle("is-active", isTaskActive);
  }

  const wrapDate = document.getElementById("wrap-filter-date");
  if (wrapDate) {
    wrapDate.classList.toggle("is-active", currentFilter.datePreset !== "all" || Boolean(currentFilter.dateFrom) || Boolean(currentFilter.dateTo));
  }
  const resetBtn = document.getElementById("btn-reset-table-filters");
  if (resetBtn) {
    const hasFilter = isClientActive || 
                      isTaskActive || 
                      currentFilter.status !== "all" || 
                      Boolean(currentFilter.search) || 
                      Boolean(currentFilter.dateFrom) || 
                      Boolean(currentFilter.dateTo) || 
                      currentFilter.datePreset !== "all";
    resetBtn.style.display = hasFilter ? "inline-flex" : "none";
  }

  if (filtered.length === 0) {
    tbody.innerHTML = "";
    if (tableEmpty) {
      tableEmpty.style.display = "flex";
      if (interventions.length === 0) {
        if (emptyMsg) emptyMsg.textContent = "Votre base d'interventions est actuellement vierge. Créez vos clients et consignez vos premiers chantiers.";
      } else {
        if (emptyMsg) emptyMsg.textContent = "Aucune intervention ne correspond aux critères de recherche actuels.";
      }
    }
    return;
  }

  if (tableEmpty) tableEmpty.style.display = "none";

  let html = "";
  filtered.forEach(item => {
    const formattedDate = formatDateDisplay(item.datetime);
    const isUnbilled = item.status === "À facturer";
    const statusClass = isUnbilled ? "status-unbilled" : "status-billed";
    const statusIcon = isUnbilled ? "⏳" : "✅";
    const newClass = item.isNewlyCreated ? "newly-added" : "";

    html += `
      <tr class="${newClass}" data-id="${item.id}">
        <td>
          <div class="cell-datetime">
            <span class="date-main">${formattedDate.date}</span>
            <span class="time-sub">${formattedDate.time}</span>
          </div>
        </td>
        <td>
          <span class="client-name">${escapeHTML(item.client)}</span>
        </td>
        <td>
          <div class="parcel-info">
            <span class="parcel-name">${escapeHTML(item.parcel)}</span>
          </div>
        </td>
        <td>
          <span class="task-tag">✂️ ${escapeHTML(item.task)}</span>
        </td>
        <td>
          <span class="volume-value">${item.unit === 'ha' ? formatSurface(item.quantity) : (item.unit === 'kg' ? Number(item.quantity).toLocaleString('fr-FR') : item.quantity)} ${item.unit}</span>
        </td>
        <td>
          <span class="amount-value">${item.total.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € HT</span>
        </td>
        <td>
          <span class="amount-value amount-ttc" style="color: var(--color-accent-light, #74c69d); font-weight: 700;">${((item.total || 0) * (1 + getTvaRate(item))).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € TTC</span>
          <span style="font-size: 0.70rem; display: block; opacity: 0.78; color: var(--color-text-muted);">TVA ${Math.round(getTvaRate(item) * 100)}%</span>
        </td>
        <td>
          <button class="status-pill-toggle ${statusClass}" onclick="toggleInterventionStatus('${item.id}')" title="Cliquer pour basculer le statut">
            <span>${statusIcon}</span>
            <span>${item.status}</span>
          </button>
        </td>
        <td class="text-right">
          <div class="row-actions">
            <button class="action-btn" onclick="openDetailModal('${item.id}')" title="Voir les détails">👁️</button>
            <button class="action-btn edit-btn" onclick="openEditInterventionModal('${item.id}')" title="Modifier l'intervention">✏️</button>
            <button class="action-btn delete-btn" onclick="deleteIntervention('${item.id}')" title="Supprimer">🗑️</button>
          </div>
        </td>
      </tr>
    `;

    item.isNewlyCreated = false;
  });

  tbody.innerHTML = html;
}

// Render Clients View
function renderClientsView() {
  const grid = document.getElementById("clients-grid");
  const emptyState = document.getElementById("clients-empty-state");

  if (!grid) return;

  const filteredClients = clients.filter(c => {
    if (!clientsSearchFilter) return true;
    const q = clientsSearchFilter;
    const match = c.name.toLowerCase().includes(q) ||
                  (c.commune && c.commune.toLowerCase().includes(q)) ||
                  (c.contact && c.contact.toLowerCase().includes(q)) ||
                  (c.parcels && c.parcels.some(p => p.name.toLowerCase().includes(q) || (p.grape && p.grape.toLowerCase().includes(q))));
    return match;
  });

  if (filteredClients.length === 0) {
    grid.innerHTML = "";
    if (emptyState) emptyState.style.display = "flex";
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  let html = "";
  filteredClients.forEach(c => {
    const totalParcels = c.parcels ? c.parcels.length : 0;
    let totalHa = 0;
    if (c.parcels) {
      c.parcels.forEach(p => totalHa += (p.surface || 0));
    }

    const clientInterventions = interventions.filter(i => i.client === c.name || (i.clientId && i.clientId === c.id));
    const interventionsCount = clientInterventions.length;

    let parcelsHtml = "";
    if (c.parcels && c.parcels.length > 0) {
      parcelsHtml = c.parcels.map(p => `
        <div class="parcel-item">
          <div class="parcel-item-info">
            <span class="parcel-item-name">${escapeHTML(p.name)} (${formatSurface(p.surface)} ha)</span>
            <span class="parcel-item-tags">🍇 ${escapeHTML(p.grape || 'Cépage')} ${p.soil ? '• ' + escapeHTML(p.soil) : ''}</span>
          </div>
          <button class="btn-delete-parcel" onclick="deleteParcel('${c.id}', '${p.id}')" title="Supprimer cette parcelle">✕</button>
        </div>
      `).join("");
    } else {
      parcelsHtml = `<div style="font-size:0.75rem; color:var(--color-text-muted); padding:0.4rem;">Aucune parcelle répertoriée.</div>`;
    }

    html += `
      <div class="client-card">
        <div class="client-card-header">
          <div class="client-card-domain">
            <div class="client-title-row">
              <h3 class="domain-name">${escapeHTML(c.name)}</h3>
              <button class="btn-icon-edit" onclick="openEditClientModal('${c.id}')" title="Modifier ce client">✏️</button>
            </div>
            <span class="domain-commune">📍 ${escapeHTML(c.commune || 'Région non précisée')}</span>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem;">
            <span class="badge-tag">${totalParcels} parcelle${totalParcels > 1 ? 's' : ''} • ${formatSurface(totalHa)} ha</span>
            <span class="badge-tag badge-interventions">🚜 ${interventionsCount} intervention${interventionsCount > 1 ? 's' : ''}</span>
          </div>
        </div>

        <div class="client-card-meta">
          ${c.contact ? `<div class="client-meta-line"><span>👤</span> <strong>${escapeHTML(c.contact)}</strong></div>` : ''}
          ${c.phone ? `<div class="client-meta-line"><span>📞</span> ${escapeHTML(c.phone)}</div>` : ''}
          ${c.email ? `<div class="client-meta-line"><span>✉️</span> ${escapeHTML(c.email)}</div>` : ''}
          ${c.notes ? `<div class="client-meta-line" style="font-style:italic; color:var(--color-text-muted);">📝 ${escapeHTML(c.notes)}</div>` : ''}
        </div>

        <!-- MENU DÉROULANT DES PARCELLES ASSOCIÉES -->
        <details class="client-parcels-accordion">
          <summary class="parcels-accordion-summary">
            <span class="summary-left">
              <span class="summary-icon">🌿</span>
              <span>Parcelles associées (${totalParcels})</span>
            </span>
            <span class="summary-chevron">▼</span>
          </summary>
          <div class="parcels-dropdown-content">
            <div class="parcels-dropdown-header">
              <span>${totalParcels} parcelle(s) répertoriée(s)</span>
              <button type="button" class="btn-link-action" onclick="openParcelModal('${c.id}')">＋ Ajouter</button>
            </div>
            <div class="parcels-list">
              ${parcelsHtml}
            </div>
          </div>
        </details>

        <div class="client-card-footer">
          <div class="client-card-footer-btns">
            <button type="button" class="btn btn-outline btn-xs btn-view-dossier" onclick="openClientDossier('${c.id}')" title="Consulter le dossier complet (parcelles & interventions)">
              <span>📋 Voir toutes les données</span>
            </button>
            <button type="button" class="btn btn-primary btn-xs btn-client-intervention" onclick="quickCreateForClient('${c.id}')" title="Saisir une intervention pour ce domaine">
              <span>🚜 Intervention</span>
            </button>
          </div>
          <button class="action-btn delete-btn client-delete-btn" onclick="deleteClient('${c.id}')" title="Supprimer le domaine">🗑️</button>
        </div>
      </div>
    `;
  });

  grid.innerHTML = html;
}

let activeDossierClientId = null;
let dossierDateFilterFrom = "";
let dossierActivePreset = "all";

window.onDossierDateFilterChange = function(val) {
  dossierDateFilterFrom = val ? val.trim() : "";
  dossierActivePreset = "custom";
  updateDossierPresetUI();
  if (activeDossierClientId) {
    populateDossierContent(activeDossierClientId);
  }
};

window.resetDossierDateFilter = function() {
  dossierDateFilterFrom = "";
  dossierActivePreset = "all";
  const input = document.getElementById("dossier-filter-date-from");
  if (input) input.value = "";
  updateDossierPresetUI();
  if (activeDossierClientId) {
    populateDossierContent(activeDossierClientId);
  }
};

window.setDossierDatePreset = function(preset) {
  dossierActivePreset = preset;
  const now = new Date();
  const input = document.getElementById("dossier-filter-date-from");

  if (preset === "all") {
    dossierDateFilterFrom = "";
  } else if (preset === "curyear") {
    dossierDateFilterFrom = `${now.getFullYear()}-01-01`;
  } else if (preset === "curmonth") {
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    dossierDateFilterFrom = `${now.getFullYear()}-${mm}-01`;
  } else if (preset === "days30") {
    const past = new Date();
    past.setDate(now.getDate() - 30);
    const yr = past.getFullYear();
    const mm = String(past.getMonth() + 1).padStart(2, '0');
    const dd = String(past.getDate()).padStart(2, '0');
    dossierDateFilterFrom = `${yr}-${mm}-${dd}`;
  }

  if (input) input.value = dossierDateFilterFrom;
  updateDossierPresetUI();
  if (activeDossierClientId) {
    populateDossierContent(activeDossierClientId);
  }
};

function updateDossierPresetUI() {
  const presets = ["all", "curyear", "curmonth", "days30"];
  presets.forEach(p => {
    const btn = document.getElementById(`dossier-preset-${p}`);
    if (btn) {
      btn.classList.toggle("active", p === dossierActivePreset);
    }
  });
}

window.openClientDossier = function(clientId, retainTab = false) {
  const client = clients.find(c => c.id === clientId);
  if (!client) return;

  activeDossierClientId = clientId;
  
  const modal = document.getElementById("client-dossier-modal");
  if (!modal) return;

  // Header info
  const nameElem = document.getElementById("dossier-client-name");
  const communeBadge = document.getElementById("dossier-commune-badge");
  const subtitleElem = document.getElementById("dossier-client-subtitle");
  
  if (nameElem) nameElem.textContent = client.name;
  if (communeBadge) communeBadge.textContent = `📍 ${client.commune || 'Région viticole non précisée'}`;
  if (subtitleElem) subtitleElem.textContent = `Dossier complet du Domaine • ${client.contact ? 'Contact : ' + client.contact : 'Exploitant'}`;

  // Sync date input & presets
  const input = document.getElementById("dossier-filter-date-from");
  if (input) input.value = dossierDateFilterFrom || "";
  updateDossierPresetUI();

  // Populate data
  populateDossierContent(clientId);

  // Button hooks inside dossier
  const btnAddParcel = document.getElementById("dossier-btn-add-parcel");
  if (btnAddParcel) btnAddParcel.onclick = () => { closeClientDossier(); openParcelModal(client.id); };

  const btnNewIntervention = document.getElementById("dossier-btn-new-intervention");
  if (btnNewIntervention) btnNewIntervention.onclick = () => { closeClientDossier(); quickCreateForClient(client.id); };

  const btnCreateInterventionBottom = document.getElementById("dossier-btn-create-intervention");
  if (btnCreateInterventionBottom) btnCreateInterventionBottom.onclick = () => { closeClientDossier(); quickCreateForClient(client.id); };

  const btnEditClient = document.getElementById("dossier-btn-edit-client");
  if (btnEditClient) btnEditClient.onclick = () => { closeClientDossier(); openEditClientModal(client.id); };

  const btnOpenInHistory = document.getElementById("dossier-btn-open-history");
  if (btnOpenInHistory) btnOpenInHistory.onclick = () => { closeClientDossier(); switchView("client-history", client.id); };

  if (!retainTab) {
    switchDossierTab("parcels");
  }

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  lockBodyScroll();
  const dossierModalBody = modal.querySelector(".modal-body");
  if (dossierModalBody) dossierModalBody.scrollTop = 0;
};

function populateDossierContent(clientId) {
  const client = clients.find(c => c.id === clientId);
  if (!client) return;

  // Metrics
  const parcels = client.parcels || [];
  const totalParcels = parcels.length;
  let totalHa = 0;
  parcels.forEach(p => totalHa += (p.surface || 0));

  const allClientInterventions = interventions.filter(i => i.client === client.name || (i.clientId && i.clientId === client.id));
  
  // Filter by date "à partir de quand" if specified
  let clientInterventions = allClientInterventions;
  if (dossierDateFilterFrom) {
    clientInterventions = allClientInterventions.filter(i => {
      if (!i.datetime) return false;
      const itemDate = i.datetime.split("T")[0];
      return itemDate >= dossierDateFilterFrom;
    });
  }

  let unbilledTotal = 0;
  let unbilledTotalTTC = 0;
  let billedTotal = 0;
  let billedTotalTTC = 0;
  clientInterventions.forEach(i => {
    const rate = getTvaRate(i);
    const itemTTC = (i.total || 0) * (1 + rate);
    if (i.status === "À facturer") {
      unbilledTotal += (i.total || 0);
      unbilledTotalTTC += itemTTC;
    } else if (i.status === "Facturée") {
      billedTotal += (i.total || 0);
      billedTotalTTC += itemTTC;
    }
  });

  setElemText("dossier-total-ha", `${formatSurface(totalHa)} ha`);
  setElemText("dossier-parcels-count", totalParcels);
  setElemText("dossier-interventions-count", dossierDateFilterFrom ? `${clientInterventions.length} / ${allClientInterventions.length}` : `${clientInterventions.length}`);
  setElemText("dossier-unbilled-total", `${unbilledTotal.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € HT`);
  setElemText("dossier-unbilled-ttc", `${unbilledTotalTTC.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € TTC`);
  setElemText("dossier-billed-total", `${billedTotal.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € HT`);
  setElemText("dossier-billed-ttc", `${billedTotalTTC.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € TTC`);

  setElemText("dossier-count-parcels-tab", totalParcels);
  setElemText("dossier-count-interventions-tab", clientInterventions.length);

  // Filter Indicator & Badges
  const indicatorElem = document.getElementById("dossier-filter-indicator");
  const tabBadge = document.getElementById("dossier-interventions-filter-badge");
  if (indicatorElem) {
    if (dossierDateFilterFrom) {
      const parts = dossierDateFilterFrom.split("-");
      const frDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dossierDateFilterFrom;
      indicatorElem.innerHTML = `<span>🔎 Filtre actif : <strong>${clientInterventions.length} intervention(s)</strong> affichée(s) à partir du <strong>${frDate}</strong> (sur ${allClientInterventions.length} au total)</span>`;
      if (tabBadge) {
        tabBadge.style.display = "inline-flex";
        tabBadge.textContent = `📅 À partir du ${frDate} (${clientInterventions.length})`;
      }
    } else {
      indicatorElem.innerHTML = `<span>Affichage de toutes les interventions (${allClientInterventions.length} au total)</span>`;
      if (tabBadge) {
        tabBadge.style.display = "none";
      }
    }
  }

  // Tab 1: Parcels
  const parcelsContainer = document.getElementById("dossier-parcels-container");
  if (parcelsContainer) {
    if (parcels.length > 0) {
      parcelsContainer.innerHTML = parcels.map(p => `
        <div class="parcel-item">
          <div class="parcel-item-info">
            <span class="parcel-item-name">${escapeHTML(p.name)} (${formatSurface(p.surface)} ha)</span>
            <span class="parcel-item-tags">🍇 ${escapeHTML(p.grape || 'Cépage')} ${p.soil ? '• ' + escapeHTML(p.soil) : ''}</span>
          </div>
          <button class="btn-delete-parcel" onclick="deleteParcelFromDossier('${client.id}', '${p.id}')" title="Supprimer cette parcelle">✕</button>
        </div>
      `).join("");
    } else {
      parcelsContainer.innerHTML = `<div style="font-size:0.85rem; color:var(--color-text-muted); padding:1rem; text-align:center;">Aucune parcelle répertoriée pour ce client.</div>`;
    }
  }

  // Tab 2: Interventions
  const interventionsTbody = document.getElementById("dossier-interventions-tbody");
  if (interventionsTbody) {
    if (clientInterventions.length > 0) {
      interventionsTbody.innerHTML = clientInterventions.map(item => {
        const formatted = formatDateDisplay(item.datetime);
        const statusClass = item.status === "Facturée" ? "status-billed" : "status-pending";
        const statusIcon = item.status === "Facturée" ? "✅" : "⏳";
        return `
          <tr>
            <td>
              <div class="cell-datetime">
                <span class="date-main">${formatted.date}</span>
                <span class="date-sub">${formatted.time}</span>
              </div>
            </td>
            <td>🌿 <strong>${escapeHTML(item.parcel)}</strong></td>
            <td><span class="task-tag">✂️ ${escapeHTML(item.task)}</span></td>
            <td>${item.unit === 'ha' ? formatSurface(item.quantity) : (item.unit === 'kg' ? Number(item.quantity).toLocaleString('fr-FR') : item.quantity)} ${item.unit}</td>
            <td><strong>${(item.total || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € HT</strong></td>
            <td>
              <strong style="color: var(--color-accent-light, #74c69d);">${((item.total || 0) * (1 + getTvaRate(item))).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € TTC</strong>
              <span style="font-size: 0.70rem; opacity: 0.75; display: block; color: var(--color-text-muted);">TVA ${Math.round(getTvaRate(item) * 100)}%</span>
            </td>
            <td>
              <button class="status-pill-toggle ${statusClass}" onclick="toggleInterventionStatusFromDossier('${item.id}', '${client.id}')" title="Basculer le statut">
                <span>${statusIcon}</span>
                <span>${item.status}</span>
              </button>
            </td>
            <td class="text-right">
              <div class="row-actions">
                <button class="action-btn" onclick="openDetailModal('${item.id}')" title="Voir les détails">👁️</button>
                <button class="action-btn edit-btn" onclick="openEditInterventionModalFromDossier('${item.id}', '${client.id}')" title="Modifier l'intervention">✏️</button>
                <button class="action-btn delete-btn" onclick="deleteInterventionFromDossier('${item.id}', '${client.id}')" title="Supprimer">🗑️</button>
              </div>
            </td>
          </tr>
        `;
      }).join("");
    } else {
      if (dossierDateFilterFrom) {
        const parts = dossierDateFilterFrom.split("-");
        const frDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dossierDateFilterFrom;
        interventionsTbody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align:center; padding:2rem; color:var(--color-text-muted);">
              Aucune intervention enregistrée pour ${escapeHTML(client.name)} à partir du <strong>${frDate}</strong>.
              <div style="margin-top:0.75rem;">
                <button type="button" class="btn btn-outline btn-xs" onclick="resetDossierDateFilter()">✕ Afficher tout l'historique</button>
              </div>
            </td>
          </tr>
        `;
      } else {
        interventionsTbody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align:center; padding:2rem; color:var(--color-text-muted);">
              Aucune intervention enregistrée pour ${escapeHTML(client.name)}.
            </td>
          </tr>
        `;
      }
    }
  }

  // Tab 3: Info & Notes
  setElemText("dossier-contact-val", client.contact || 'Non renseigné');
  setElemText("dossier-phone-val", client.phone || 'Non renseigné');
  setElemText("dossier-email-val", client.email || 'Non renseigné');
  setElemText("dossier-commune-val", client.commune || 'Non renseignée');
  const notesElem = document.getElementById("dossier-notes-val");
  if (notesElem) notesElem.textContent = client.notes || 'Aucune observation particulière.';
}

window.switchDossierTab = function(tabName) {
  const tabs = ["parcels", "interventions", "info"];
  tabs.forEach(t => {
    const btn = document.getElementById(`dossier-tab-btn-${t}`);
    const content = document.getElementById(`dossier-tab-${t}`);
    if (btn) btn.classList.toggle("active", t === tabName);
    if (content) content.style.display = (t === tabName) ? "block" : "none";
  });
};

function closeClientDossier() {
  const modal = document.getElementById("client-dossier-modal");
  if (modal) {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    unlockBodyScroll();
  }
}
window.closeClientDossier = closeClientDossier;

window.deleteParcelFromDossier = function(clientId, parcelId) {
  deleteParcel(clientId, parcelId);
  openClientDossier(clientId, true);
};

window.toggleInterventionStatusFromDossier = function(interventionId, clientId) {
  toggleInterventionStatus(interventionId);
  openClientDossier(clientId, true);
};

window.openEditInterventionModalFromDossier = function(interventionId, clientId) {
  closeClientDossier();
  openEditInterventionModal(interventionId);
};

window.deleteInterventionFromDossier = function(interventionId, clientId) {
  deleteIntervention(interventionId, clientId);
};

window.quickCreateForClient = function(clientId) {
  openCreateModal();
  const select = document.getElementById("input-client");
  if (select) {
    select.value = clientId;
    populateParcelSelectForClient(clientId);
  }
};

// ==================== INTERVENTIONS STATUS & DETAILS ====================
window.toggleInterventionStatus = function(id) {
  const item = interventions.find(i => i.id === id);
  if (!item) return;

  if (item.status === "À facturer") {
    item.status = "Facturée";
    showToast(`Intervention #${id} passée en « Facturée »`, "success");
  } else {
    item.status = "À facturer";
    showToast(`Intervention #${id} remise en « À facturer »`, "info");
  }

  saveInterventionsLocally();
  syncInterventionStatusToSupabase(id, item.status);
  renderAll();
};

window.deleteIntervention = function(id, fromClientId = null) {
  const index = interventions.findIndex(i => i.id === id);
  if (index === -1) return;

  if (confirm(`Supprimer définitivement l'intervention #${id} ?`)) {
    interventions.splice(index, 1);
    saveInterventionsLocally();
    deleteInterventionFromSupabase(id);
    renderAll();
    const cId = fromClientId || (typeof activeDossierClientId !== "undefined" ? activeDossierClientId : null);
    if (cId) {
      const dossierModal = document.getElementById("client-dossier-modal");
      if (dossierModal && dossierModal.classList.contains("open")) {
        populateDossierContent(cId);
      }
    }
    showToast(`Intervention #${id} supprimée`, "info");
  }
};

window.openDetailModal = function(id) {
  const item = interventions.find(i => i.id === id);
  if (!item) return;

  const modal = document.getElementById("detail-modal");
  const detailId = document.getElementById("detail-id");
  const detailBody = document.getElementById("detail-body");
  const toggleBtn = document.getElementById("detail-toggle-status-btn");
  const editBtn = document.getElementById("detail-edit-btn");

  if (detailId) detailId.textContent = `Intervention #${item.id} — ${item.client}`;

  const formattedDate = formatDateDisplay(item.datetime);

  if (detailBody) {
    detailBody.innerHTML = `
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Date & Heure</span>
          <span class="detail-value">${formattedDate.date} à ${formattedDate.time}</span>
        </div>
        ${item.worker ? `
        <div class="detail-item">
          <span class="detail-label">Salarié</span>
          <span class="detail-value">${escapeHTML(item.worker)}</span>
        </div>` : ''}
        <div class="detail-item">
          <span class="detail-label">Client</span>
          <span class="detail-value">${escapeHTML(item.client)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Parcelle</span>
          <span class="detail-value">${escapeHTML(item.parcel)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Prestation</span>
          <span class="detail-value">${escapeHTML(item.task)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Volume / Tarif</span>
          <span class="detail-value">${item.unit === 'ha' ? formatSurface(item.quantity) : (item.unit === 'kg' ? Number(item.quantity).toLocaleString('fr-FR') : item.quantity)} ${item.unit} (@ ${item.unitPrice} €)</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Total estimé HT</span>
          <span class="detail-value text-gradient" style="font-size: 1.2rem;">${item.total.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} € HT</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Total estimé TTC (TVA ${Math.round(getTvaRate(item) * 100)}%)</span>
          <span class="detail-value" style="font-size: 1.2rem; font-weight: 700; color: var(--color-accent-light, #74c69d);">${((item.total || 0) * (1 + getTvaRate(item))).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} € TTC</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Statut facturation</span>
          <span class="detail-value">${item.status === 'À facturer' ? '⏳ À facturer' : '✅ Facturée'}</span>
        </div>
        <div class="detail-notes-box">
          <strong>Notes & Observations :</strong><br>
          ${item.notes ? escapeHTML(item.notes) : '<em>Aucune note enregistrée.</em>'}
        </div>
      </div>
    `;
  }

  if (editBtn) {
    editBtn.onclick = () => {
      closeDetailModal();
      openEditInterventionModal(item.id);
    };
  }

  if (toggleBtn) {
    toggleBtn.textContent = item.status === "À facturer" ? "Marquer comme Facturée" : "Remettre en À facturer";
    toggleBtn.onclick = () => {
      toggleInterventionStatus(item.id);
      closeDetailModal();
    };
  }

  if (modal) {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    lockBodyScroll();
    const modalBody = modal.querySelector(".modal-body");
    if (modalBody) modalBody.scrollTop = 0;
  }
};

function closeDetailModal() {
  const modal = document.getElementById("detail-modal");
  if (modal) {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    unlockBodyScroll();
  }
}

// ==================== CSV EXPORT ====================
function exportCSV() {
  if (interventions.length === 0) {
    showToast("Aucune intervention à exporter pour le moment.", "warning");
    return;
  }

  const BOM = "\uFEFF";
  const headers = ["ID", "Date", "Heure", "Salarié", "Client", "Parcelle", "Prestation", "Quantité", "Unité", "Tarif Unitaire HT", "Total HT", "Taux TVA", "Total TTC", "Statut", "Observations"];

  const rows = interventions.map(item => {
    const formatted = formatDateDisplay(item.datetime);
    const rate = getTvaRate(item);
    const ratePercent = `${Math.round(rate * 100)}%`;
    const itemTTC = ((item.total || 0) * (1 + rate)).toFixed(2);
    return [
      `"${item.id || ''}"`,
      `"${formatted.date}"`,
      `"${formatted.time}"`,
      `"${(item.worker || '').replace(/"/g, '""')}"`,
      `"${(item.client || '').replace(/"/g, '""')}"`,
      `"${item.parcel.replace(/"/g, '""')}"`,
      `"${item.task.replace(/"/g, '""')}"`,
      `"${item.quantity}"`,
      `"${item.unit}"`,
      `"${item.unitPrice}"`,
      `"${(item.total || 0).toFixed(2)}"`,
      `"${ratePercent}"`,
      `"${itemTTC}"`,
      `"${item.status}"`,
      `"${(item.notes || '').replace(/"/g, '""')}"`
    ].join(";");
  });

  const csvContent = BOM + headers.join(";") + "\n" + rows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dateStr = new Date().toISOString().split("T")[0];

  link.setAttribute("href", url);
  link.setAttribute("download", `vititrack_export_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast(`📁 Fichier CSV exporté (${interventions.length} interventions)`, "success");
}

// ==================== PRESTATIONS & TRAVAUX LOGIC ====================
function populateTaskSelects() {
  const inputTask = document.getElementById("input-task");
  const filterTask = document.getElementById("filter-task");
  const inputPlannedService = document.getElementById("input-planned-service");

  // Fallback to DEFAULT_SERVICES if services array is empty so the user is never blocked
  const availableServices = (services && services.length > 0) ? services : (typeof DEFAULT_SERVICES !== "undefined" ? DEFAULT_SERVICES : []);

  if (inputTask) {
    const currentVal = inputTask.value;
    inputTask.innerHTML = '<option value="">Sélectionner une tâche viticole...</option>';
    
    // Group services by category
    const categories = {};
    availableServices.forEach(s => {
      const cat = s.category || "Autres";
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(s);
    });

    Object.keys(categories).forEach(cat => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = cat;
      categories[cat].forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.name;
        const rateLabel = s.rateType === "hourly" ? `${s.price} €/h` : (s.rateType === "surface" ? `${s.price} €/ha` : (s.rateType === "kilo" ? `${s.price} €/kg` : `${s.price} € forfait`));
        opt.textContent = `${s.name} (${rateLabel})`;
        optgroup.appendChild(opt);
      });
      inputTask.appendChild(optgroup);
    });

    if (currentVal) inputTask.value = currentVal;
  }

  if (filterTask) {
    const currentVal = filterTask.value;
    filterTask.innerHTML = '<option value="all">Toutes les prestations</option>';
    availableServices.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.name;
      opt.textContent = s.name;
      filterTask.appendChild(opt);
    });
    if (currentVal) filterTask.value = currentVal;
  }

  if (inputPlannedService) {
    inputPlannedService.innerHTML = '<option value="">Sélectionner une prestation...</option>';
    availableServices.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.name;
      opt.textContent = s.name;
      inputPlannedService.appendChild(opt);
    });
  }

  // Mettre à jour la liste multi-sélection des prestations avec encoches
  renderTaskMultiSelectFilter();
}

function renderServicesView() {
  renderServicesKPIs();
  renderServices();
  renderPlannedWorks();
}

function renderServicesKPIs() {
  const total = services.length;
  const hourlyCount = services.filter(s => s.rateType === "hourly").length;
  const surfaceCount = services.filter(s => s.rateType === "surface").length;
  const fixedCount = services.filter(s => s.rateType === "fixed").length;
  const kiloCount = services.filter(s => s.rateType === "kilo").length;
  const plannedCount = plannedWorks.length;

  setElemText("services-total-count", total);
  setElemText("services-hourly-count", hourlyCount);
  setElemText("services-surface-count", surfaceCount);
  setElemText("services-fixed-count", fixedCount);
  setElemText("services-planned-count", plannedCount);
  setElemText("sidebar-planned-count", plannedCount);

  setElemText("count-tab-catalog", total);
  setElemText("count-tab-planned", plannedCount);

  // Update Dropdown Category Options with dynamic counts
  const catSelect = document.getElementById("services-filter-category");
  if (catSelect) {
    const cats = [
      { val: "all", label: "Toutes les catégories", count: total },
      { val: "Taille & Végétal", label: "Taille & Végétal", count: services.filter(s => s.category === "Taille & Végétal").length },
      { val: "Palissage & Écimage", label: "Palissage & Rognage", count: services.filter(s => s.category === "Palissage & Écimage").length },
      { val: "Sol & Mécanisation", label: "Sol & Mécanisation", count: services.filter(s => s.category === "Sol & Mécanisation").length },
      { val: "Traitements & Soins", label: "Traitements & Soins", count: services.filter(s => s.category === "Traitements & Soins").length },
      { val: "Vendanges & Récolte", label: "Vendanges & Récolte", count: services.filter(s => s.category === "Vendanges & Récolte").length },
      { val: "Aménagement & Plantations", label: "Plantations & Entretien", count: services.filter(s => s.category === "Aménagement & Plantations").length },
      { val: "Autre Prestation", label: "Autre prestation", count: services.filter(s => s.category === "Autre Prestation").length }
    ];
    const currentCatVal = servicesCategoryFilter || "all";
    catSelect.innerHTML = cats.map(c => `<option value="${escapeHTML(c.val)}" ${c.val === currentCatVal ? "selected" : ""}>${escapeHTML(c.label)} (${c.count})</option>`).join("");
  }

  // Update Dropdown Rate Options with dynamic counts
  const rateSelect = document.getElementById("services-filter-rate");
  if (rateSelect) {
    const rates = [
      { val: "all", label: "Tous les modes de facturation", count: total },
      { val: "hourly", label: "Taux horaire (€/h)", count: hourlyCount },
      { val: "surface", label: "À l'hectare (€/ha)", count: surfaceCount },
      { val: "fixed", label: "Forfait fixe (€)", count: fixedCount },
      { val: "kilo", label: "Au kilo (€/kg)", count: kiloCount }
    ];
    const currentRateVal = servicesRateTypeFilter || "all";
    rateSelect.innerHTML = rates.map(r => `<option value="${escapeHTML(r.val)}" ${r.val === currentRateVal ? "selected" : ""}>${escapeHTML(r.label)} (${r.count})</option>`).join("");
  }
}

function updateServicesFilterResetBtn() {
  const resetWrap = document.getElementById("services-filter-reset-wrap");
  const isFiltered = (servicesCategoryFilter && servicesCategoryFilter !== "all") ||
                     (servicesRateTypeFilter && servicesRateTypeFilter !== "all") ||
                     (servicesSearchFilter && servicesSearchFilter.length > 0);
  if (resetWrap) {
    resetWrap.style.display = isFiltered ? "flex" : "none";
  }
}

function resetServicesFilters() {
  servicesCategoryFilter = "all";
  servicesRateTypeFilter = "all";
  servicesSearchFilter = "";
  const catSelect = document.getElementById("services-filter-category");
  const rateSelect = document.getElementById("services-filter-rate");
  const searchInput = document.getElementById("services-search-input");
  const wrapCat = document.getElementById("wrap-services-cat");
  const wrapRate = document.getElementById("wrap-services-rate");

  if (catSelect) catSelect.value = "all";
  if (rateSelect) rateSelect.value = "all";
  if (searchInput) searchInput.value = "";
  if (wrapCat) wrapCat.classList.remove("is-active");
  if (wrapRate) wrapRate.classList.remove("is-active");

  updateServicesFilterResetBtn();
  updateServicesMetrics();
  renderServices();
}
window.resetServicesFilters = resetServicesFilters;

function renderSingleServiceCard(s) {
  let rateBadgeClass = "rate-hourly";
  let rateUnit = "€/h";
  let rateModeText = "Au temps passé";
  if (s.rateType === "surface") {
    rateBadgeClass = "rate-surface";
    rateUnit = "€/ha";
    rateModeText = "À la surface";
  } else if (s.rateType === "kilo") {
    rateBadgeClass = "rate-kilo";
    rateUnit = "€/kg";
    rateModeText = "Au kilo";
  } else if (s.rateType === "fixed") {
    rateBadgeClass = "";
    rateUnit = "€";
    rateModeText = "Forfait fixe";
  }

  return `
    <div class="service-card" data-id="${escapeHTML(s.id)}">
      <div class="service-card-header">
        <span class="service-cat-badge">${escapeHTML(s.category)}</span>
        <div style="display: flex; gap: 0.4rem; align-items: center;">
          <span style="font-size: 0.70rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: rgba(82, 183, 136, 0.15); color: var(--color-accent-light, #74c69d);">TVA ${Math.round(getTvaRate(s) * 100)}%</span>
          <span class="service-rate-badge ${rateBadgeClass}">${s.price} ${rateUnit}</span>
        </div>
      </div>
      <div class="service-title">${escapeHTML(s.name)}</div>
      <div class="service-desc">${escapeHTML(s.description || 'Prestation viticole professionnelle.')}</div>
      <div class="service-meta-row">
        <span>${rateModeText}</span>
        <div class="service-card-actions">
          <button class="btn btn-outline btn-xs" onclick="editService('${escapeHTML(s.id)}')">✏️ Modifier</button>
          <button class="btn btn-ghost btn-xs text-muted" onclick="deleteService('${escapeHTML(s.id)}')" title="Supprimer">🗑️</button>
        </div>
      </div>
    </div>
  `;
}

function renderServices() {
  const grid = document.getElementById("services-grid");
  if (!grid) return;

  const filtered = services.filter(s => {
    if (servicesCategoryFilter !== "all" && s.category !== servicesCategoryFilter) return false;
    if (servicesRateTypeFilter !== "all" && s.rateType !== servicesRateTypeFilter) return false;
    if (servicesSearchFilter) {
      const q = servicesSearchFilter;
      const match = s.name.toLowerCase().includes(q) ||
                    (s.description && s.description.toLowerCase().includes(q)) ||
                    s.category.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="table-empty-state" style="grid-column: 1 / -1; width: 100%;">
        <div class="empty-icon">✂️</div>
        <h3>Aucune prestation ${services.length === 0 ? 'enregistrée' : 'trouvée'}</h3>
        <p>${services.length === 0 ? 'Votre catalogue de prestations est actuellement vide. Créez vos prestations personnalisées ou importez les prestations types.' : 'Modifiez vos filtres ou ajoutez une nouvelle prestation à votre catalogue.'}</p>
        <div style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; margin-top: 0.75rem;">
          <button class="btn btn-primary btn-sm" onclick="openServiceModal()">＋ Nouvelle prestation</button>
          ${services.length === 0 ? '<button class="btn btn-outline btn-sm" onclick="seedStandardServices()">📚 Importer les 15 prestations types</button>' : ''}
        </div>
      </div>
    `;
    return;
  }

  const catIcons = {
    "Taille & Végétal": "✂️",
    "Palissage & Écimage": "🌿",
    "Sol & Mécanisation": "🚜",
    "Traitements & Soins": "🛡️",
    "Vendanges & Récolte": "🍇",
    "Aménagement & Plantations": "🌱",
    "Autre Prestation": "📋"
  };

  // If "all" categories are selected and not in active search, render as collapsible category accordions
  if (servicesCategoryFilter === "all" && !servicesSearchFilter) {
    const categoryOrder = [
      "Taille & Végétal",
      "Palissage & Écimage",
      "Sol & Mécanisation",
      "Traitements & Soins",
      "Vendanges & Récolte",
      "Aménagement & Plantations",
      "Autre Prestation"
    ];

    const presentCategories = categoryOrder.filter(cat => filtered.some(s => s.category === cat));
    filtered.forEach(s => {
      if (!presentCategories.includes(s.category)) presentCategories.push(s.category);
    });

    grid.innerHTML = presentCategories.map(cat => {
      const catServices = filtered.filter(s => s.category === cat);
      const icon = catIcons[cat] || "🍇";
      return `
        <details class="category-services-accordion" open style="grid-column: 1 / -1; width: 100%;">
          <summary class="category-accordion-summary">
            <div class="cat-summary-info">
              <span class="cat-summary-icon">${icon}</span>
              <span class="cat-summary-title">${escapeHTML(cat)}</span>
              <span class="cat-summary-badge">${catServices.length} prestation${catServices.length > 1 ? 's' : ''}</span>
            </div>
            <span class="cat-summary-arrow">
              <svg width="12" height="7" viewBox="0 0 12 7" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L6 6L11 1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
          </summary>
          <div class="services-grid" style="padding: 1.15rem;">
            ${catServices.map(renderSingleServiceCard).join("")}
          </div>
        </details>
      `;
    }).join("");
  } else {
    // Flat grid when filtered by specific category or search query
    grid.innerHTML = filtered.map(renderSingleServiceCard).join("");
  }
}

function renderPlannedWorks() {
  const tbody = document.getElementById("planned-works-tbody");
  const emptyState = document.getElementById("planned-works-empty");
  if (!tbody) return;

  if (plannedWorks.length === 0) {
    tbody.innerHTML = "";
    if (emptyState) emptyState.style.display = "flex";
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  tbody.innerHTML = plannedWorks.map(w => {
    const formatted = formatDateDisplay(w.date);
    return `
      <tr>
        <td>
          <div class="cell-datetime">
            <span class="date-main">📅 ${formatted.date}</span>
          </div>
        </td>
        <td><strong>🏰 ${escapeHTML(w.clientName)}</strong></td>
        <td>🌿 ${escapeHTML(w.parcel)}</td>
        <td><span class="badge-tag">✂️ ${escapeHTML(w.service)}</span></td>
        <td>👤 ${escapeHTML(w.worker || 'Non assigné')}</td>
        <td>${w.quantity ? w.quantity : '—'}</td>
        <td><span class="badge-planned-status">⏳ À réaliser</span></td>
        <td class="text-right">
          <button class="btn-convert-work" onclick="convertPlannedWork('${escapeHTML(w.id)}')" title="Enregistrer comme intervention réalisée">
            <span>🚀 Valider intervention</span>
          </button>
          <button class="btn-delete-parcel" onclick="deletePlannedWork('${escapeHTML(w.id)}')" title="Supprimer ce travail" style="margin-left: 0.35rem;">
            🗑️
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

// Prestation Modal logic
function updateServicePriceLabel(rateType) {
  const label = document.getElementById("label-service-price");
  if (!label) return;
  if (rateType === "hourly") {
    label.textContent = "Tarif horaire HT (€ / heure)";
  } else if (rateType === "surface") {
    label.textContent = "Tarif à l'hectare HT (€ / hectare)";
  } else if (rateType === "kilo") {
    label.textContent = "Tarif au kilo HT (€ / kg)";
  } else {
    label.textContent = "Tarif forfaitaire HT (€)";
  }
}

function openServiceModal(serviceId = null) {
  const modal = document.getElementById("service-modal");
  const form = document.getElementById("create-service-form");
  const title = document.getElementById("service-modal-title");
  const editIdInput = document.getElementById("service-edit-id");

  if (form) form.reset();

  if (serviceId) {
    const service = services.find(s => s.id === serviceId);
    if (service) {
      if (title) title.textContent = "Modifier la prestation";
      if (editIdInput) editIdInput.value = service.id;
      document.getElementById("input-service-name").value = service.name;
      document.getElementById("input-service-category").value = service.category;
      document.getElementById("input-service-rate-type").value = service.rateType;
      document.getElementById("input-service-price").value = service.price;
      document.getElementById("input-service-desc").value = service.description || "";
      updateServicePriceLabel(service.rateType);
    }
  } else {
    if (title) title.textContent = "Nouvelle prestation viticole";
    if (editIdInput) editIdInput.value = "";
    document.getElementById("input-service-category").value = "Taille & Végétal";
    document.getElementById("input-service-rate-type").value = "hourly";
    document.getElementById("input-service-price").value = "38";
    updateServicePriceLabel("hourly");
  }

  if (modal) {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    lockBodyScroll();
    const modalBody = modal.querySelector(".modal-body");
    if (modalBody) modalBody.scrollTop = 0;
  }
}

function closeServiceModal() {
  const modal = document.getElementById("service-modal");
  if (modal) {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    unlockBodyScroll();
  }
}

function handleCreateServiceSubmit(e) {
  e.preventDefault();

  const editId = document.getElementById("service-edit-id")?.value;
  const name = document.getElementById("input-service-name")?.value.trim();
  const category = document.getElementById("input-service-category")?.value;
  const rateType = document.getElementById("input-service-rate-type")?.value || "hourly";
  const price = parseFloat(document.getElementById("input-service-price")?.value || 0);
  const description = document.getElementById("input-service-desc")?.value.trim() || "";

  if (!name || isNaN(price) || price < 0) {
    showToast("Veuillez renseigner le nom de la prestation et un tarif unitaire valide.", "warning");
    return;
  }

  if (editId) {
    const s = services.find(item => item.id === editId);
    if (s) {
      s.name = name;
      s.category = category;
      s.rateType = rateType;
      s.price = price;
      s.description = description;
      showToast(`Prestation « ${name} » mise à jour !`, "success");
    }
  } else {
    const newService = {
      id: generateUniqueId("SRV"),
      name,
      category,
      rateType,
      price,
      description
    };
    services.push(newService);
    showToast(`Prestation « ${name} » ajoutée au catalogue !`, "success");
  }

  saveServices();
  closeServiceModal();
  populateTaskSelects();
  renderServicesView();
  renderKPIs();
}

window.editService = function(id) {
  openServiceModal(id);
};

window.deleteService = function(id) {
  const s = services.find(item => item.id === id);
  if (!s) return;

  if (confirm(`Voulez-vous vraiment supprimer la prestation « ${s.name} » ?`)) {
    services = services.filter(item => item.id !== id);
    saveServicesLocally();
    deleteServiceFromSupabase(id);
    populateTaskSelects();
    renderServicesView();
    renderKPIs();
    showToast(`Prestation « ${s.name} » supprimée.`, "info");
  }
};

window.seedStandardServices = function() {
  if (services.length > 0 && !confirm("Voulez-vous importer les 15 prestations viticoles standards dans votre catalogue ?")) {
    return;
  }
  services = JSON.parse(JSON.stringify(DEFAULT_SERVICES));
  saveServices();
  populateTaskSelects();
  renderServicesView();
  renderKPIs();
  showToast("15 prestations viticoles standards ajoutées à votre catalogue !", "success");
};

// Menus Déroulants Multi-sélection Clients & Parcelles dans le Modal de Planification
function openPlannedClientDropdown() {
  const wrap = document.getElementById("wrap-planned-client-dropdown");
  const menu = document.getElementById("menu-planned-client-dropdown");
  const trigger = document.getElementById("btn-planned-client-trigger");
  closePlannedParcelDropdown();
  if (wrap && menu) {
    wrap.classList.add("is-open");
    menu.style.display = "flex";
    if (trigger) trigger.setAttribute("aria-expanded", "true");
    const searchInput = document.getElementById("search-planned-clients");
    if (searchInput && searchInput.offsetParent !== null) {
      setTimeout(() => searchInput.focus(), 60);
    }
  }
}

function closePlannedClientDropdown() {
  const wrap = document.getElementById("wrap-planned-client-dropdown");
  const menu = document.getElementById("menu-planned-client-dropdown");
  const trigger = document.getElementById("btn-planned-client-trigger");
  if (wrap && menu) {
    wrap.classList.remove("is-open");
    menu.style.display = "none";
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  }
}

function togglePlannedClientDropdown() {
  const wrap = document.getElementById("wrap-planned-client-dropdown");
  if (wrap && wrap.classList.contains("is-open")) {
    closePlannedClientDropdown();
  } else {
    openPlannedClientDropdown();
  }
}

function openPlannedParcelDropdown() {
  const wrap = document.getElementById("wrap-planned-parcel-dropdown");
  const menu = document.getElementById("menu-planned-parcel-dropdown");
  const trigger = document.getElementById("btn-planned-parcel-trigger");
  if (trigger && trigger.disabled) return;
  closePlannedClientDropdown();
  if (wrap && menu) {
    wrap.classList.add("is-open");
    menu.style.display = "flex";
    if (trigger) trigger.setAttribute("aria-expanded", "true");
  }
}

function closePlannedParcelDropdown() {
  const wrap = document.getElementById("wrap-planned-parcel-dropdown");
  const menu = document.getElementById("menu-planned-parcel-dropdown");
  const trigger = document.getElementById("btn-planned-parcel-trigger");
  if (wrap && menu) {
    wrap.classList.remove("is-open");
    menu.style.display = "none";
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  }
}

function togglePlannedParcelDropdown() {
  const wrap = document.getElementById("wrap-planned-parcel-dropdown");
  if (wrap && wrap.classList.contains("is-open")) {
    closePlannedParcelDropdown();
  } else {
    openPlannedParcelDropdown();
  }
}

function setupPlannedModalEvents() {
  const clientTrigger = document.getElementById("btn-planned-client-trigger");
  if (clientTrigger) {
    clientTrigger.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePlannedClientDropdown();
    });
  }

  const parcelTrigger = document.getElementById("btn-planned-parcel-trigger");
  if (parcelTrigger) {
    parcelTrigger.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePlannedParcelDropdown();
    });
  }

  const clientMenu = document.getElementById("menu-planned-client-dropdown");
  if (clientMenu) {
    clientMenu.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }

  const parcelMenu = document.getElementById("menu-planned-parcel-dropdown");
  if (parcelMenu) {
    parcelMenu.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }

  // Close dropdowns when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#wrap-planned-client-dropdown")) {
      closePlannedClientDropdown();
    }
    if (!e.target.closest("#wrap-planned-parcel-dropdown")) {
      closePlannedParcelDropdown();
    }
  });

  const searchInput = document.getElementById("search-planned-clients");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const val = e.target.value.toLowerCase().trim();
      const items = document.querySelectorAll("#planned-client-checkbox-list .planned-client-item");
      items.forEach(item => {
        const name = item.dataset.clientName || "";
        const commune = item.dataset.commune || "";
        const match = !val || name.includes(val) || commune.includes(val);
        item.style.display = match ? "flex" : "none";
      });
    });
  }

  const btnToggleClients = document.getElementById("btn-toggle-all-planned-clients");
  if (btnToggleClients) {
    btnToggleClients.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const allCbs = Array.from(document.querySelectorAll("#planned-client-checkbox-list .planned-client-cb"));
      if (allCbs.length === 0) return;
      const allChecked = allCbs.every(cb => cb.checked);
      allCbs.forEach(cb => {
        cb.checked = !allChecked;
        const item = cb.closest(".planned-client-item");
        if (item) {
          if (!allChecked) item.classList.add("selected");
          else item.classList.remove("selected");
        }
      });
      onPlannedClientsChanged();
    });
  }

  const btnToggleParcels = document.getElementById("btn-toggle-all-planned-parcels");
  if (btnToggleParcels) {
    btnToggleParcels.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const allCbs = Array.from(document.querySelectorAll("#planned-parcel-checkbox-list .planned-parcel-cb"));
      if (allCbs.length === 0) return;
      const allChecked = allCbs.every(cb => cb.checked);
      allCbs.forEach(cb => {
        cb.checked = !allChecked;
        const item = cb.closest(".planned-parcel-item");
        if (item) {
          if (!allChecked) item.classList.add("selected");
          else item.classList.remove("selected");
        }
      });
      updatePlannedParcelsSummary();
    });
  }

  const qtyInput = document.getElementById("input-planned-quantity");
  if (qtyInput) {
    qtyInput.addEventListener("input", () => {
      qtyInput.dataset.autoFilled = "false";
    });
  }
}

function renderPlannedClientsList() {
  const listEl = document.getElementById("planned-client-checkbox-list");
  const searchWrap = document.getElementById("planned-clients-search-wrap");
  const toggleBtn = document.getElementById("btn-toggle-all-planned-clients");

  if (!listEl) return;

  if (!clients || clients.length === 0) {
    listEl.innerHTML = '<div class="parcel-list-empty">Aucun domaine enregistré. Créez d\'abord un client.</div>';
    if (searchWrap) searchWrap.style.display = "none";
    if (toggleBtn) toggleBtn.style.display = "none";
    return;
  }

  if (searchWrap) {
    searchWrap.style.display = clients.length > 4 ? "block" : "none";
  }
  if (toggleBtn) {
    toggleBtn.style.display = "inline-block";
    toggleBtn.textContent = "Tout cocher";
  }

  listEl.innerHTML = clients.map(c => {
    const pCount = (c.parcels || []).length;
    const pCountText = pCount === 0 ? "0 parcelle" : (pCount === 1 ? "1 parcelle" : `${pCount} parcelles`);
    return `
      <label class="parcel-checkbox-item planned-client-item" data-client-id="${c.id}" data-client-name="${escapeHTML(c.name.toLowerCase())}" data-commune="${escapeHTML((c.commune || '').toLowerCase())}">
        <input type="checkbox" class="planned-client-cb" value="${c.id}" id="cb-pln-cli-${c.id}">
        <div class="parcel-item-info">
          <div class="parcel-item-text">
            <span class="parcel-item-name">🏰 ${escapeHTML(c.name)}</span>
            ${c.commune ? `<span class="parcel-item-sub">📍 ${escapeHTML(c.commune)}</span>` : ''}
          </div>
          <span class="parcel-item-surface-badge">${pCountText}</span>
        </div>
      </label>
    `;
  }).join("");

  const clientCbs = listEl.querySelectorAll(".planned-client-cb");
  clientCbs.forEach(cb => {
    cb.addEventListener("change", () => {
      const item = cb.closest(".planned-client-item");
      if (item) {
        if (cb.checked) item.classList.add("selected");
        else item.classList.remove("selected");
      }
      onPlannedClientsChanged(cb.value, cb.checked);
    });
  });
}

function onPlannedClientsChanged(changedClientId = null, isChecked = false) {
  const allClientCbs = Array.from(document.querySelectorAll("#planned-client-checkbox-list .planned-client-cb"));
  const checkedClientCbs = allClientCbs.filter(cb => cb.checked);
  const checkedClientIds = checkedClientCbs.map(cb => cb.value);

  const clientTriggerText = document.getElementById("planned-client-trigger-text");
  const clientTriggerBadge = document.getElementById("planned-client-trigger-badge");
  const parcelTrigger = document.getElementById("btn-planned-parcel-trigger");
  const parcelTriggerText = document.getElementById("planned-parcel-trigger-text");

  const count = checkedClientIds.length;
  if (clientTriggerText) {
    if (count === 0) {
      clientTriggerText.textContent = "Sélectionner les domaines...";
    } else if (count === 1) {
      const c = clients.find(item => item.id === checkedClientIds[0]);
      clientTriggerText.textContent = c ? c.name : "1 domaine sélectionné";
    } else if (count === 2) {
      const c1 = clients.find(item => item.id === checkedClientIds[0]);
      const c2 = clients.find(item => item.id === checkedClientIds[1]);
      clientTriggerText.textContent = `${c1 ? c1.name : ''}, ${c2 ? c2.name : ''}`;
    } else {
      clientTriggerText.textContent = `${count} domaines sélectionnés`;
    }
  }

  if (clientTriggerBadge) {
    if (count > 0) {
      clientTriggerBadge.textContent = count;
      clientTriggerBadge.style.display = "inline-block";
    } else {
      clientTriggerBadge.style.display = "none";
    }
  }

  // Enable/disable parcel dropdown trigger
  if (parcelTrigger) {
    if (count === 0) {
      parcelTrigger.disabled = true;
      if (parcelTriggerText) parcelTriggerText.textContent = "Sélectionnez d'abord un domaine...";
      closePlannedParcelDropdown();
    } else {
      parcelTrigger.disabled = false;
    }
  }

  const toggleBtn = document.getElementById("btn-toggle-all-planned-clients");
  if (toggleBtn) {
    const allChecked = allClientCbs.length > 0 && checkedClientCbs.length === allClientCbs.length;
    toggleBtn.textContent = allChecked ? "Tout décocher" : "Tout cocher";
  }

  updatePlannedParcelsList(changedClientId, isChecked);
}

function updatePlannedParcelsList(changedClientId = null, isClientChecked = false) {
  const parcelListEl = document.getElementById("planned-parcel-checkbox-list");
  const toggleAllParcelsBtn = document.getElementById("btn-toggle-all-planned-parcels");

  if (!parcelListEl) return;

  const checkedClientCbs = Array.from(document.querySelectorAll("#planned-client-checkbox-list .planned-client-cb:checked"));
  const checkedClientIds = checkedClientCbs.map(cb => cb.value);

  if (checkedClientIds.length === 0) {
    parcelListEl.innerHTML = '<div class="parcel-list-empty">Sélectionnez d\'abord au moins un client pour afficher ses parcelles.</div>';
    if (toggleAllParcelsBtn) toggleAllParcelsBtn.style.display = "none";
    updatePlannedParcelsSummary();
    return;
  }

  if (toggleAllParcelsBtn) toggleAllParcelsBtn.style.display = "inline-block";

  // Remember which parcels were previously checked
  const previouslyCheckedKeys = new Set();
  const currentParcelCbs = parcelListEl.querySelectorAll(".planned-parcel-cb:checked");
  currentParcelCbs.forEach(cb => {
    previouslyCheckedKeys.add(`${cb.dataset.clientId}:::${cb.value}`);
  });

  const isMultiClients = checkedClientIds.length > 1;
  let html = "";

  checkedClientIds.forEach(cId => {
    const client = clients.find(c => c.id === cId);
    if (!client) return;

    if (isMultiClients) {
      html += `
        <div class="planned-parcel-domain-header" data-domain-id="${client.id}">
          <span>🏰 ${escapeHTML(client.name)}</span>
          <button type="button" class="btn-group-toggle-domain-parcels" data-client-id="${client.id}">Tout cocher</button>
        </div>
      `;
    }

    if (client.parcels && client.parcels.length > 0) {
      client.parcels.forEach(p => {
        const key = `${client.id}:::${p.name}`;
        const shouldBeChecked = (changedClientId === client.id && isClientChecked)
          ? true
          : (previouslyCheckedKeys.has(key) || changedClientId === null);

        html += `
          <label class="parcel-checkbox-item planned-parcel-item ${shouldBeChecked ? 'selected' : ''}" data-client-id="${client.id}">
            <input type="checkbox" class="planned-parcel-cb" 
                   data-client-id="${client.id}" 
                   data-surface="${p.surface || 0}" 
                   value="${escapeHTML(p.name)}" 
                   ${shouldBeChecked ? 'checked' : ''}>
            <div class="parcel-item-info">
              <div class="parcel-item-text">
                <span class="parcel-item-name">📍 ${escapeHTML(p.name)}</span>
                ${p.grape ? `<span class="parcel-item-sub">🍇 ${escapeHTML(p.grape)}</span>` : ''}
              </div>
              <span class="parcel-item-surface-badge">${formatSurface(p.surface)} ha</span>
            </div>
          </label>
        `;
      });
    } else {
      const key = `${client.id}:::Toutes parcelles`;
      const shouldBeChecked = (changedClientId === client.id && isClientChecked)
        ? true
        : (previouslyCheckedKeys.has(key) || changedClientId === null);

      html += `
        <label class="parcel-checkbox-item planned-parcel-item ${shouldBeChecked ? 'selected' : ''}" data-client-id="${client.id}">
          <input type="checkbox" class="planned-parcel-cb fallback-domain-cb" 
                 data-client-id="${client.id}" 
                 data-surface="0" 
                 value="Toutes parcelles" 
                 ${shouldBeChecked ? 'checked' : ''}>
          <div class="parcel-item-info">
            <div class="parcel-item-text">
              <span class="parcel-item-name">📍 Tout le domaine</span>
              <span class="parcel-item-sub">Toutes parcelles / Général</span>
            </div>
            <span class="parcel-item-surface-badge">Ensemble</span>
          </div>
        </label>
      `;
    }
  });

  parcelListEl.innerHTML = html;

  const parcelCbs = parcelListEl.querySelectorAll(".planned-parcel-cb");
  parcelCbs.forEach(cb => {
    cb.addEventListener("change", () => {
      const item = cb.closest(".planned-parcel-item");
      if (item) {
        if (cb.checked) item.classList.add("selected");
        else item.classList.remove("selected");
      }
      updatePlannedParcelsSummary();
    });
  });

  const domainToggleBtns = parcelListEl.querySelectorAll(".btn-group-toggle-domain-parcels");
  domainToggleBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const domainId = btn.dataset.clientId;
      const domainCbs = Array.from(parcelListEl.querySelectorAll(`.planned-parcel-cb[data-client-id="${domainId}"]`));
      const allChecked = domainCbs.length > 0 && domainCbs.every(cb => cb.checked);
      domainCbs.forEach(cb => {
        cb.checked = !allChecked;
        const item = cb.closest(".planned-parcel-item");
        if (item) {
          if (!allChecked) item.classList.add("selected");
          else item.classList.remove("selected");
        }
      });
      btn.textContent = allChecked ? "Tout cocher" : "Tout décocher";
      updatePlannedParcelsSummary();
    });
  });

  updatePlannedParcelsSummary();
}

function updatePlannedParcelsSummary() {
  const parcelListEl = document.getElementById("planned-parcel-checkbox-list");
  const toggleAllBtn = document.getElementById("btn-toggle-all-planned-parcels");
  const qtyInput = document.getElementById("input-planned-quantity");
  const parcelTriggerText = document.getElementById("planned-parcel-trigger-text");
  const parcelTriggerBadge = document.getElementById("planned-parcel-trigger-badge");
  const recapBar = document.getElementById("planned-selection-recap-bar");
  const recapClients = document.getElementById("recap-clients-count");
  const recapParcels = document.getElementById("recap-parcels-count");
  const recapSurface = document.getElementById("recap-surface-total");

  if (!parcelListEl) return;

  const allParcelCbs = Array.from(parcelListEl.querySelectorAll(".planned-parcel-cb"));
  const checkedParcelCbs = Array.from(parcelListEl.querySelectorAll(".planned-parcel-cb:checked"));

  let totalSurface = 0;
  checkedParcelCbs.forEach(cb => {
    const s = parseFloat(cb.dataset.surface || 0);
    if (!isNaN(s)) totalSurface += s;
  });

  const count = checkedParcelCbs.length;
  const checkedClientsCount = document.querySelectorAll("#planned-client-checkbox-list .planned-client-cb:checked").length;

  if (toggleAllBtn) {
    toggleAllBtn.style.display = allParcelCbs.length > 0 ? "inline-block" : "none";
    toggleAllBtn.textContent = (checkedParcelCbs.length === allParcelCbs.length && allParcelCbs.length > 0)
      ? "Tout décocher"
      : "Tout cocher";
  }

  // Update parcel trigger text and badge
  if (parcelTriggerText) {
    if (checkedClientsCount === 0) {
      parcelTriggerText.textContent = "Sélectionnez d'abord un domaine...";
    } else if (count === 0) {
      parcelTriggerText.textContent = "Sélectionner les parcelles...";
    } else if (count === 1) {
      parcelTriggerText.textContent = `${checkedParcelCbs[0].value} (${formatSurface(totalSurface)} ha)`;
    } else {
      parcelTriggerText.textContent = `${count} parcelles (${formatSurface(totalSurface)} ha)`;
    }
  }

  if (parcelTriggerBadge) {
    if (count > 0) {
      parcelTriggerBadge.textContent = count;
      parcelTriggerBadge.style.display = "inline-block";
    } else {
      parcelTriggerBadge.style.display = "none";
    }
  }

  // Update recap bar
  if (recapBar) {
    if (checkedClientsCount > 0 && count > 0) {
      recapBar.style.display = "flex";
      if (recapClients) recapClients.textContent = `🏰 ${checkedClientsCount} domaine${checkedClientsCount > 1 ? 's' : ''}`;
      if (recapParcels) recapParcels.textContent = `📍 ${count} parcelle${count > 1 ? 's' : ''}`;
      if (recapSurface) recapSurface.textContent = `📐 ${formatSurface(totalSurface)} ha cumulés`;
    } else {
      recapBar.style.display = "none";
    }
  }

  if (qtyInput && totalSurface > 0 && (!qtyInput.value || qtyInput.dataset.autoFilled === "true")) {
    qtyInput.value = formatSurface(totalSurface);
    qtyInput.dataset.autoFilled = "true";
  }
}

function openPlannedModal(prefillDate = null) {
  const modal = document.getElementById("planned-modal");
  const form = document.getElementById("create-planned-form");
  const dateInput = document.getElementById("input-planned-date");
  const searchInput = document.getElementById("search-planned-clients");
  const qtyInput = document.getElementById("input-planned-quantity");

  closePlannedClientDropdown();
  closePlannedParcelDropdown();

  if (form) form.reset();
  if (searchInput) searchInput.value = "";
  if (qtyInput) qtyInput.dataset.autoFilled = "false";

  renderPlannedClientsList();
  updatePlannedParcelsList(null, false);

  populateTaskSelects();
  populatePlannedWorkerSelect();

  if (dateInput) {
    const today = new Date().toISOString().split("T")[0];
    dateInput.value = prefillDate || today;
  }

  if (modal) {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    lockBodyScroll();
    const modalBody = modal.querySelector(".modal-body");
    if (modalBody) modalBody.scrollTop = 0;
  }
}

function closePlannedModal() {
  closePlannedClientDropdown();
  closePlannedParcelDropdown();
  const modal = document.getElementById("planned-modal");
  if (modal) {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    unlockBodyScroll();
  }
}

function handleCreatePlannedSubmit(e) {
  e.preventDefault();

  const selectedClientCbs = Array.from(document.querySelectorAll("#planned-client-checkbox-list .planned-client-cb:checked"));
  const selectedClientIds = selectedClientCbs.map(cb => cb.value);

  if (selectedClientIds.length === 0) {
    showToast("Veuillez sélectionner au moins un domaine / client.", "warning");
    return;
  }

  const checkedParcelCbs = Array.from(document.querySelectorAll("#planned-parcel-checkbox-list .planned-parcel-cb:checked"));
  if (checkedParcelCbs.length === 0) {
    showToast("Veuillez sélectionner au moins une parcelle viticole.", "warning");
    return;
  }

  const service = document.getElementById("input-planned-service")?.value;
  const date = document.getElementById("input-planned-date")?.value;
  const worker = document.getElementById("input-planned-worker")?.value || "Non assigné";
  const userQuantity = parseFloat(document.getElementById("input-planned-quantity")?.value || 0);
  const notes = document.getElementById("input-planned-notes")?.value || "";

  if (!service || !date) {
    showToast("Veuillez renseigner la prestation et la date prévue.", "warning");
    return;
  }

  // Regrouper les parcelles cochées par client
  const clientParcelMap = {};
  checkedParcelCbs.forEach(cb => {
    const cId = cb.dataset.clientId;
    const pName = cb.value;
    const pSurface = parseFloat(cb.dataset.surface || 0);
    if (!clientParcelMap[cId]) {
      clientParcelMap[cId] = { names: [], surface: 0 };
    }
    clientParcelMap[cId].names.push(pName);
    clientParcelMap[cId].surface += isNaN(pSurface) ? 0 : pSurface;
  });

  const clientEntries = Object.entries(clientParcelMap);
  if (clientEntries.length === 0) {
    showToast("Veuillez sélectionner au moins une parcelle pour un client sélectionné.", "warning");
    return;
  }

  const createdWorks = [];

  clientEntries.forEach(([cId, pData]) => {
    const client = clients.find(c => c.id === cId);
    const clientName = client ? client.name : "Client Inconnu";
    const parcelText = pData.names.join(", ");

    let workQuantity = 0;
    if (clientEntries.length === 1) {
      workQuantity = userQuantity > 0 ? userQuantity : (pData.surface > 0 ? parseFloat(pData.surface.toFixed(4)) : 0);
    } else {
      // Pour multi-clients : si la surface de ce client est définie, on l'utilise, sinon quantité globale
      workQuantity = pData.surface > 0 ? parseFloat(pData.surface.toFixed(4)) : userQuantity;
    }

    const newPlanned = {
      id: generateUniqueId("PLN"),
      clientId: cId,
      clientName,
      parcel: parcelText,
      service,
      date,
      worker,
      quantity: workQuantity,
      notes
    };

    plannedWorks.unshift(newPlanned);
    createdWorks.push(newPlanned);
  });

  savePlannedWorks();
  closePlannedModal();
  renderServicesView();

  if (createdWorks.length === 1) {
    showToast(`Travail à faire « ${service} » planifié pour ${createdWorks[0].clientName} (${createdWorks[0].parcel}) !`, "success");
  } else {
    showToast(`${createdWorks.length} travaux « ${service} » planifiés pour ${createdWorks.length} domaines viticoles !`, "success");
  }
}

window.deletePlannedWork = function(id) {
  if (confirm("Supprimer ce travail planifié ?")) {
    plannedWorks = plannedWorks.filter(w => w.id !== id);
    savePlannedWorksLocally();
    deletePlannedWorkFromSupabase(id);
    renderServicesView();
    showToast("Travail planifié supprimé.", "info");
  }
};

window.convertPlannedWork = function(id) {
  const planned = plannedWorks.find(w => w.id === id);
  if (!planned) return;

  // Open intervention modal and pre-fill
  openCreateModal();
  convertingPlannedWorkId = id;

  const clientSelect = document.getElementById("input-client");
  const dateInput = document.getElementById("input-datetime");
  const taskSelect = document.getElementById("input-task");
  const workerSelect = document.getElementById("input-worker");
  const quantityInput = document.getElementById("input-quantity");
  const notesInput = document.getElementById("input-notes");

  if (clientSelect) {
    clientSelect.value = planned.clientId;
    populateParcelSelectForClient(planned.clientId);
    const parcelContainer = document.getElementById("parcel-checkbox-list");
    if (parcelContainer && planned.parcel) {
      const plannedNames = planned.parcel.split(",").map(s => s.trim().toLowerCase());
      const cbs = Array.from(parcelContainer.querySelectorAll(".parcel-checkbox-input"));
      let found = false;
      cbs.forEach(cb => {
        const valLower = cb.value.trim().toLowerCase();
        if (plannedNames.includes(valLower) || planned.parcel.toLowerCase().includes(valLower)) {
          cb.checked = true;
          cb.closest(".parcel-checkbox-item")?.classList.add("selected");
          found = true;
        } else {
          cb.checked = false;
          cb.closest(".parcel-checkbox-item")?.classList.remove("selected");
        }
      });
      const client = clients.find(c => c.id === planned.clientId);
      if (found && client) updateParcelSelectionSummary(client);
    }
  }

  if (dateInput) {
    dateInput.value = `${planned.date}T08:00`;
  }

  if (taskSelect) {
    taskSelect.value = planned.service;
    taskSelect.dispatchEvent(new Event("change"));
  }

  if (workerSelect && planned.worker && planned.worker !== "Non assigné") {
    workerSelect.value = planned.worker;
  }

  if (quantityInput && planned.quantity > 0) {
    quantityInput.value = planned.quantity;
    updateCalculatedPrice();
  }

  if (notesInput) {
    notesInput.value = planned.notes ? `[Planifié] ${planned.notes}` : "";
  }

  // Le travail planifié n'est supprimé QUE lors de l'enregistrement effectif de l'intervention.
  // En cas de clic sur "Annuler", la planification reste intacte dans la liste !
  showToast(`Formulaire d'intervention prérempli pour ${planned.clientName}. Ajustez les données et cliquez sur « Enregistrer » pour valider.`, "info");
};

// ==================== HELPERS ====================
function formatSurface(val) {
  const num = parseFloat(val);
  if (isNaN(num)) return "0.0000";
  return num.toFixed(4);
}

function formatDateDisplay(isoString) {
  if (!isoString) return { date: "--/--/----", time: "--:--" };
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) {
      return { date: isoString.split("T")[0], time: isoString.split("T")[1] || "" };
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return {
      date: `${day}/${month}/${year}`,
      time: `${hours}h${minutes}`
    };
  } catch (e) {
    return { date: isoString, time: "" };
  }
}

function formatDateFr(isoString) {
  return formatDateDisplay(isoString).date;
}

function formatTime(isoString) {
  return formatDateDisplay(isoString).time;
}

function formatCurrency(val) {
  const num = parseFloat(val) || 0;
  return `${num.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function formatVolumeUnit(volume, rateType) {
  const vol = parseFloat(volume) || 0;
  const unit = rateType || 'ha';
  if (unit === 'ha') return `${formatSurface(vol)} ha`;
  if (unit === 'kg') return `${vol.toLocaleString('fr-FR')} kg`;
  if (unit === 'h') return `${vol.toFixed(1)} h`;
  return `${vol} ${unit}`;
}

function escapeHTML(str) {
  if (!str) return "";
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(20px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => {
      if (toast.parentElement) toast.parentElement.removeChild(toast);
    }, 300);
  }, 3500);
}

// ==================== AUTHENTICATION & SESSION ====================
async function checkAuthUser() {
  let user = null;

  // 1. Priorité absolue : lecture immédiate du cache local pour zéro blocage
  try {
    const raw = localStorage.getItem("vititrack_auth_user");
    if (raw) user = JSON.parse(raw);
  } catch (e) {}

  // Mise à jour immédiate de l'interface utilisateur si l'utilisateur est déjà en cache
  if (user) {
    updateUserInterface(user);
  }

  // 2. Vérification Supabase en arrière-plan avec timeout strict de 1.5s
  if (window.supabaseClient) {
    try {
      const sessionPromise = window.supabaseClient.auth.getSession();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Supabase auth timeout")), 1500)
      );
      const { data } = await Promise.race([sessionPromise, timeoutPromise]);
      const session = data ? data.session : null;

      if (session && session.user) {
        const meta = session.user.user_metadata || {};
        user = {
          id: session.user.id,
          email: session.user.email,
          domainName: meta.domain_name || meta.domain || session.user.email.split("@")[0],
          fullName: meta.full_name || "Exploitant",
          role: meta.role || "Gérant Exploitant",
          loggedInAt: new Date().toISOString()
        };
        localStorage.setItem("vititrack_auth_user", JSON.stringify(user));
        updateUserInterface(user);
      }
    } catch (err) {
      console.warn("Notice vérification session Supabase :", err.message || err);
    }
  }

  // Si aucun utilisateur n'est authentifié (ni local, ni Supabase), redirection login
  if (!user) {
    window.location.href = "login.html";
    return;
  }
}

function updateUserInterface(user) {
  if (!user) return;
  const topbarUserName = document.getElementById("user-topbar-name");
  const sidebarUserName = document.getElementById("sidebar-user-name");
  const sidebarUserRole = document.getElementById("sidebar-user-role");
  const sidebarUserAvatar = document.getElementById("sidebar-user-avatar");

  if (user.isTeamMember) {
    const workerName = user.name || user.fullName || "Collaborateur";
    const workerRole = user.role || "Tractoriste";
    const domainName = user.ownerDomain || "Domaine Viticole";
    const initials = getInitials(workerName);

    if (topbarUserName) {
      topbarUserName.textContent = `${workerName} (${domainName})`;
      topbarUserName.title = `Collaborateur terrain : ${workerName} • Compte gérant : ${domainName}`;
    }
    if (sidebarUserName) {
      sidebarUserName.textContent = workerName;
      sidebarUserName.title = `${workerName} (${user.email || ''})`;
    }
    if (sidebarUserRole) {
      sidebarUserRole.innerHTML = `<span style="color: #60a5fa; font-weight: 600;">🚜 ${escapeHTML(workerRole)}</span><br><span style="font-size: 0.72rem; opacity: 0.85;">${escapeHTML(domainName)}</span>`;
    }
    if (sidebarUserAvatar) {
      sidebarUserAvatar.textContent = initials;
      sidebarUserAvatar.style.background = "#2563eb";
    }
    return;
  }

  const displayName = user.domainName || user.fullName || "Domaine Viticole";
  const displayRole = user.fullName ? `${user.fullName} • ${user.role || 'Exploitant'}` : (user.role || 'Gérant Exploitant');
  const initials = (user.domainName || user.fullName || 'VT')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');

  if (topbarUserName) {
    topbarUserName.textContent = displayName;
    topbarUserName.title = `${user.fullName || ''} (${user.email || ''})`;
  }
  if (sidebarUserName) {
    sidebarUserName.textContent = displayName;
    sidebarUserName.title = `${user.fullName || ''} (${user.email || ''})`;
  }
  if (sidebarUserRole) {
    sidebarUserRole.textContent = displayRole;
  }
  if (sidebarUserAvatar) {
    sidebarUserAvatar.textContent = initials || "VT";
  }
}

async function handleLogout() {
  if (confirm("Voulez-vous vous déconnecter de votre espace viticole ?")) {
    try {
      if (window.supabaseClient) {
        await window.supabaseClient.auth.signOut();
      }
    } catch (e) {
      console.warn("Erreur déconnexion Supabase :", e);
    }
    try {
      localStorage.removeItem("vititrack_auth_user");
    } catch (e) {}
    window.location.href = "login.html";
  }
}

// ==================== THEME MANAGEMENT (JOUR / NUIT) ====================
function getStoredTheme() {
  try {
    const saved = localStorage.getItem("vititrack_theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch (e) {}
  return "dark"; // Default: Dark theme (Executive Viti-Dark 100% untouched)
}

function applyTheme(theme, save = true) {
  const currentTheme = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", currentTheme);
  if (document.body) {
    document.body.setAttribute("data-theme", currentTheme);
  }

  if (save) {
    try {
      localStorage.setItem("vititrack_theme", currentTheme);
    } catch (e) {}
  }

  // 1. Topbar switch segments
  const segDark = document.getElementById("seg-dark");
  const segLight = document.getElementById("seg-light");
  if (segDark && segLight) {
    if (currentTheme === "light") {
      segLight.classList.add("active");
      segDark.classList.remove("active");
    } else {
      segDark.classList.add("active");
      segLight.classList.remove("active");
    }
  }
}

let _jsToggleTime = 0;
function toggleTheme() {
  const now = Date.now();
  if (now - _jsToggleTime < 250) return;
  _jsToggleTime = now;
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const target = current === "light" ? "dark" : "light";
  applyTheme(target, true);
}

function initTheme() {
  const theme = getStoredTheme();
  applyTheme(theme, false);

  // Topbar switch button
  const topbarBtn = document.getElementById("theme-toggle-btn");
  if (topbarBtn && !topbarBtn.dataset.bound) {
    topbarBtn.dataset.bound = "true";
    topbarBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleTheme();
    });
  }
}

window.applyTheme = applyTheme;
window.toggleTheme = toggleTheme;
window.initTheme = initTheme;

// Fonctions globales de navigation et de modales pour garantir un fonctionnement infaillible
window.switchView = switchView;
window.openClientModal = openClientModal;
window.closeClientModal = closeClientModal;
window.openCreateModal = openCreateModal;
window.openEditInterventionModal = openEditInterventionModal;
window.closeCreateModal = closeCreateModal;
window.openServiceModal = openServiceModal;
window.closeServiceModal = closeServiceModal;
window.openPlannedModal = openPlannedModal;
window.closePlannedModal = closePlannedModal;
window.openParcelModal = openParcelModal;
window.closeParcelModal = closeParcelModal;
window.openDetailModal = openDetailModal;
window.closeDetailModal = closeDetailModal;
window.toggleSidebar = function() {
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  if (sidebar) sidebar.classList.toggle("open");
  if (backdrop) backdrop.classList.toggle("active");
};
window.closeSidebar = function() {
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  if (sidebar) sidebar.classList.remove("open");
  if (backdrop) backdrop.classList.remove("active");
};

// ==================== MON ABONNEMENT STRIPE ====================
let currentSubscription = null;

async function loadUserSubscription() {
  if (window.VitiTrackStripe && typeof window.VitiTrackStripe.getSubscription === "function") {
    currentSubscription = await window.VitiTrackStripe.getSubscription();
    updateSubscriptionUI(currentSubscription);
  }
}

function updateSubscriptionUI(sub) {
  const planBadge = document.getElementById("sidebar-plan-badge");
  const nameEl = document.getElementById("sub-current-name");
  const priceEl = document.getElementById("sub-current-price");
  const pillEl = document.getElementById("sub-status-pill");
  const labelEl = document.getElementById("sub-status-label");
  const dateEl = document.getElementById("sub-current-date");
  const custEl = document.getElementById("sub-customer-id");

  if (!sub || sub.status === "incomplete" || sub.status === "canceled") {
    if (planBadge) {
      planBadge.textContent = "Essai";
      planBadge.className = "nav-badge badge-warning";
    }
    if (nameEl) nameEl.textContent = "Période d'évaluation / Essai";
    if (priceEl) priceEl.innerHTML = "0,00 € HT <span class=\"sub-period\">/ 14 jours</span>";
    if (pillEl) pillEl.className = "sub-status-pill warning";
    if (labelEl) labelEl.textContent = sub?.status === "canceled" ? "Abonnement Résilié" : "Essai Gratuit";
    if (dateEl) dateEl.textContent = "Souscription requise pour continuer";
    if (custEl) custEl.textContent = sub?.stripe_customer_id || "En attente";
    return;
  }

  const planTitles = {
    basic: { name: "Formule Basic (jusqu'à 5 clients, 10 parcelles)", price: "29,00 € HT" },
    pro: { name: "Formule Professionnel (5 à 15 clients, 10 à 20 parcelles)", price: "49,00 € HT" },
    enterprise: { name: "Formule Entreprise (Clients & Parcelles illimités)", price: "99,00 € HT" }
  };
  const planInfo = planTitles[sub.plan_id] || { name: sub.plan_name || "Formule Active", price: `${sub.plan_price_ht || 49},00 € HT` };

  if (planBadge) {
    planBadge.textContent = sub.plan_id === "basic" ? "Basic" : (sub.plan_id === "enterprise" ? "Entreprise" : "Pro");
    planBadge.className = "nav-badge badge-success";
  }
  if (nameEl) nameEl.textContent = planInfo.name;
  if (priceEl) priceEl.innerHTML = `${planInfo.price} <span class="sub-period">/ mois</span>`;
  if (pillEl) pillEl.className = "sub-status-pill";
  if (labelEl) labelEl.textContent = "Abonnement Actif ✅";
  if (dateEl) {
    dateEl.textContent = sub.current_period_end ? formatDateTime(sub.current_period_end).date : "Renouvellement mensuel";
  }
  if (custEl) custEl.textContent = sub.stripe_customer_id || "Actif";
}

function openSubscriptionModal() {
  const modal = document.getElementById("subscription-modal");
  if (modal) {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    lockBodyScroll();
    const modalBody = modal.querySelector(".modal-body");
    if (modalBody) modalBody.scrollTop = 0;
  }
  loadUserSubscription();
}

function closeSubscriptionModal() {
  const modal = document.getElementById("subscription-modal");
  if (modal) {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    unlockBodyScroll();
  }
}

window.openSubscriptionModal = openSubscriptionModal;
window.closeSubscriptionModal = closeSubscriptionModal;
window.updateSubscriptionUI = updateSubscriptionUI;
window.loadUserSubscription = loadUserSubscription;

// ================================================================
// GESTION DE L'ÉQUIPE ET DES UTILISATEURS DU DOMAINE
// ================================================================

function getDemoTeamUsers() {
  return [
    {
      id: "usr-01",
      name: "Alexis Ludinard",
      role: "Gérant Exploitant",
      roleCategory: "gerant",
      email: "exploitant@domaineludinard.fr",
      phone: "06 12 34 56 78",
      password: "viti",
      status: "Actif",
      color: "#2d6a4f",
      certifications: "Certiphyto Décideur, Direction d'exploitation",
      notes: "Gérant principal du domaine viticole et de la société de travaux."
    },
    {
      id: "usr-02",
      name: "Thomas Mercier",
      role: "Chef de culture / Tractoriste",
      roleCategory: "tractoriste",
      email: "thomas@domaineludinard.fr",
      phone: "06 23 45 67 89",
      password: "viti2026",
      status: "Actif",
      color: "#2563eb",
      certifications: "CACES R482, Certiphyto Opérateur, Taille Cordon",
      notes: "Responsable des chantiers mécaniques et traitements phytosanitaires."
    },
    {
      id: "usr-03",
      name: "Sophie Laurent",
      role: "Ouvrière viticole qualifiée",
      roleCategory: "ouvrier",
      email: "sophie@domaineludinard.fr",
      phone: "06 34 56 78 90",
      password: "viti2026",
      status: "Actif",
      color: "#9333ea",
      certifications: "Taille Guyot & Poussard, Palissage & Épamprage",
      notes: "Spécialiste travaux en vert, ébourgeonnage soigné et vendanges."
    },
    {
      id: "usr-04",
      name: "Julien Beraud",
      role: "Tractoriste / Chauffeur d'engins",
      roleCategory: "tractoriste",
      email: "julien@domaineludinard.fr",
      phone: "06 45 67 89 01",
      password: "viti2026",
      status: "Actif",
      color: "#d97706",
      certifications: "CACES Tracteur, Travail du sol & Broyage",
      notes: "Conduite des tracteurs interlignes, charrues et labour mécanique."
    }
  ];
}

function getFreshTeamUsers(user) {
  const name = (user && (user.full_name || user.name || user.domainName)) || "Gérant Exploitant";
  const email = (user && user.email) || "";
  return [
    {
      id: "usr-gerant-01",
      name: name,
      role: "Gérant Exploitant",
      roleCategory: "gerant",
      email: email,
      phone: "",
      password: "",
      status: "Actif",
      color: "#2d6a4f",
      certifications: "Direction d'exploitation",
      notes: "Administrateur principal du compte."
    }
  ];
}

function getInitials(name) {
  if (!name) return "VT";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getRoleCategory(role) {
  if (!role) return "autre";
  const str = role.toLowerCase();
  if (str.includes("gérant") || str.includes("directeur") || str.includes("associé")) return "gerant";
  if (str.includes("chef") || str.includes("responsable")) return "chef";
  if (str.includes("tractoriste") || str.includes("engin") || str.includes("chauffeur")) return "tractoriste";
  if (str.includes("saisonnier") || str.includes("vendangeur")) return "saisonnier";
  if (str.includes("ouvrier") || str.includes("opérateur") || str.includes("tailleur")) return "ouvrier";
  return "autre";
}

function getRoleBadgeClass(category) {
  switch (category) {
    case "gerant": return "role-gerant";
    case "chef": return "role-chef";
    case "tractoriste": return "role-tractoriste";
    case "ouvrier": return "role-ouvrier";
    case "saisonnier": return "role-saisonnier";
    default: return "role-autre";
  }
}

function getStatusBadgeClass(status) {
  switch (status) {
    case "Actif": return "status-actif";
    case "En mission": return "status-mission";
    case "En congé / Absence": return "status-conge";
    default: return "status-inactif";
  }
}

function openTeamModal() {
  const modal = document.getElementById("team-modal");
  if (modal) {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    lockBodyScroll();
    const modalBody = modal.querySelector(".modal-body");
    if (modalBody) modalBody.scrollTop = 0;
  }
  renderTeamList();
}

function closeTeamModal() {
  const modal = document.getElementById("team-modal");
  if (modal) {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    unlockBodyScroll();
  }
}

function renderTeamList() {
  const container = document.getElementById("team-members-grid");
  const emptyState = document.getElementById("team-empty-state");
  if (!container) return;

  const total = Array.isArray(teamUsers) ? teamUsers.length : 0;
  const gerants = (teamUsers || []).filter(u => u.roleCategory === "gerant" || (u.role && u.role.toLowerCase().includes("gérant"))).length;
  const operators = total - gerants;
  const active = (teamUsers || []).filter(u => u.status === "Actif").length;

  setElemText("team-stat-total", total);
  setElemText("team-stat-gerants", gerants);
  setElemText("team-stat-operators", operators);
  setElemText("team-stat-active", active);

  // Filtrage
  const filtered = (teamUsers || []).filter(user => {
    if (teamRoleFilter !== "all" && user.roleCategory !== teamRoleFilter) {
      return false;
    }
    if (teamSearchFilter) {
      const q = teamSearchFilter.toLowerCase();
      const matchName = (user.name || "").toLowerCase().includes(q);
      const matchRole = (user.role || "").toLowerCase().includes(q);
      const matchCertifs = (user.certifications || "").toLowerCase().includes(q);
      const matchNotes = (user.notes || "").toLowerCase().includes(q);
      if (!matchName && !matchRole && !matchCertifs && !matchNotes) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = "";
    if (emptyState) emptyState.style.display = "block";
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  container.innerHTML = filtered.map(user => {
    const initials = getInitials(user.name);
    const roleCat = user.roleCategory || getRoleCategory(user.role);
    const roleBadgeClass = getRoleBadgeClass(roleCat);
    const statusClass = getStatusBadgeClass(user.status || "Actif");
    const avatarColor = user.color || "#2d6a4f";

    return `
      <div class="team-member-card" id="team-card-${escapeHTML(user.id)}">
        <div class="team-member-header">
          <div class="team-member-avatar" style="background: ${avatarColor};">
            ${escapeHTML(initials)}
          </div>
          <div class="team-member-title-box">
            <div class="team-member-name">
              <span>${escapeHTML(user.name)}</span>
              ${roleCat === 'gerant' ? '<span title="Gérant Exploitant">👑</span>' : ''}
            </div>
            <div class="team-member-role-row">
              <span class="team-role-pill ${roleBadgeClass}">
                <span class="team-status-dot ${statusClass}"></span>
                ${escapeHTML(user.role)}
              </span>
              <span style="font-size: 0.72rem; color: var(--color-text-secondary);">${escapeHTML(user.status || 'Actif')}</span>
            </div>
          </div>
        </div>

        <div class="team-member-contact">
          ${user.email ? `
            <div class="team-contact-line">
              <span>✉️</span>
              <a href="mailto:${escapeHTML(user.email)}" class="team-contact-link">${escapeHTML(user.email)}</a>
            </div>
          ` : ''}
          ${user.phone ? `
            <div class="team-contact-line">
              <span>📞</span>
              <a href="tel:${escapeHTML(user.phone)}" class="team-contact-link">${escapeHTML(user.phone)}</a>
            </div>
          ` : ''}
          ${user.password ? `
            <div class="team-contact-line" style="background: rgba(82, 183, 136, 0.12); border: 1px solid rgba(82, 183, 136, 0.25); border-radius: var(--radius-sm); padding: 3px 7px; font-size: 0.74rem; display: inline-flex; align-items: center; gap: 0.35rem; color: #a7f3d0; margin-top: 0.2rem;">
              <span>🔑 Mot de passe :</span>
              <strong style="letter-spacing: 0.5px;">${escapeHTML(user.password)}</strong>
            </div>
          ` : ''}
          ${(!user.email && !user.phone) ? `
            <div class="team-contact-line" style="font-style: italic; opacity: 0.6;">
              Coordonnées non renseignées
            </div>
          ` : ''}
        </div>

        ${user.certifications ? `
          <div class="team-member-certifs" title="Habilitations & Spécialités">
            📜 <strong>Compétences :</strong> ${escapeHTML(user.certifications)}
          </div>
        ` : ''}

        ${user.notes ? `
          <div style="font-size: 0.76rem; color: var(--color-text-secondary); line-height: 1.35; font-style: italic;">
            ${escapeHTML(user.notes)}
          </div>
        ` : ''}

        <div class="team-member-actions" style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.6rem;">
          ${user.email ? `
            <button type="button" class="btn btn-outline btn-xs" onclick="copyMemberAccess('${escapeHTML(user.id)}')" title="Copier les identifiants pour lui envoyer par SMS ou WhatsApp" style="border-color: rgba(82, 183, 136, 0.4); color: #52b788;">
              📲 Accès terrain
            </button>
          ` : ''}
          <button type="button" class="btn btn-outline btn-xs" onclick="openEditTeamMemberModal('${escapeHTML(user.id)}')" title="Modifier cet utilisateur">
            ✏️ Modifier
          </button>
          <button type="button" class="btn btn-ghost btn-xs text-danger" onclick="deleteTeamMember('${escapeHTML(user.id)}')" title="Retirer de l'équipe">
            🗑️ Retirer
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function handleTeamSearch(query) {
  teamSearchFilter = (query || "").trim().toLowerCase();
  renderTeamList();
}

function handleTeamRoleFilter(roleCategory) {
  teamRoleFilter = roleCategory || "all";
  renderTeamList();
}

function generateMemberPin() {
  const pin = Math.floor(100000 + Math.random() * 900000).toString();
  const pwdInput = document.getElementById("input-member-password");
  if (pwdInput) {
    pwdInput.value = pin;
    pwdInput.focus();
    showToast(`⚡ Code PIN généré : ${pin}`, "info");
  }
}

function copyMemberAccess(userId) {
  const user = (teamUsers || []).find(u => u.id === userId);
  if (!user) return;
  const authUser = getAuthUser();
  const domainName = (authUser && (authUser.domainName || authUser.name)) || "Domaine Viticole";
  const loginUrl = window.location.origin ? (window.location.origin + window.location.pathname.replace("dashboard.html", "login.html")) : "https://vititrack.pro/login.html";

  const message = `🍷 VitiTrack Pro — Vos accès terrain
Exploitation : ${domainName}
Collaborateur : ${user.name} (${user.role})
Identifiant (E-mail) : ${user.email || 'Non renseigné'}
Mot de passe / PIN : ${user.password || 'viti2026'}
Connexion directe : ${loginUrl}

Connectez-vous depuis votre smartphone pour saisir vos chantiers et interventions directement dans les parcelles.`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(message).then(() => {
      showToast("📋 Accès copiés ! Vous pouvez les coller par SMS ou WhatsApp.", "success");
    }).catch(() => {
      fallbackCopyAccess(message);
    });
  } else {
    fallbackCopyAccess(message);
  }
}

function fallbackCopyAccess(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
    showToast("📋 Accès copiés dans le presse-papier !", "success");
  } catch (e) {
    prompt("Copiez vos accès :", text);
  }
  document.body.removeChild(textarea);
}

function syncGlobalTeamDirectory() {
  try {
    const authUser = getAuthUser();
    const ownerUserId = (authUser && authUser.isTeamMember && authUser.ownerUserId)
      ? authUser.ownerUserId
      : ((authUser && authUser.id) ? authUser.id : "demo-user-123");

    const ownerDomain = (authUser && authUser.isTeamMember && authUser.ownerDomain)
      ? authUser.ownerDomain
      : ((authUser && (authUser.domainName || authUser.name)) || "Domaine Ludinard & Clair");

    const ownerEmail = (authUser && authUser.isTeamMember && authUser.ownerEmail)
      ? authUser.ownerEmail
      : ((authUser && authUser.email) || "exploitant@domaineludinard.fr");

    let directory = [];
    try {
      directory = JSON.parse(localStorage.getItem("vititrack_global_team_directory") || "[]");
      if (!Array.isArray(directory)) directory = [];
    } catch (e) {
      directory = [];
    }

    // Filtrer les entrées de ce domaine pour les réécrire fraîches
    directory = directory.filter(entry => entry.ownerUserId !== ownerUserId);

    (teamUsers || []).forEach(member => {
      if (member.email) {
        directory.push({
          memberId: member.id,
          name: member.name,
          role: member.role,
          roleCategory: member.roleCategory || getRoleCategory(member.role),
          email: member.email.trim().toLowerCase(),
          password: member.password || "viti2026",
          ownerUserId: ownerUserId,
          ownerDomain: ownerDomain,
          ownerEmail: ownerEmail
        });
      }
    });

    localStorage.setItem("vititrack_global_team_directory", JSON.stringify(directory));
  } catch (err) {
    console.warn("Notice syncGlobalTeamDirectory :", err);
  }
}

// Synchronisation d'un collaborateur vers Supabase Auth (Création de compte Cloud immédiate)
async function syncTeamUserToSupabaseAuth(member) {
  if (!member || !member.email) return;
  const authUser = getAuthUser();
  const ownerUserId = (authUser && authUser.isTeamMember && authUser.ownerUserId)
    ? authUser.ownerUserId
    : ((authUser && authUser.id) ? authUser.id : "c2d45d88-3214-4c93-9361-565d6ac24d1a");

  const ownerDomain = (authUser && authUser.isTeamMember && authUser.ownerDomain)
    ? authUser.ownerDomain
    : ((authUser && (authUser.domainName || authUser.name)) || "SARL Ludinard Clair");

  const ownerEmail = (authUser && authUser.isTeamMember && authUser.ownerEmail)
    ? authUser.ownerEmail
    : ((authUser && authUser.email) || "al.ludinard@gmail.com");

  const memberPassword = (member.password && member.password.trim()) || "viti2026";

  try {
    if (typeof window.upsertConfirmedUser === "function") {
      await window.upsertConfirmedUser(member.email, memberPassword, {
        full_name: member.name,
        role: member.role || "Tractoriste / Chauffeur d'engins",
        role_category: member.roleCategory || getRoleCategory(member.role),
        is_team_member: true,
        owner_user_id: ownerUserId,
        owner_domain: ownerDomain,
        owner_email: ownerEmail,
        status: member.status || "Actif",
        phone: member.phone || "",
        certifications: member.certifications || "",
        notes: member.notes || "",
        member_id: member.id,
        plain_password: memberPassword
      });
      console.log(`🍇 [VitiTrack Pro] Compte Supabase synchronisé pour : ${member.name} (${member.email})`);
    }
  } catch (err) {
    console.warn("⚠️ [VitiTrack Pro] Erreur syncTeamUserToSupabaseAuth :", err);
  }
}

function openAddTeamMemberModal() {
  const form = document.getElementById("team-member-form");
  if (form) form.reset();

  const idInput = document.getElementById("input-member-id");
  if (idInput) idInput.value = "";

  const pwdInput = document.getElementById("input-member-password");
  if (pwdInput) {
    pwdInput.value = Math.floor(100000 + Math.random() * 900000).toString();
  }

  const titleEl = document.getElementById("team-member-modal-title");
  if (titleEl) titleEl.textContent = "Ajouter un utilisateur";

  const btnText = document.getElementById("team-member-modal-submit-text");
  if (btnText) btnText.textContent = "💾 Enregistrer l'utilisateur";

  const modal = document.getElementById("team-member-modal");
  if (modal) {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    lockBodyScroll();
    const modalBody = modal.querySelector(".modal-body");
    if (modalBody) modalBody.scrollTop = 0;
  }
}

function openEditTeamMemberModal(userId) {
  const user = (teamUsers || []).find(u => u.id === userId);
  if (!user) {
    showToast("Utilisateur introuvable.", "error");
    return;
  }

  const idInput = document.getElementById("input-member-id");
  const nameInput = document.getElementById("input-member-name");
  const roleSelect = document.getElementById("input-member-role");
  const statusSelect = document.getElementById("input-member-status");
  const emailInput = document.getElementById("input-member-email");
  const pwdInput = document.getElementById("input-member-password");
  const phoneInput = document.getElementById("input-member-phone");
  const certInput = document.getElementById("input-member-certifications");
  const notesInput = document.getElementById("input-member-notes");

  if (idInput) idInput.value = user.id;
  if (nameInput) nameInput.value = user.name || "";
  if (roleSelect) roleSelect.value = user.role || "Tractoriste / Chauffeur d'engins";
  if (statusSelect) statusSelect.value = user.status || "Actif";
  if (emailInput) emailInput.value = user.email || "";
  if (pwdInput) pwdInput.value = user.password || "viti2026";
  if (phoneInput) phoneInput.value = user.phone || "";
  if (certInput) certInput.value = user.certifications || "";
  if (notesInput) notesInput.value = user.notes || "";

  const titleEl = document.getElementById("team-member-modal-title");
  if (titleEl) titleEl.textContent = "Modifier l'utilisateur";

  const btnText = document.getElementById("team-member-modal-submit-text");
  if (btnText) btnText.textContent = "💾 Mettre à jour l'utilisateur";

  const modal = document.getElementById("team-member-modal");
  if (modal) {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    lockBodyScroll();
    const modalBody = modal.querySelector(".modal-body");
    if (modalBody) modalBody.scrollTop = 0;
  }
}

function closeTeamMemberModal() {
  const modal = document.getElementById("team-member-modal");
  if (modal) {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    unlockBodyScroll();
  }
}

function handleTeamMemberFormSubmit(e) {
  if (e) e.preventDefault();

  const id = document.getElementById("input-member-id")?.value;
  const name = document.getElementById("input-member-name")?.value?.trim();
  const role = document.getElementById("input-member-role")?.value || "Tractoriste / Chauffeur d'engins";
  const status = document.getElementById("input-member-status")?.value || "Actif";
  const email = document.getElementById("input-member-email")?.value?.trim() || "";
  const password = document.getElementById("input-member-password")?.value?.trim() || "viti2026";
  const phone = document.getElementById("input-member-phone")?.value?.trim() || "";
  const certifications = document.getElementById("input-member-certifications")?.value?.trim() || "";
  const notes = document.getElementById("input-member-notes")?.value?.trim() || "";

  if (!name) {
    showToast("Veuillez renseigner le nom de l'utilisateur.", "warning");
    return;
  }

  const roleCategory = getRoleCategory(role);

  // Palette de couleurs pour les avatars
  const roleColors = {
    gerant: "#2d6a4f",
    chef: "#2563eb",
    tractoriste: "#d97706",
    ouvrier: "#9333ea",
    saisonnier: "#f59e0b",
    autre: "#4b5563"
  };

  if (id) {
    // Modification d'un utilisateur existant
    const idx = (teamUsers || []).findIndex(u => u.id === id);
    if (idx !== -1) {
      teamUsers[idx] = {
        ...teamUsers[idx],
        name,
        role,
        roleCategory,
        status,
        email,
        password,
        phone,
        certifications,
        notes
      };
      showToast(`Utilisateur « ${name} » mis à jour !`, "success");
    }
  } else {
    // Création d'un nouvel utilisateur
    const newMember = {
      id: generateUniqueId("USR"),
      name,
      role,
      roleCategory,
      status,
      email,
      password,
      phone,
      certifications,
      notes,
      color: roleColors[roleCategory] || "#2d6a4f"
    };
    teamUsers.push(newMember);
    showToast(`Utilisateur « ${name} » ajouté à l'équipe !`, "success");
  }

  saveTeamUsers();
  closeTeamMemberModal();
  renderTeamList();
  renderKPIs();
  populatePlannedWorkerSelect();
}

function deleteTeamMember(userId) {
  const user = (teamUsers || []).find(u => u.id === userId);
  if (!user) return;

  const isGerant = user.roleCategory === "gerant" || (user.role && user.role.toLowerCase().includes("gérant"));
  const gerantsCount = (teamUsers || []).filter(u => u.roleCategory === "gerant" || (u.role && u.role.toLowerCase().includes("gérant"))).length;

  if (isGerant && gerantsCount <= 1) {
    alert("Impossible de retirer le seul gérant exploitant du domaine.");
    return;
  }

  if (!confirm(`Êtes-vous sûr de vouloir retirer « ${user.name} » de l'équipe ?`)) {
    return;
  }

  teamUsers = teamUsers.filter(u => u.id !== userId);
  saveTeamUsers();
  renderTeamList();
  renderKPIs();
  populatePlannedWorkerSelect();
  showToast(`Utilisateur « ${user.name} » retiré de l'équipe.`, "info");
}

function populatePlannedWorkerSelect() {
  const select = document.getElementById("input-planned-worker");
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = '<option value="">Non assigné (À définir)</option>';

  (teamUsers || []).forEach(u => {
    const opt = document.createElement("option");
    opt.value = u.name;
    opt.textContent = `${u.name} (${u.role})`;
    select.appendChild(opt);
  });

  if (currentVal) {
    select.value = currentVal;
  }
}

// Initialisation globale au chargement
document.addEventListener("DOMContentLoaded", () => {
  populatePlannedWorkerSelect();
});

// ==================== VENDANGES & RÉCOLTES PAR PARCELLE ====================

function renderVendangesView() {
  updateSidebarVendangesCount();
  populateVendangesClientFilter();
  populateVendangesParcelFilter();
  populateVendangesTeamFilter();
  renderVendangesKPIs();
  renderVendangesTable();
}

function updateSidebarVendangesCount() {
  const badge = document.getElementById("sidebar-vendanges-count");
  if (badge) {
    const count = (harvestWorks || []).length;
    badge.textContent = count;
    badge.style.display = count > 0 ? "inline-flex" : "none";
  }
}

function renderVendangesKPIs() {
  const list = harvestWorks || [];
  const totalParcels = list.length;
  const totalSurface = list.reduce((acc, h) => acc + (parseFloat(h.surface) || 0), 0);

  // Parcelles au suivi
  setElemText("kpi-harvest-parcels-count", totalParcels);
  setElemText("kpi-harvest-surface-total", `${formatSurface(totalSurface)} ha`);

  // Effeuillage
  const effeuilleeCount = list.filter(h => h.leafStatus === "effeuillee").length;
  const aEffeuillerCount = list.filter(h => h.leafStatus === "a_effeuiller").length;
  const leafApplicable = list.filter(h => h.leafStatus !== "non_necessaire").length;
  const leafPercent = leafApplicable > 0 ? Math.round((effeuilleeCount / leafApplicable) * 100) : (totalParcels > 0 ? 100 : 0);
  setElemText("kpi-harvest-leaf-progress", `${leafPercent}%`);
  setElemText("kpi-harvest-leaf-details", `${effeuilleeCount} effeuillée(s) • ${aEffeuillerCount} à faire`);
  const leafBar = document.getElementById("kpi-harvest-leaf-bar");
  if (leafBar) leafBar.style.width = `${leafPercent}%`;

  const leafSrvTag = document.getElementById("kpi-harvest-leaf-srv-tag");
  if (leafSrvTag) {
    const defaultLeafSrv = (services || []).find(s => s.name && s.name.toLowerCase().includes("effeuillage")) || { name: "Effeuillage manuel", price: 550, rateType: "surface" };
    const leafRateLabel = defaultLeafSrv.rateType === "surface" ? "€/ha" : (defaultLeafSrv.rateType === "hourly" ? "€/h" : (defaultLeafSrv.rateType === "kilo" ? "€/kg" : "€"));
    leafSrvTag.textContent = `Prestation liée : ${defaultLeafSrv.name} (${defaultLeafSrv.price} ${leafRateLabel})`;
  }

  // Coupe / Récolte
  const coupeeCount = list.filter(h => h.cutStatus === "coupee").length;
  const aCouperCount = list.filter(h => h.cutStatus === "a_couper").length;
  const cutPercent = totalParcels > 0 ? Math.round((coupeeCount / totalParcels) * 100) : 0;
  setElemText("kpi-harvest-cut-progress", `${cutPercent}%`);
  setElemText("kpi-harvest-cut-details", `${coupeeCount} coupée(s) • ${aCouperCount} à couper`);
  const cutBar = document.getElementById("kpi-harvest-cut-bar");
  if (cutBar) cutBar.style.width = `${cutPercent}%`;

  // Volume Récolté (Kilos & Caisses & Valorisation HT)
  const totalKg = list.reduce((acc, h) => acc + (parseFloat(h.yieldKg) || 0), 0);
  const totalBoxes = list.reduce((acc, h) => acc + (parseInt(h.boxesCount, 10) || 0), 0);
  const totalHarvestRevenueHT = list.reduce((acc, h) => {
    const kg = parseFloat(h.yieldKg) || 0;
    const price = parseFloat(h.yieldPricePerKg) || 0;
    return acc + (kg * price);
  }, 0);
  setElemText("kpi-harvest-volume-total", `${totalKg.toLocaleString("fr-FR")} kg`);
  setElemText("kpi-harvest-boxes-total", `${totalBoxes.toLocaleString("fr-FR")} caisse(s)`);
  setElemText("kpi-harvest-revenue-total", `${formatCurrency(totalHarvestRevenueHT)} valorisé`);

  const cutSrvTag = document.getElementById("kpi-harvest-cut-srv-tag");
  if (cutSrvTag) {
    cutSrvTag.textContent = `Prestation : Coupe vendange (${coupeeCount} récoltée${coupeeCount > 1 ? "s" : ""})`;
  }

  // Débardage
  const debardeeCount = list.filter(h => h.haulStatus === "debardee").length;
  const aDebarderCount = list.filter(h => h.haulStatus === "a_debarder").length;
  const haulApplicable = list.filter(h => h.haulStatus !== "non_necessaire").length;
  const haulPercent = haulApplicable > 0 ? Math.round((debardeeCount / haulApplicable) * 100) : (totalParcels > 0 ? 100 : 0);
  setElemText("kpi-harvest-haul-progress", `${haulPercent}%`);
  setElemText("kpi-harvest-haul-details", `${debardeeCount} débardée(s) • ${aDebarderCount} à sortir`);
  const haulBar = document.getElementById("kpi-harvest-haul-bar");
  if (haulBar) haulBar.style.width = `${haulPercent}%`;

  const haulSrvTag = document.getElementById("kpi-harvest-haul-srv-tag");
  if (haulSrvTag) {
    const defaultHaulSrv = (services || []).find(s => s.name && (s.name.toLowerCase().includes("débardage") || s.name.toLowerCase().includes("debardage"))) || { name: "Débardage vendange (tracteur / porteur)", price: 0.15, rateType: "kilo" };
    const haulRateLabel = defaultHaulSrv.rateType === "kilo" ? "€/kg" : (defaultHaulSrv.rateType === "surface" ? "€/ha" : (defaultHaulSrv.rateType === "hourly" ? "€/h" : "€"));
    haulSrvTag.textContent = `Prestation liée : ${defaultHaulSrv.name} (${defaultHaulSrv.price} ${haulRateLabel})`;
  }

  // Badges des onglets segmentés
  setElemText("count-vendanges-all", totalParcels);
  setElemText("count-vendanges-leaf", aEffeuillerCount);
  setElemText("count-vendanges-cut-todo", aCouperCount);
  setElemText("count-vendanges-cut-done", coupeeCount);
  setElemText("count-vendanges-haul-todo", aDebarderCount);
  setElemText("count-vendanges-haul-done", debardeeCount);
}

let _vendangesFilterMsInitialized = false;
function initVendangesClientFilterMultiSelect() {
  if (_vendangesFilterMsInitialized) return;
  _vendangesFilterMsInitialized = true;

  const wrap = document.getElementById("wrap-vendanges-filter-client");
  const btn = document.getElementById("btn-vendanges-filter-client");
  const dropdown = document.getElementById("dropdown-vendanges-filter-client");
  const searchInput = document.getElementById("search-vendanges-filter-client");
  const btnAll = document.getElementById("btn-vendanges-select-all-clients");
  const btnClear = document.getElementById("btn-vendanges-clear-clients");

  if (btn && dropdown) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = dropdown.style.display === "flex";
      closeAllFilterMultiSelects();
      if (!isOpen) {
        dropdown.style.display = "flex";
        if (wrap) wrap.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
        if (searchInput) setTimeout(() => searchInput.focus(), 60);
      }
    });
  }

  if (dropdown) {
    dropdown.addEventListener("click", (e) => e.stopPropagation());
  }

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase().trim();
      const items = document.querySelectorAll("#list-vendanges-filter-client .filter-ms-item");
      items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(q) ? "flex" : "none";
      });
    });
  }

  if (btnAll) {
    btnAll.addEventListener("click", (e) => {
      e.preventDefault();
      const checkboxes = document.querySelectorAll("#list-vendanges-filter-client .vendanges-client-cb");
      vendangesClientFilters = [];
      checkboxes.forEach(cb => {
        cb.checked = true;
        const item = cb.closest(".filter-ms-item");
        if (item) item.classList.add("is-checked");
        vendangesClientFilters.push(cb.value);
      });
      updateVendangesClientFilterUI();
      populateVendangesParcelFilter();
      renderVendangesTable();
    });
  }

  if (btnClear) {
    btnClear.addEventListener("click", (e) => {
      e.preventDefault();
      const checkboxes = document.querySelectorAll("#list-vendanges-filter-client .vendanges-client-cb");
      checkboxes.forEach(cb => {
        cb.checked = false;
        const item = cb.closest(".filter-ms-item");
        if (item) item.classList.remove("is-checked");
      });
      vendangesClientFilters = [];
      updateVendangesClientFilterUI();
      populateVendangesParcelFilter();
      renderVendangesTable();
    });
  }
}

let _vendangesStageDropdownInitialized = false;
function initVendangesStageFilterDropdown() {
  if (_vendangesStageDropdownInitialized) return;
  _vendangesStageDropdownInitialized = true;

  const wrap = document.getElementById("wrap-vendanges-filter-stage");
  const btn = document.getElementById("btn-vendanges-filter-stage");
  const dropdown = document.getElementById("dropdown-vendanges-filter-stage");
  const btnAll = document.getElementById("btn-vendanges-select-all-stages");
  const btnClear = document.getElementById("btn-vendanges-clear-stages");

  if (btn && dropdown) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = dropdown.style.display === "flex";
      closeAllFilterMultiSelects();
      if (!isOpen) {
        dropdown.style.display = "flex";
        if (wrap) wrap.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  }

  if (dropdown) {
    dropdown.addEventListener("click", (e) => e.stopPropagation());
  }

  // Checkboxes change listeners
  const checkboxes = document.querySelectorAll("#list-vendanges-filter-stage .vendanges-stage-cb");
  checkboxes.forEach(cb => {
    cb.addEventListener("change", (e) => {
      toggleVendangesStage(e.target.value, e.target.checked);
    });
  });

  if (btnAll) {
    btnAll.addEventListener("click", (e) => {
      e.preventDefault();
      toggleAllVendangesStages(true);
    });
  }

  if (btnClear) {
    btnClear.addEventListener("click", (e) => {
      e.preventDefault();
      toggleAllVendangesStages(false);
    });
  }

  updateVendangesStageFilterUI();
}

function updateVendangesStageFilterUI() {
  const allStages = ["leaf_todo", "leaf_done", "cut_todo", "cut_done", "haul_todo", "haul_done"];
  const stageNames = {
    leaf_todo: { icon: "🍃", label: "À effeuiller" },
    leaf_done: { icon: "✅", label: "Effeuillées" },
    cut_todo: { icon: "⏳", label: "À couper" },
    cut_done: { icon: "🍇", label: "Coupées" },
    haul_todo: { icon: "🚜", label: "À débarder" },
    haul_done: { icon: "✅", label: "Débardées" }
  };

  const iconEl = document.getElementById("vendanges-stage-icon");
  const textEl = document.getElementById("vendanges-filter-stage-text");
  const badgeEl = document.getElementById("vendanges-stage-dropdown-badge");
  const count = vendangesStageFilters.length;

  if (count === 0) {
    if (iconEl) iconEl.textContent = "⚠️";
    if (textEl) textEl.textContent = "Aucune étape sélectionnée";
    if (badgeEl) badgeEl.textContent = "0";
  } else if (count === allStages.length) {
    if (iconEl) iconEl.textContent = "📋";
    if (textEl) textEl.textContent = "Toutes les étapes";
    if (badgeEl) badgeEl.textContent = "Toutes";
  } else if (count === 1) {
    const single = stageNames[vendangesStageFilters[0]];
    if (iconEl) iconEl.textContent = single ? single.icon : "📋";
    if (textEl) textEl.textContent = single ? single.label : "1 étape";
    if (badgeEl) badgeEl.textContent = "1 sélectionnée";
  } else {
    const first = stageNames[vendangesStageFilters[0]];
    if (iconEl) iconEl.textContent = first ? first.icon : "📋";
    if (textEl) textEl.textContent = `${first ? first.label : 'Étape'} +${count - 1}`;
    if (badgeEl) badgeEl.textContent = `${count} sélectionnées`;
  }
}

function toggleVendangesStage(stage, isChecked) {
  if (isChecked) {
    if (!vendangesStageFilters.includes(stage)) {
      vendangesStageFilters.push(stage);
    }
  } else {
    vendangesStageFilters = vendangesStageFilters.filter(s => s !== stage);
  }

  const item = document.querySelector(`#list-vendanges-filter-stage .filter-ms-item[data-stage="${stage}"]`);
  if (item) {
    item.classList.toggle("is-checked", isChecked);
    const cb = item.querySelector(".vendanges-stage-cb");
    if (cb) cb.checked = isChecked;
  }

  updateVendangesStageFilterUI();
  renderVendangesTable();
}

function toggleAllVendangesStages(checkAll) {
  const allStages = ["leaf_todo", "leaf_done", "cut_todo", "cut_done", "haul_todo", "haul_done"];
  vendangesStageFilters = checkAll ? [...allStages] : [];

  const checkboxes = document.querySelectorAll("#list-vendanges-filter-stage .vendanges-stage-cb");
  checkboxes.forEach(cb => {
    cb.checked = checkAll;
    const item = cb.closest(".filter-ms-item");
    if (item) item.classList.toggle("is-checked", checkAll);
  });

  updateVendangesStageFilterUI();
  renderVendangesTable();
}

function filterVendangesByStage(stage) {
  const allStages = ["leaf_todo", "leaf_done", "cut_todo", "cut_done", "haul_todo", "haul_done"];
  if (stage === "all") {
    vendangesStageFilters = [...allStages];
  } else {
    vendangesStageFilters = [stage];
  }

  const checkboxes = document.querySelectorAll("#list-vendanges-filter-stage .vendanges-stage-cb");
  checkboxes.forEach(cb => {
    const isChecked = vendangesStageFilters.includes(cb.value);
    cb.checked = isChecked;
    const item = cb.closest(".filter-ms-item");
    if (item) item.classList.toggle("is-checked", isChecked);
  });

  updateVendangesStageFilterUI();
  renderVendangesTable();

  const tableSec = document.getElementById("vendanges-table-section");
  if (tableSec) {
    tableSec.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function populateVendangesClientFilter() {
  initVendangesClientFilterMultiSelect();
  initVendangesStageFilterDropdown();
  const listEl = document.getElementById("list-vendanges-filter-client");
  if (!listEl) return;

  listEl.innerHTML = "";

  // Collecte des clients uniques avec domaines dans harvestWorks ou dans clients
  const clientMap = new Map();
  (clients || []).forEach(c => clientMap.set(c.id, { name: c.name, commune: c.location || c.commune || "" }));
  (harvestWorks || []).forEach(h => {
    if (h.clientId && h.clientName && !clientMap.has(h.clientId)) {
      clientMap.set(h.clientId, { name: h.clientName, commune: "" });
    }
  });

  if (clientMap.size === 0) {
    listEl.innerHTML = '<div class="filter-ms-empty">Aucun domaine viticole</div>';
    updateVendangesClientFilterUI();
    return;
  }

  clientMap.forEach((info, id) => {
    const isChecked = Array.isArray(vendangesClientFilters) && vendangesClientFilters.includes(id);
    const label = document.createElement("label");
    label.className = `filter-ms-item ${isChecked ? "is-checked" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "filter-ms-cb vendanges-client-cb";
    checkbox.value = id;
    checkbox.checked = isChecked;

    checkbox.addEventListener("change", () => {
      const allChecked = Array.from(document.querySelectorAll("#list-vendanges-filter-client .vendanges-client-cb:checked")).map(cb => cb.value);
      vendangesClientFilters = allChecked;
      label.classList.toggle("is-checked", checkbox.checked);
      updateVendangesClientFilterUI();
      populateVendangesParcelFilter();
      renderVendangesTable();
    });

    const infoWrap = document.createElement("div");
    infoWrap.className = "filter-ms-item-info";

    const nameSpan = document.createElement("span");
    nameSpan.className = "filter-ms-item-name";
    nameSpan.textContent = info.name;
    infoWrap.appendChild(nameSpan);

    if (info.commune) {
      const subSpan = document.createElement("span");
      subSpan.className = "filter-ms-item-sub";
      subSpan.textContent = info.commune;
      infoWrap.appendChild(subSpan);
    }

    label.appendChild(checkbox);
    label.appendChild(infoWrap);
    listEl.appendChild(label);
  });

  updateVendangesClientFilterUI();
}

function updateVendangesClientFilterUI() {
  const textEl = document.getElementById("vendanges-filter-client-text");
  const badgeEl = document.getElementById("vendanges-filter-client-badge");
  const wrapEl = document.getElementById("wrap-vendanges-filter-client");

  const checkboxes = document.querySelectorAll("#list-vendanges-filter-client .vendanges-client-cb");
  const total = checkboxes.length;
  const count = Array.isArray(vendangesClientFilters) ? vendangesClientFilters.length : 0;

  if (textEl) {
    if (count === 0 || count === total) {
      textEl.textContent = "Tous les domaines";
    } else if (count === 1) {
      const foundClient = (clients || []).find(c => c.id === vendangesClientFilters[0]);
      textEl.textContent = foundClient ? foundClient.name : "1 domaine sélectionné";
    } else {
      textEl.textContent = `${count} domaines sélectionnés`;
    }
  }

  if (badgeEl) {
    if (count === 0 || count === total) {
      badgeEl.textContent = "Tous";
    } else {
      badgeEl.textContent = `${count} sélectionné${count > 1 ? "s" : ""}`;
    }
  }

  if (wrapEl) {
    wrapEl.classList.toggle("is-active", count > 0 && count < total);
  }
}

// ==================== FILTRE MULTI-SÉLECTION PARCELLES VENDANGES ====================

let _vendangesParcelDropdownInitialized = false;
function initVendangesParcelFilterMultiSelect() {
  if (_vendangesParcelDropdownInitialized) return;
  _vendangesParcelDropdownInitialized = true;

  const wrap = document.getElementById("wrap-vendanges-filter-parcel");
  const btn = document.getElementById("btn-vendanges-filter-parcel");
  const dropdown = document.getElementById("dropdown-vendanges-filter-parcel");
  const searchInput = document.getElementById("search-vendanges-filter-parcel");
  const btnAll = document.getElementById("btn-vendanges-select-all-parcels");
  const btnClear = document.getElementById("btn-vendanges-clear-parcels");

  if (btn && dropdown) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = dropdown.style.display === "flex";
      closeAllFilterMultiSelects();
      if (!isOpen) {
        dropdown.style.display = "flex";
        if (wrap) wrap.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
        if (searchInput) setTimeout(() => searchInput.focus(), 60);
      }
    });
  }

  if (dropdown) {
    dropdown.addEventListener("click", (e) => e.stopPropagation());
  }

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase().trim();
      const items = document.querySelectorAll("#list-vendanges-filter-parcel .filter-ms-item");
      items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(q) ? "flex" : "none";
      });
      const groupHeaders = document.querySelectorAll("#list-vendanges-filter-parcel .filter-ms-group-header");
      groupHeaders.forEach(hdr => {
        let sibling = hdr.nextElementSibling;
        let hasVisible = false;
        while (sibling && sibling.classList.contains("filter-ms-item")) {
          if (sibling.style.display !== "none") hasVisible = true;
          sibling = sibling.nextElementSibling;
        }
        hdr.style.display = hasVisible ? "flex" : "none";
      });
    });
  }

  if (btnAll) {
    btnAll.addEventListener("click", (e) => {
      e.preventDefault();
      toggleAllVendangesParcels(true);
    });
  }

  if (btnClear) {
    btnClear.addEventListener("click", (e) => {
      e.preventDefault();
      toggleAllVendangesParcels(false);
    });
  }
}

function createVendangesParcelItem(p) {
  const isChecked = vendangesParcelFilters.includes(p.key);
  const label = document.createElement("label");
  label.className = `filter-ms-item ${isChecked ? "is-checked" : ""}`;
  label.dataset.parcelKey = p.key;
  label.dataset.clientId = p.clientId || p.clientName;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "filter-ms-cb vendanges-parcel-cb";
  checkbox.value = p.key;
  checkbox.checked = isChecked;

  checkbox.addEventListener("change", () => {
    toggleVendangesParcel(p.key, checkbox.checked);
  });

  const grape = p.grapeVariety ? ` • ${escapeHTML(p.grapeVariety)}` : "";
  const surf = p.surface ? `${formatSurface(p.surface)} ha` : "";

  label.innerHTML = `
    <span class="filter-ms-checkbox-box"></span>
    <div class="filter-ms-item-text">
      <span class="filter-ms-item-title">📍 ${escapeHTML(p.name)}</span>
      <span class="filter-ms-item-sub">${surf}${grape}</span>
    </div>
  `;
  label.prepend(checkbox);
  return label;
}

function populateVendangesParcelFilter() {
  initVendangesParcelFilterMultiSelect();
  const listEl = document.getElementById("list-vendanges-filter-parcel");
  if (!listEl) return;

  listEl.innerHTML = "";

  // 1. Filtrer les récoltes disponibles selon le filtre Domaine
  let availableHarvests = [...(harvestWorks || [])];
  if (Array.isArray(vendangesClientFilters) && vendangesClientFilters.length > 0) {
    const totalClientsCount = document.querySelectorAll("#list-vendanges-filter-client .vendanges-client-cb").length;
    if (vendangesClientFilters.length < totalClientsCount) {
      availableHarvests = availableHarvests.filter(h =>
        vendangesClientFilters.includes(h.clientId) ||
        vendangesClientFilters.includes(h.clientName)
      );
    }
  } else if (vendangesClientFilter && vendangesClientFilter !== "all") {
    availableHarvests = availableHarvests.filter(h =>
      h.clientId === vendangesClientFilter || h.clientName === vendangesClientFilter
    );
  }

  // 2. Extraire les parcelles uniques
  const parcelMap = new Map();
  availableHarvests.forEach(h => {
    const key = (h.clientId || "") + "___" + (h.parcelId || h.parcelName);
    if (!parcelMap.has(key)) {
      parcelMap.set(key, {
        key: key,
        parcelId: h.parcelId,
        name: h.parcelName || "Parcelle sans nom",
        clientId: h.clientId || "",
        clientName: h.clientName || "Domaine",
        surface: h.surface,
        grapeVariety: h.grapeVariety || ""
      });
    }
  });

  const allParcels = Array.from(parcelMap.values());

  if (allParcels.length === 0) {
    listEl.innerHTML = '<div class="filter-ms-empty">Aucune parcelle répertoriée</div>';
    vendangesParcelFilters = [];
    updateVendangesParcelFilterUI();
    return;
  }

  // Synchronisation des clés valides dans vendangesParcelFilters
  const allKeys = allParcels.map(p => p.key);
  if (!Array.isArray(vendangesParcelFilters) || vendangesParcelFilters.length === 0 || vendangesParcelFilters.some(k => !allKeys.includes(k))) {
    vendangesParcelFilters = [...allKeys];
  }

  const distinctClientIds = [...new Set(allParcels.map(p => p.clientId || p.clientName))];

  if (distinctClientIds.length > 1) {
    // Regroupement élégant par domaine viticole
    const grouped = new Map();
    allParcels.forEach(p => {
      const cId = p.clientId || p.clientName;
      if (!grouped.has(cId)) grouped.set(cId, { clientName: p.clientName, clientId: p.clientId, parcels: [] });
      grouped.get(cId).parcels.push(p);
    });

    grouped.forEach((grp, cId) => {
      const grpHdr = document.createElement("div");
      grpHdr.className = "filter-ms-group-header";
      grpHdr.innerHTML = `
        <span>🍇 ${escapeHTML(grp.clientName)} (${grp.parcels.length})</span>
        <div class="filter-ms-group-actions">
          <button type="button" class="btn-link" onclick="toggleVendangesClientGroupParcels('${escapeHTML(cId)}', true)">Tout</button>
          <span>•</span>
          <button type="button" class="btn-link" onclick="toggleVendangesClientGroupParcels('${escapeHTML(cId)}', false)">Aucun</button>
        </div>
      `;
      listEl.appendChild(grpHdr);

      grp.parcels.forEach(p => {
        listEl.appendChild(createVendangesParcelItem(p));
      });
    });
  } else {
    // Liste directe simple
    allParcels.forEach(p => {
      listEl.appendChild(createVendangesParcelItem(p));
    });
  }

  updateVendangesParcelFilterUI();
}

function updateVendangesParcelFilterUI() {
  const textEl = document.getElementById("vendanges-filter-parcel-text");
  const badgeEl = document.getElementById("vendanges-filter-parcel-badge");
  const wrapEl = document.getElementById("wrap-vendanges-filter-parcel");

  const checkboxes = document.querySelectorAll("#list-vendanges-filter-parcel .vendanges-parcel-cb");
  const total = checkboxes.length;
  const count = Array.isArray(vendangesParcelFilters) ? vendangesParcelFilters.length : 0;

  if (textEl) {
    if (total === 0) {
      textEl.textContent = "Aucune parcelle";
    } else if (count === 0) {
      textEl.textContent = "⚠️ Aucune sélectionnée";
    } else if (count === total) {
      textEl.textContent = "Toutes les parcelles";
    } else if (count === 1) {
      const checkedItem = document.querySelector("#list-vendanges-filter-parcel .filter-ms-item.is-checked .filter-ms-item-title");
      textEl.textContent = checkedItem ? checkedItem.textContent.trim() : "1 parcelle sélectionnée";
    } else {
      textEl.textContent = `${count} parcelles sélectionnées`;
    }
  }

  if (badgeEl) {
    if (total === 0 || count === 0) {
      badgeEl.textContent = "0";
    } else if (count === total) {
      badgeEl.textContent = "Toutes";
    } else {
      badgeEl.textContent = `${count} / ${total}`;
    }
  }

  if (wrapEl) {
    wrapEl.classList.toggle("is-active", count > 0 && count < total);
  }
}

function toggleVendangesParcel(parcelKey, isChecked) {
  if (isChecked) {
    if (!vendangesParcelFilters.includes(parcelKey)) {
      vendangesParcelFilters.push(parcelKey);
    }
  } else {
    vendangesParcelFilters = vendangesParcelFilters.filter(k => k !== parcelKey);
  }

  const item = document.querySelector(`#list-vendanges-filter-parcel .filter-ms-item[data-parcel-key="${parcelKey}"]`);
  if (item) {
    item.classList.toggle("is-checked", isChecked);
    const cb = item.querySelector(".vendanges-parcel-cb");
    if (cb) cb.checked = isChecked;
  }

  updateVendangesParcelFilterUI();
  renderVendangesTable();
}

function toggleAllVendangesParcels(checkAll) {
  const checkboxes = document.querySelectorAll("#list-vendanges-filter-parcel .vendanges-parcel-cb");
  vendangesParcelFilters = [];

  checkboxes.forEach(cb => {
    cb.checked = checkAll;
    const item = cb.closest(".filter-ms-item");
    if (item) item.classList.toggle("is-checked", checkAll);
    if (checkAll) {
      vendangesParcelFilters.push(cb.value);
    }
  });

  updateVendangesParcelFilterUI();
  renderVendangesTable();
}

function toggleVendangesClientGroupParcels(cId, checkAll) {
  const items = document.querySelectorAll(`#list-vendanges-filter-parcel .filter-ms-item[data-client-id="${cId}"]`);
  items.forEach(item => {
    const cb = item.querySelector(".vendanges-parcel-cb");
    if (cb) {
      cb.checked = checkAll;
      item.classList.toggle("is-checked", checkAll);
      const key = cb.value;
      if (checkAll) {
        if (!vendangesParcelFilters.includes(key)) vendangesParcelFilters.push(key);
      } else {
        vendangesParcelFilters = vendangesParcelFilters.filter(k => k !== key);
      }
    }
  });

  updateVendangesParcelFilterUI();
  renderVendangesTable();
}

// ==================== FILTRE MULTI-SÉLECTION ÉQUIPES & SUIVI VENDANGES ====================

let _vendangesTeamDropdownInitialized = false;
function initVendangesTeamFilterMultiSelect() {
  if (_vendangesTeamDropdownInitialized) return;
  _vendangesTeamDropdownInitialized = true;

  const wrap = document.getElementById("wrap-vendanges-filter-team");
  const btn = document.getElementById("btn-vendanges-filter-team");
  const dropdown = document.getElementById("dropdown-vendanges-filter-team");
  const searchInput = document.getElementById("search-vendanges-filter-team");
  const btnAll = document.getElementById("btn-vendanges-select-all-teams");
  const btnClear = document.getElementById("btn-vendanges-clear-teams");

  if (btn && dropdown) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = dropdown.style.display === "flex";
      closeAllFilterMultiSelects();
      if (!isOpen) {
        dropdown.style.display = "flex";
        if (wrap) wrap.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
        if (searchInput) setTimeout(() => searchInput.focus(), 60);
      }
    });
  }

  if (dropdown) {
    dropdown.addEventListener("click", (e) => e.stopPropagation());
  }

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase().trim();
      const items = document.querySelectorAll("#list-vendanges-filter-team .filter-ms-item");
      items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(q) ? "flex" : "none";
      });
    });
  }

  if (btnAll) {
    btnAll.addEventListener("click", (e) => {
      e.preventDefault();
      toggleAllVendangesTeams(true);
    });
  }

  if (btnClear) {
    btnClear.addEventListener("click", (e) => {
      e.preventDefault();
      toggleAllVendangesTeams(false);
    });
  }
}

function populateVendangesTeamFilter() {
  initVendangesTeamFilterMultiSelect();
  const listEl = document.getElementById("list-vendanges-filter-team");
  if (!listEl) return;

  listEl.innerHTML = "";

  const teamsMap = new Map();

  // Membres déclarés dans l'équipe (teamUsers)
  (teamUsers || []).forEach(u => {
    teamsMap.set(u.name, {
      key: u.name,
      name: u.name,
      role: u.role || "Membre de l'équipe",
      color: u.color || "#2d6a4f",
      isTeamUser: true,
      count: 0
    });
  });

  // Décompte et repérage des équipes ou intervenants assignés dans harvestWorks
  let hasUnassigned = false;
  let unassignedCount = 0;

  (harvestWorks || []).forEach(h => {
    const w = (h.worker || "").trim();
    if (!w || w.toLowerCase() === "non assigné" || w.toLowerCase() === "non assigne" || w.toLowerCase() === "à définir") {
      hasUnassigned = true;
      unassignedCount++;
    } else {
      let matchedKey = null;
      if (teamsMap.has(w)) {
        matchedKey = w;
      } else {
        for (const [k, v] of teamsMap.entries()) {
          if (k.toLowerCase() === w.toLowerCase() || (w.includes(" ") && k.toLowerCase().startsWith(w.split(" ")[0].toLowerCase()))) {
            matchedKey = k;
            break;
          }
        }
      }

      if (matchedKey) {
        teamsMap.get(matchedKey).count++;
      } else {
        teamsMap.set(w, {
          key: w,
          name: w,
          role: "Équipe / Intervenant",
          color: "#2563eb",
          isTeamUser: false,
          count: 1
        });
      }
    }
  });

  if (hasUnassigned) {
    teamsMap.set("__unassigned__", {
      key: "__unassigned__",
      name: "Non assigné",
      role: "En attente d'affectation",
      color: "#6c757d",
      isUnassigned: true,
      count: unassignedCount
    });
  }

  const allTeams = Array.from(teamsMap.values());
  const allKeys = allTeams.map(t => t.key);

  if (allTeams.length === 0) {
    listEl.innerHTML = '<div class="filter-ms-empty">Aucune équipe disponible</div>';
    vendangesTeamFilters = [];
    updateVendangesTeamFilterUI();
    return;
  }

  // Synchronisation des clés actives
  if (!Array.isArray(vendangesTeamFilters) || vendangesTeamFilters.length === 0 || vendangesTeamFilters.some(k => !allKeys.includes(k))) {
    vendangesTeamFilters = [...allKeys];
  }

  allTeams.forEach(t => {
    const isChecked = vendangesTeamFilters.includes(t.key);
    const label = document.createElement("label");
    label.className = `filter-ms-item ${isChecked ? "is-checked" : ""}`;
    label.dataset.teamKey = t.key;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "filter-ms-cb vendanges-team-cb";
    checkbox.value = t.key;
    checkbox.checked = isChecked;

    checkbox.addEventListener("change", () => {
      toggleVendangesTeam(t.key, checkbox.checked);
    });

    const initial = (t.name || "U").charAt(0).toUpperCase();
    const avatarBadge = t.isUnassigned
      ? `<span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: rgba(108,117,125,0.25); color: #adb5bd; font-size: 0.72rem; font-weight: 700; flex-shrink: 0;">?</span>`
      : `<span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: ${t.color || '#2d6a4f'}; color: #fff; font-size: 0.72rem; font-weight: 700; flex-shrink: 0;">${initial}</span>`;

    label.innerHTML = `
      <span class="filter-ms-checkbox-box"></span>
      ${avatarBadge}
      <div class="filter-ms-item-text" style="flex: 1; margin-left: 0.45rem;">
        <span class="filter-ms-item-title">${escapeHTML(t.name)}</span>
        <span class="filter-ms-item-sub">${escapeHTML(t.role)}</span>
      </div>
      <span class="filter-stage-item-badge badge-neutral" style="font-size: 0.72rem; padding: 2px 7px; border-radius: 10px; background: rgba(255,255,255,0.08);">${t.count} parcelle${t.count > 1 ? 's' : ''}</span>
    `;
    label.prepend(checkbox);
    listEl.appendChild(label);
  });

  updateVendangesTeamFilterUI();
}

function updateVendangesTeamFilterUI() {
  const textEl = document.getElementById("vendanges-filter-team-text");
  const badgeEl = document.getElementById("vendanges-filter-team-badge");
  const wrapEl = document.getElementById("wrap-vendanges-filter-team");

  const checkboxes = document.querySelectorAll("#list-vendanges-filter-team .vendanges-team-cb");
  const total = checkboxes.length;
  const count = Array.isArray(vendangesTeamFilters) ? vendangesTeamFilters.length : 0;

  if (textEl) {
    if (total === 0) {
      textEl.textContent = "Aucune équipe";
    } else if (count === 0) {
      textEl.textContent = "⚠️ Aucune sélectionnée";
    } else if (count === total) {
      textEl.textContent = "Toutes les équipes";
    } else if (count === 1) {
      const checkedItem = document.querySelector("#list-vendanges-filter-team .filter-ms-item.is-checked .filter-ms-item-title");
      textEl.textContent = checkedItem ? checkedItem.textContent.trim() : "1 équipe sélectionnée";
    } else {
      textEl.textContent = `${count} équipes sélectionnées`;
    }
  }

  if (badgeEl) {
    if (total === 0 || count === 0) {
      badgeEl.textContent = "0";
    } else if (count === total) {
      badgeEl.textContent = "Toutes";
    } else {
      badgeEl.textContent = `${count} / ${total}`;
    }
  }

  if (wrapEl) {
    wrapEl.classList.toggle("is-active", count > 0 && count < total);
  }
}

function toggleVendangesTeam(teamKey, isChecked) {
  if (isChecked) {
    if (!vendangesTeamFilters.includes(teamKey)) {
      vendangesTeamFilters.push(teamKey);
    }
  } else {
    vendangesTeamFilters = vendangesTeamFilters.filter(k => k !== teamKey);
  }

  const item = document.querySelector(`#list-vendanges-filter-team .filter-ms-item[data-team-key="${teamKey}"]`);
  if (item) {
    item.classList.toggle("is-checked", isChecked);
    const cb = item.querySelector(".vendanges-team-cb");
    if (cb) cb.checked = isChecked;
  }

  updateVendangesTeamFilterUI();
  renderVendangesTable();
}

function toggleAllVendangesTeams(checkAll) {
  const checkboxes = document.querySelectorAll("#list-vendanges-filter-team .vendanges-team-cb");
  vendangesTeamFilters = [];

  checkboxes.forEach(cb => {
    cb.checked = checkAll;
    const item = cb.closest(".filter-ms-item");
    if (item) item.classList.toggle("is-checked", checkAll);
    if (checkAll) {
      vendangesTeamFilters.push(cb.value);
    }
  });

  updateVendangesTeamFilterUI();
  renderVendangesTable();
}

function renderVendangesTable() {
  const tbody = document.getElementById("vendanges-table-tbody");
  const emptyState = document.getElementById("vendanges-empty-state");
  const table = document.getElementById("vendanges-table");
  if (!tbody) return;

  let filtered = [...(harvestWorks || [])];

  // 1. Filtre par Domaine / Client (Multi-sélection à encoches)
  if (Array.isArray(vendangesClientFilters) && vendangesClientFilters.length > 0) {
    const totalCount = document.querySelectorAll("#list-vendanges-filter-client .vendanges-client-cb").length;
    if (vendangesClientFilters.length < totalCount) {
      filtered = filtered.filter(h =>
        vendangesClientFilters.includes(h.clientId) ||
        vendangesClientFilters.includes(h.clientName)
      );
    }
  } else if (vendangesClientFilter && vendangesClientFilter !== "all") {
    filtered = filtered.filter(h => h.clientId === vendangesClientFilter || h.clientName === vendangesClientFilter);
  }

  // 1b. Filtre par Parcelle (Multi-sélection à encoches)
  const totalVendangesParcels = document.querySelectorAll("#list-vendanges-filter-parcel .vendanges-parcel-cb").length;
  if (totalVendangesParcels > 0 && Array.isArray(vendangesParcelFilters)) {
    const checkedParcelCbs = document.querySelectorAll("#list-vendanges-filter-parcel .vendanges-parcel-cb:checked");
    if (checkedParcelCbs.length === 0 && vendangesParcelFilters.length === 0) {
      filtered = [];
    } else if (vendangesParcelFilters.length > 0 && vendangesParcelFilters.length < totalVendangesParcels) {
      filtered = filtered.filter(h => {
        const pKey = (h.clientId || "") + "___" + (h.parcelId || h.parcelName);
        return vendangesParcelFilters.includes(pKey) ||
               vendangesParcelFilters.includes(h.parcelId) ||
               vendangesParcelFilters.includes(h.parcelName);
      });
    }
  }

  // 1c. Filtre par Équipe & Suivi (Multi-sélection à encoches)
  const totalVendangesTeams = document.querySelectorAll("#list-vendanges-filter-team .vendanges-team-cb").length;
  if (totalVendangesTeams > 0 && Array.isArray(vendangesTeamFilters)) {
    const checkedTeamCbs = document.querySelectorAll("#list-vendanges-filter-team .vendanges-team-cb:checked");
    if (checkedTeamCbs.length === 0 && vendangesTeamFilters.length === 0) {
      filtered = [];
    } else if (vendangesTeamFilters.length > 0 && vendangesTeamFilters.length < totalVendangesTeams) {
      filtered = filtered.filter(h => {
        const w = (h.worker || "").trim();
        const isUnassigned = !w || w.toLowerCase() === "non assigné" || w.toLowerCase() === "non assigne" || w.toLowerCase() === "à définir";
        if (isUnassigned) {
          return vendangesTeamFilters.includes("__unassigned__");
        }
        if (vendangesTeamFilters.includes(w)) return true;
        for (const tKey of vendangesTeamFilters) {
          if (tKey === "__unassigned__") continue;
          if (w.toLowerCase().includes(tKey.toLowerCase()) || tKey.toLowerCase().includes(w.toLowerCase())) return true;
          const parts = tKey.split(" ");
          if (parts.length >= 2 && w.toLowerCase().startsWith(parts[0].toLowerCase())) return true;
        }
        return false;
      });
    }
  }

  // 2. Filtre par Étape / Statut (Multi-sélection à encoches)
  const allStages = ["leaf_todo", "leaf_done", "cut_todo", "cut_done", "haul_todo", "haul_done"];
  if (Array.isArray(vendangesStageFilters) && vendangesStageFilters.length < allStages.length) {
    if (vendangesStageFilters.length === 0) {
      filtered = [];
    } else {
      filtered = filtered.filter(h => {
        if (vendangesStageFilters.includes("leaf_todo") && h.leafStatus === "a_effeuiller") return true;
        if (vendangesStageFilters.includes("leaf_done") && h.leafStatus === "effeuillee") return true;
        if (vendangesStageFilters.includes("cut_todo") && h.cutStatus === "a_couper") return true;
        if (vendangesStageFilters.includes("cut_done") && h.cutStatus === "coupee") return true;
        if (vendangesStageFilters.includes("haul_todo") && h.haulStatus === "a_debarder") return true;
        if (vendangesStageFilters.includes("haul_done") && h.haulStatus === "debardee") return true;
        return false;
      });
    }
  }

  // 3. Filtre par Recherche texte
  if (vendangesSearchFilter) {
    const q = vendangesSearchFilter.toLowerCase();
    filtered = filtered.filter(h =>
      (h.clientName && h.clientName.toLowerCase().includes(q)) ||
      (h.parcelName && h.parcelName.toLowerCase().includes(q)) ||
      (h.grapeVariety && h.grapeVariety.toLowerCase().includes(q)) ||
      (h.worker && h.worker.toLowerCase().includes(q)) ||
      (h.notes && h.notes.toLowerCase().includes(q))
    );
  }

  // Compteurs & Bouton de réinitialisation
  setElemText("vendanges-table-count", `${filtered.length} parcelle${filtered.length > 1 ? "s" : ""}`);
  setElemText("vendanges-footer-count", `${filtered.length} parcelle(s) affichée(s)`);

  const resetBtn = document.getElementById("btn-reset-vendanges-filters");
  const totalVendangesCount = document.querySelectorAll("#list-vendanges-filter-client .vendanges-client-cb").length;
  const isParcelFiltered = totalVendangesParcels > 0 && vendangesParcelFilters.length < totalVendangesParcels;
  const isTeamFiltered = totalVendangesTeams > 0 && vendangesTeamFilters.length < totalVendangesTeams;
  const isFiltered = (Array.isArray(vendangesClientFilters) && vendangesClientFilters.length > 0 && vendangesClientFilters.length < totalVendangesCount) ||
                     (vendangesClientFilter && vendangesClientFilter !== "all") ||
                     isParcelFiltered ||
                     isTeamFiltered ||
                     (Array.isArray(vendangesStageFilters) && vendangesStageFilters.length < allStages.length) ||
                     (vendangesSearchFilter && vendangesSearchFilter.trim() !== "");
  if (resetBtn) resetBtn.style.display = isFiltered ? "inline-flex" : "none";

  const emptyResetBtn = document.getElementById("btn-vendanges-empty-reset");
  const emptyDesc = document.getElementById("vendanges-empty-desc");
  if (filtered.length === 0) {
    tbody.innerHTML = "";
    if (table) table.style.display = "none";
    if (emptyState) emptyState.style.display = "block";
    if (harvestWorks && harvestWorks.length > 0) {
      if (emptyDesc) emptyDesc.textContent = "Aucune parcelle ne correspond aux filtres appliqués (domaine, parcelle ou étape). Réinitialisez les filtres pour réafficher toutes les parcelles suivies.";
      if (emptyResetBtn) emptyResetBtn.style.display = "inline-flex";
    } else {
      if (emptyDesc) emptyDesc.textContent = "Aucune parcelle n'est actuellement inscrite pour la récolte des vendanges.";
      if (emptyResetBtn) emptyResetBtn.style.display = "none";
    }
    return;
  }

  if (emptyResetBtn) emptyResetBtn.style.display = "none";

  if (table) table.style.display = "table";
  if (emptyState) emptyState.style.display = "none";

  tbody.innerHTML = filtered.map(h => {
    // Menu Déroulant Effeuillage épuré (statut direct sans encombrement)
    const leafClass = h.leafStatus === "effeuillee" ? "badge-leaf-done" : (h.leafStatus === "non_necessaire" ? "badge-leaf-none" : "badge-leaf-todo");
    const leafSelect = `
      <select class="harvest-table-select ${leafClass}" onchange="changeHarvestLeaf('${h.id}', this.value)" aria-label="Statut effeuillage">
        <option value="a_effeuiller" ${h.leafStatus === 'a_effeuiller' || !h.leafStatus ? 'selected' : ''}>🍃 À effeuiller</option>
        <option value="non_necessaire" ${h.leafStatus === 'non_necessaire' ? 'selected' : ''}>🚫 Non nécessaire</option>
        <option value="effeuillee" ${h.leafStatus === 'effeuillee' ? 'selected' : ''}>✅ Effeuillée</option>
      </select>
    `;

    // Menu Déroulant Coupe & Récolte épuré (statut direct sans encombrement)
    const cutClass = h.cutStatus === "coupee" ? "badge-cut-done" : "badge-cut-todo";
    const harvestServiceName = h.harvestServiceName || "Coupe vendange (au kilo)";
    const cutPrice = parseFloat(h.yieldPricePerKg) || 0.35;
    const cutSelect = `
      <select class="harvest-table-select ${cutClass}" onchange="changeHarvestCut('${h.id}', this.value)" aria-label="Statut coupe et récolte">
        <option value="a_couper" ${h.cutStatus === 'a_couper' || !h.cutStatus ? 'selected' : ''}>⏳ À couper</option>
        <option value="coupee" ${h.cutStatus === 'coupee' ? 'selected' : ''}>🍇 Coupée</option>
      </select>
    `;

    // Section Kilos / Caisses & Facturation
    let yieldCell = "";
    if (h.cutStatus === "coupee") {
      const kg = parseFloat(h.yieldKg) || 0;
      const boxes = parseInt(h.boxesCount, 10) || 0;
      const price = parseFloat(h.yieldPricePerKg) || 0;
      const totalHT = Math.round(kg * price * 100) / 100;

      if (kg > 0 || boxes > 0) {
        yieldCell = `
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.4rem;">
              <div style="font-weight: 700; color: var(--text-heading); font-size: 0.92rem;">
                ⚖️ ${kg.toLocaleString("fr-FR")} kg ${boxes > 0 ? `<span style="font-size: 0.77rem; font-weight: normal; color: var(--text-muted);">(📦 ${boxes})</span>` : ""}
              </div>
              <button type="button" class="btn-yield-action" onclick="openYieldModal('${h.id}')" title="Modifier la pesée">✏️</button>
            </div>
            ${price > 0 ? `
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.35rem; font-size: 0.78rem; background: rgba(82, 183, 136, 0.08); padding: 2px 6px; border-radius: 4px;">
                <span style="color: var(--text-muted); font-size: 0.74rem;">${kg.toLocaleString("fr-FR")} kg × ${price.toFixed(2)} €/kg =</span>
                <span style="font-weight: 700; color: #52b788; font-family: monospace;">${formatCurrency(totalHT)}</span>
              </div>
            ` : ''}
          </div>
        `;
      } else {
        yieldCell = `
          <button type="button" class="btn-yield-action" onclick="openYieldModal('${h.id}')" title="Renseigner les kilos et le prix récolté">
            <span>⚖️ Entrer pesée (kg / prix)</span>
          </button>
        `;
      }
    } else {
      yieldCell = `
        <div style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">
          ⏳ En attente de coupe
        </div>
      `;
    }

    // Menu Déroulant Débardage épuré (statut direct sans encombrement)
    const haulClass = h.haulStatus === "debardee" ? "badge-haul-done" : (h.haulStatus === "non_necessaire" ? "badge-haul-none" : "badge-haul-todo");
    const haulSelect = `
      <select class="harvest-table-select ${haulClass}" onchange="changeHarvestHaul('${h.id}', this.value)" aria-label="Statut débardage">
        <option value="a_debarder" ${h.haulStatus === 'a_debarder' || !h.haulStatus ? 'selected' : ''}>🚜 À débarder</option>
        <option value="non_necessaire" ${h.haulStatus === 'non_necessaire' ? 'selected' : ''}>⚪ Non nécessaire</option>
        <option value="debardee" ${h.haulStatus === 'debardee' ? 'selected' : ''}>✅ Débardée</option>
      </select>
    `;

    // Localisation / Commune du client si disponible
    const clientObj = (clients || []).find(c => c.id === h.clientId || c.name === h.clientName);
    const clientLocation = clientObj && clientObj.location ? clientObj.location : "";

    return `
      <tr data-harvest-id="${escapeHTML(h.id)}">
        <td>
          <div style="font-weight: 700; color: var(--text-heading); font-size: 0.92rem; display: flex; align-items: center; gap: 0.4rem;">
            <span style="font-size: 1.05rem;">🍇</span>
            <span>${escapeHTML(h.clientName)}</span>
          </div>
          ${clientLocation ? `<div style="font-size: 0.78rem; color: var(--text-muted); margin-left: 1.45rem; margin-top: 2px;">📍 ${escapeHTML(clientLocation)}</div>` : ''}
        </td>
        <td>
          <div style="font-weight: 600; color: var(--text-heading); display: flex; align-items: center; gap: 0.35rem;">
            <span style="color: #52b788; font-size: 0.95rem;">📍</span>
            <span>${escapeHTML(h.parcelName)}</span>
          </div>
          ${h.terroir ? `<div style="font-size: 0.78rem; color: var(--text-muted); margin-left: 1.3rem; margin-top: 2px;">Terroir : ${escapeHTML(h.terroir)}</div>` : ''}
        </td>
        <td>
          <div style="font-family: monospace; font-weight: 700; color: #52b788; font-size: 0.92rem;">📐 ${formatSurface(h.surface)} ha</div>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">🍇 ${escapeHTML(h.grapeVariety || "Cépage non précisé")}</div>
        </td>
        <td>${leafSelect}</td>
        <td>${cutSelect}</td>
        <td>${yieldCell}</td>
        <td>${haulSelect}</td>
        <td>
          <div style="font-size: 0.86rem; font-weight: 600; color: var(--text-heading); display: flex; align-items: center; gap: 0.35rem;">
            <span>👤</span> <span>${escapeHTML(h.worker || "Non assigné")}</span>
          </div>
          ${h.harvestDate ? `<div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">📅 ${escapeHTML(h.harvestDate)}</div>` : ""}
          ${h.notes ? `<div style="font-size: 0.78rem; color: var(--text-muted); max-width: 170px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;" title="${escapeHTML(h.notes)}">📝 ${escapeHTML(h.notes)}</div>` : ""}
        </td>
        <td class="text-right">
          <div class="table-actions" style="justify-content: flex-end;">
            <button type="button" class="action-btn" onclick="openHarvestModal('${h.id}')" title="Modifier le suivi de la parcelle">✏️</button>
            <button type="button" class="action-btn" onclick="openYieldModal('${h.id}')" title="Pesée rapide (kg / caisses)">⚖️</button>
            <button type="button" class="action-btn action-btn-danger" onclick="deleteHarvestWork('${h.id}')" title="Supprimer du suivi des vendanges">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// Réinitialisation de l'ensemble des filtres vendanges
function resetVendangesFilters() {
  vendangesClientFilter = "all";
  vendangesClientFilters = [];
  const cCheckboxes = document.querySelectorAll("#list-vendanges-filter-client .vendanges-client-cb");
  cCheckboxes.forEach(cb => {
    cb.checked = false;
    const item = cb.closest(".filter-ms-item");
    if (item) item.classList.remove("is-checked");
  });
  updateVendangesClientFilterUI();

  populateVendangesParcelFilter();
  toggleAllVendangesParcels(true);

  populateVendangesTeamFilter();
  toggleAllVendangesTeams(true);

  toggleAllVendangesStages(true);
  vendangesSearchFilter = "";
  const sInput = document.getElementById("vendanges-search-input");
  if (sInput) sInput.value = "";
  const sClear = document.getElementById("vendanges-search-clear");
  if (sClear) sClear.style.display = "none";
  renderVendangesTable();
}

// Changement d'état direct via les menus déroulants du tableau
function changeHarvestLeaf(id, newStatus) {
  const item = (harvestWorks || []).find(h => h.id === id);
  if (!item) return;
  item.leafStatus = newStatus;

  // Récupération de la prestation configurée dans Prestations (ex: 550 €/ha)
  const leafSrv = (services || []).find(s => s.name === item.leafServiceName) ||
    (services || []).find(s => s.name && s.name.toLowerCase().includes("effeuillage")) ||
    { name: "Effeuillage manuel face levante", price: 550, rateType: "surface" };
  item.leafServiceName = leafSrv.name;
  if (!item.leafPrice || item.leafPrice === 37) {
    item.leafPrice = leafSrv.price;
  }

  saveHarvestWorks();

  if (newStatus === "effeuillee") {
    billLeafHarvestToDashboard(id);
  } else {
    renderVendangesKPIs();
    renderVendangesTable();
    const label = newStatus === "non_necessaire" ? "Non nécessaire" : "À effeuiller";
    showToast(`🍃 Effeuillage mis à jour : « ${label} » pour ${item.parcelName}.`, "info");
  }
}

function changeHarvestCut(id, newStatus) {
  const item = (harvestWorks || []).find(h => h.id === id);
  if (!item) return;
  item.cutStatus = newStatus;

  if (newStatus === "coupee") {
    // Si la pesée n'a pas encore de kilos, on prend l'estimation par surface pour envoyer immédiatement dans le Journal à facturer
    const kg = parseFloat(item.yieldKg) || 0;
    const surface = parseFloat(item.surface) || 1;
    const estKg = kg > 0 ? kg : (surface > 0 ? Math.round(surface * 6000) : 1000);
    const price = parseFloat(item.yieldPricePerKg) || 0.35;
    const srvName = item.harvestServiceName || "Coupe vendange (au kilo)";

    if (kg <= 0) {
      item.yieldKg = estKg;
      item.totalAmountHT = Math.round(estKg * price * 100) / 100;
    }
    syncHarvestToIntervention(item, srvName, item.yieldKg, item.boxesCount || 0, price);
    saveHarvestWorks();
    renderVendangesKPIs();
    renderVendangesTable();
    showToast(`🍇 Parcelle « ${item.parcelName} » coupée : intervention envoyée directement à facturer (${formatCurrency(item.totalAmountHT)}) !`, "success");
    if (kg <= 0) {
      setTimeout(() => openYieldModal(id), 250);
    }
  } else {
    saveHarvestWorks();
    renderVendangesKPIs();
    renderVendangesTable();
    showToast(`⏳ Parcelle « ${item.parcelName} » remise en attente de coupe.`, "info");
  }
}

function changeHarvestHaul(id, newStatus) {
  const item = (harvestWorks || []).find(h => h.id === id);
  if (!item) return;
  item.haulStatus = newStatus;

  // Récupération de la prestation configurée dans Prestations (ex: 0,15 €/kg)
  const haulSrv = (services || []).find(s => s.name === item.haulServiceName) ||
    (services || []).find(s => s.name && (s.name.toLowerCase().includes("débardage") || s.name.toLowerCase().includes("debardage"))) ||
    { name: "Débardage vendange (tracteur / porteur)", price: 0.15, rateType: "kilo" };
  item.haulServiceName = haulSrv.name;
  if (!item.haulPrice || item.haulPrice === 45) {
    item.haulPrice = haulSrv.price;
  }

  saveHarvestWorks();

  if (newStatus === "debardee") {
    billHaulHarvestToDashboard(id);
  } else {
    renderVendangesKPIs();
    renderVendangesTable();
    const label = newStatus === "non_necessaire" ? "Non nécessaire" : "À débarder";
    showToast(`🚜 Débardage mis à jour : « ${label} » pour ${item.parcelName}.`, "info");
  }
}

// Bascules rapides directes depuis le tableau
function quickToggleHarvestLeaf(id) {
  const item = (harvestWorks || []).find(h => h.id === id);
  if (!item) return;

  if (item.leafStatus === "a_effeuiller") {
    item.leafStatus = "effeuillee";
    const leafSrv = (services || []).find(s => s.name === item.leafServiceName) ||
      (services || []).find(s => s.name && s.name.toLowerCase().includes("effeuillage")) ||
      { name: "Effeuillage manuel face levante", price: 550, rateType: "surface" };
    item.leafServiceName = leafSrv.name;
    if (!item.leafPrice || item.leafPrice === 37) {
      item.leafPrice = leafSrv.price;
    }
    saveHarvestWorks();
    billLeafHarvestToDashboard(id);
  } else if (item.leafStatus === "effeuillee") {
    item.leafStatus = "non_necessaire";
    saveHarvestWorks();
    renderVendangesKPIs();
    renderVendangesTable();
    showToast(`🚫 Effeuillage marqué non nécessaire pour « ${item.parcelName} ».`, "info");
  } else {
    item.leafStatus = "a_effeuiller";
    saveHarvestWorks();
    renderVendangesKPIs();
    renderVendangesTable();
    showToast(`🍃 Parcelle « ${item.parcelName} » marquée à effeuiller.`, "info");
  }
}

function quickToggleHarvestCut(id) {
  const item = (harvestWorks || []).find(h => h.id === id);
  if (!item) return;

  if (item.cutStatus === "a_couper") {
    item.cutStatus = "coupee";
    const kg = parseFloat(item.yieldKg) || 0;
    const surface = parseFloat(item.surface) || 1;
    const estKg = kg > 0 ? kg : (surface > 0 ? Math.round(surface * 6000) : 1000);
    const price = parseFloat(item.yieldPricePerKg) || 0.35;
    const srvName = item.harvestServiceName || "Coupe vendange (au kilo)";

    if (kg <= 0) {
      item.yieldKg = estKg;
      item.totalAmountHT = Math.round(estKg * price * 100) / 100;
    }
    syncHarvestToIntervention(item, srvName, item.yieldKg, item.boxesCount || 0, price);
    saveHarvestWorks();
    renderVendangesKPIs();
    renderVendangesTable();
    showToast(`🍇 Parcelle « ${item.parcelName} » coupée : intervention envoyée directement à facturer (${formatCurrency(item.totalAmountHT)}) !`, "success");
    if (kg <= 0) {
      setTimeout(() => openYieldModal(id), 250);
    }
  } else {
    item.cutStatus = "a_couper";
    saveHarvestWorks();
    renderVendangesKPIs();
    renderVendangesTable();
    showToast(`⏳ Parcelle « ${item.parcelName} » remise à couper.`, "info");
  }
}

function quickToggleHarvestHaul(id) {
  const item = (harvestWorks || []).find(h => h.id === id);
  if (!item) return;

  if (item.haulStatus === "a_debarder") {
    item.haulStatus = "debardee";
    const haulSrv = (services || []).find(s => s.name === item.haulServiceName) ||
      (services || []).find(s => s.name && (s.name.toLowerCase().includes("débardage") || s.name.toLowerCase().includes("debardage"))) ||
      { name: "Débardage vendange (tracteur / porteur)", price: 0.15, rateType: "kilo" };
    item.haulServiceName = haulSrv.name;
    if (!item.haulPrice || item.haulPrice === 45) {
      item.haulPrice = haulSrv.price;
    }
    saveHarvestWorks();
    billHaulHarvestToDashboard(id);
  } else if (item.haulStatus === "debardee") {
    item.haulStatus = "non_necessaire";
    saveHarvestWorks();
    renderVendangesKPIs();
    renderVendangesTable();
    showToast(`⚪ Débardage marqué non nécessaire pour « ${item.parcelName} ».`, "info");
  } else {
    item.haulStatus = "a_debarder";
    saveHarvestWorks();
    renderVendangesKPIs();
    renderVendangesTable();
    showToast(`🚜 Parcelle « ${item.parcelName} » à débarder.`, "info");
  }
}

// Dropdown helpers for Modal 11 (Harvest Modal)
function openHarvestClientDropdown() {
  const wrap = document.getElementById("wrap-harvest-client-dropdown");
  const menu = document.getElementById("menu-harvest-client-dropdown");
  const trigger = document.getElementById("btn-harvest-client-trigger");
  closeHarvestParcelDropdown();
  if (wrap && menu) {
    wrap.classList.add("is-open");
    menu.style.display = "flex";
    if (trigger) trigger.setAttribute("aria-expanded", "true");
    const searchInput = document.getElementById("search-harvest-clients");
    if (searchInput && searchInput.offsetParent !== null) {
      setTimeout(() => searchInput.focus(), 60);
    }
  }
}

function closeHarvestClientDropdown() {
  const wrap = document.getElementById("wrap-harvest-client-dropdown");
  const menu = document.getElementById("menu-harvest-client-dropdown");
  const trigger = document.getElementById("btn-harvest-client-trigger");
  if (wrap && menu) {
    wrap.classList.remove("is-open");
    menu.style.display = "none";
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  }
}

function toggleHarvestClientDropdown() {
  const wrap = document.getElementById("wrap-harvest-client-dropdown");
  if (wrap && wrap.classList.contains("is-open")) {
    closeHarvestClientDropdown();
  } else {
    openHarvestClientDropdown();
  }
}

function openHarvestParcelDropdown() {
  const wrap = document.getElementById("wrap-harvest-parcel-dropdown");
  const menu = document.getElementById("menu-harvest-parcel-dropdown");
  const trigger = document.getElementById("btn-harvest-parcel-trigger");
  if (trigger && trigger.disabled) return;
  closeHarvestClientDropdown();
  if (wrap && menu) {
    wrap.classList.add("is-open");
    menu.style.display = "flex";
    if (trigger) trigger.setAttribute("aria-expanded", "true");
  }
}

function closeHarvestParcelDropdown() {
  const wrap = document.getElementById("wrap-harvest-parcel-dropdown");
  const menu = document.getElementById("menu-harvest-parcel-dropdown");
  const trigger = document.getElementById("btn-harvest-parcel-trigger");
  if (wrap && menu) {
    wrap.classList.remove("is-open");
    menu.style.display = "none";
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  }
}

function toggleHarvestParcelDropdown() {
  const wrap = document.getElementById("wrap-harvest-parcel-dropdown");
  if (wrap && wrap.classList.contains("is-open")) {
    closeHarvestParcelDropdown();
  } else {
    openHarvestParcelDropdown();
  }
}

let _harvestModalDropdownEventsInitialized = false;
function setupHarvestModalDropdownEvents() {
  if (_harvestModalDropdownEventsInitialized) return;
  _harvestModalDropdownEventsInitialized = true;

  const clientTrigger = document.getElementById("btn-harvest-client-trigger");
  if (clientTrigger) {
    clientTrigger.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleHarvestClientDropdown();
    });
  }

  const parcelTrigger = document.getElementById("btn-harvest-parcel-trigger");
  if (parcelTrigger) {
    parcelTrigger.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleHarvestParcelDropdown();
    });
  }

  const clientMenu = document.getElementById("menu-harvest-client-dropdown");
  if (clientMenu) {
    clientMenu.addEventListener("click", (e) => e.stopPropagation());
  }

  const parcelMenu = document.getElementById("menu-harvest-parcel-dropdown");
  if (parcelMenu) {
    parcelMenu.addEventListener("click", (e) => e.stopPropagation());
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#wrap-harvest-client-dropdown")) {
      closeHarvestClientDropdown();
    }
    if (!e.target.closest("#wrap-harvest-parcel-dropdown")) {
      closeHarvestParcelDropdown();
    }
  });

  const searchInput = document.getElementById("search-harvest-clients");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const val = e.target.value.toLowerCase().trim();
      const items = document.querySelectorAll("#harvest-client-checkbox-list .harvest-client-item");
      items.forEach(item => {
        const name = item.dataset.clientName || "";
        const commune = item.dataset.commune || "";
        const match = !val || name.includes(val) || commune.includes(val);
        item.style.display = match ? "flex" : "none";
      });
    });
  }

  const btnToggleClients = document.getElementById("btn-toggle-all-harvest-clients");
  if (btnToggleClients) {
    btnToggleClients.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const allCbs = Array.from(document.querySelectorAll("#harvest-client-checkbox-list .harvest-client-cb"));
      if (allCbs.length === 0) return;
      const allChecked = allCbs.every(cb => cb.checked);
      allCbs.forEach(cb => {
        cb.checked = !allChecked;
        const item = cb.closest(".harvest-client-item");
        if (item) {
          if (!allChecked) item.classList.add("selected");
          else item.classList.remove("selected");
        }
      });
      onHarvestClientsChanged();
    });
  }

  const btnToggleParcels = document.getElementById("btn-toggle-all-harvest-parcels");
  if (btnToggleParcels) {
    btnToggleParcels.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const allCbs = Array.from(document.querySelectorAll("#harvest-parcel-checkbox-list .harvest-parcel-cb"));
      if (allCbs.length === 0) return;
      const allChecked = allCbs.every(cb => cb.checked);
      allCbs.forEach(cb => {
        cb.checked = !allChecked;
        const item = cb.closest(".harvest-parcel-item");
        if (item) {
          if (!allChecked) item.classList.add("selected");
          else item.classList.remove("selected");
        }
      });
      updateHarvestParcelsSummary();
    });
  }
}

function renderHarvestClientsList(preselectedClientIds = []) {
  const listEl = document.getElementById("harvest-client-checkbox-list");
  const searchWrap = document.getElementById("harvest-clients-search-wrap");
  const toggleBtn = document.getElementById("btn-toggle-all-harvest-clients");

  if (!listEl) return;

  if (!clients || clients.length === 0) {
    listEl.innerHTML = '<div class="parcel-list-empty">Aucun domaine enregistré. Créez d\'abord un client.</div>';
    if (searchWrap) searchWrap.style.display = "none";
    if (toggleBtn) toggleBtn.style.display = "none";
    return;
  }

  if (searchWrap) {
    searchWrap.style.display = clients.length > 4 ? "block" : "none";
  }
  if (toggleBtn) {
    toggleBtn.style.display = "inline-block";
    toggleBtn.textContent = "Tout cocher";
  }

  listEl.innerHTML = clients.map(c => {
    const pCount = (c.parcels || []).length;
    const pCountText = pCount === 0 ? "0 parcelle" : (pCount === 1 ? "1 parcelle" : `${pCount} parcelles`);
    const isChecked = preselectedClientIds.includes(c.id);
    return `
      <label class="parcel-checkbox-item harvest-client-item ${isChecked ? 'selected' : ''}" data-client-id="${c.id}" data-client-name="${escapeHTML(c.name.toLowerCase())}" data-commune="${escapeHTML(((c.location || c.commune) || '').toLowerCase())}">
        <input type="checkbox" class="harvest-client-cb" value="${c.id}" id="cb-harv-cli-${c.id}" ${isChecked ? 'checked' : ''}>
        <div class="parcel-item-info">
          <div class="parcel-item-text">
            <span class="parcel-item-name">🏰 ${escapeHTML(c.name)}</span>
            ${(c.location || c.commune) ? `<span class="parcel-item-sub">📍 ${escapeHTML(c.location || c.commune)}</span>` : ''}
          </div>
          <span class="parcel-item-surface-badge">${pCountText}</span>
        </div>
      </label>
    `;
  }).join("");

  const clientCbs = listEl.querySelectorAll(".harvest-client-cb");
  clientCbs.forEach(cb => {
    cb.addEventListener("change", () => {
      const item = cb.closest(".harvest-client-item");
      if (item) {
        if (cb.checked) item.classList.add("selected");
        else item.classList.remove("selected");
      }
      onHarvestClientsChanged(cb.value, cb.checked);
    });
  });
}

function onHarvestClientsChanged(changedClientId = null, isChecked = false) {
  const allClientCbs = Array.from(document.querySelectorAll("#harvest-client-checkbox-list .harvest-client-cb"));
  const checkedClientCbs = allClientCbs.filter(cb => cb.checked);
  const checkedClientIds = checkedClientCbs.map(cb => cb.value);

  const clientTriggerText = document.getElementById("harvest-client-trigger-text");
  const clientTriggerBadge = document.getElementById("harvest-client-trigger-badge");
  const parcelTrigger = document.getElementById("btn-harvest-parcel-trigger");
  const parcelTriggerText = document.getElementById("harvest-parcel-trigger-text");

  const count = checkedClientIds.length;
  if (clientTriggerText) {
    if (count === 0) {
      clientTriggerText.textContent = "Sélectionner les domaines...";
    } else if (count === 1) {
      const c = (clients || []).find(item => item.id === checkedClientIds[0]);
      clientTriggerText.textContent = c ? c.name : "1 domaine sélectionné";
    } else if (count === 2) {
      const c1 = (clients || []).find(item => item.id === checkedClientIds[0]);
      const c2 = (clients || []).find(item => item.id === checkedClientIds[1]);
      clientTriggerText.textContent = `${c1 ? c1.name : ''}, ${c2 ? c2.name : ''}`;
    } else {
      clientTriggerText.textContent = `${count} domaines sélectionnés`;
    }
  }

  if (clientTriggerBadge) {
    if (count > 0) {
      clientTriggerBadge.textContent = count;
      clientTriggerBadge.style.display = "inline-block";
    } else {
      clientTriggerBadge.style.display = "none";
    }
  }

  const hiddenClientInput = document.getElementById("input-harvest-client");
  if (hiddenClientInput) {
    hiddenClientInput.value = checkedClientIds.join(",");
  }

  if (parcelTrigger) {
    if (count === 0) {
      parcelTrigger.disabled = true;
      if (parcelTriggerText) parcelTriggerText.textContent = "Sélectionnez d'abord un domaine...";
      closeHarvestParcelDropdown();
    } else {
      parcelTrigger.disabled = false;
    }
  }

  const toggleBtn = document.getElementById("btn-toggle-all-harvest-clients");
  if (toggleBtn) {
    const allChecked = allClientCbs.length > 0 && checkedClientCbs.length === allClientCbs.length;
    toggleBtn.textContent = allChecked ? "Tout décocher" : "Tout cocher";
  }

  updateHarvestParcelsList(changedClientId, isChecked);
}

function updateHarvestParcelsList(changedClientId = null, isClientChecked = false, preselectedParcelIds = []) {
  const parcelListEl = document.getElementById("harvest-parcel-checkbox-list");
  const toggleAllParcelsBtn = document.getElementById("btn-toggle-all-harvest-parcels");

  if (!parcelListEl) return;

  const checkedClientCbs = Array.from(document.querySelectorAll("#harvest-client-checkbox-list .harvest-client-cb:checked"));
  const checkedClientIds = checkedClientCbs.map(cb => cb.value);

  if (checkedClientIds.length === 0) {
    parcelListEl.innerHTML = '<div class="parcel-list-empty">Sélectionnez d\'abord au moins un client pour afficher ses parcelles.</div>';
    if (toggleAllParcelsBtn) toggleAllParcelsBtn.style.display = "none";
    updateHarvestParcelsSummary();
    return;
  }

  if (toggleAllParcelsBtn) toggleAllParcelsBtn.style.display = "inline-block";

  const previouslyCheckedKeys = new Set(preselectedParcelIds);
  const currentParcelCbs = parcelListEl.querySelectorAll(".harvest-parcel-cb:checked");
  currentParcelCbs.forEach(cb => {
    previouslyCheckedKeys.add(`${cb.dataset.clientId}:::${cb.dataset.parcelId || cb.value}`);
  });

  const isMultiClients = checkedClientIds.length > 1;
  let html = "";

  checkedClientIds.forEach(cId => {
    const client = (clients || []).find(c => c.id === cId);
    if (!client) return;

    if (isMultiClients) {
      html += `
        <div class="planned-parcel-domain-header" data-domain-id="${client.id}">
          <span>🏰 ${escapeHTML(client.name)}</span>
          <button type="button" class="btn-group-toggle-domain-harvest-parcels" data-client-id="${client.id}">Tout cocher</button>
        </div>
      `;
    }

    if (client.parcels && client.parcels.length > 0) {
      client.parcels.forEach(p => {
        const key = `${client.id}:::${p.id || p.name}`;
        const shouldBeChecked = preselectedParcelIds.length > 0
          ? (preselectedParcelIds.includes(p.id) || preselectedParcelIds.includes(key))
          : ((changedClientId === client.id && isClientChecked) ? true : (previouslyCheckedKeys.has(key) || changedClientId === null));

        html += `
          <label class="parcel-checkbox-item harvest-parcel-item ${shouldBeChecked ? 'selected' : ''}" data-client-id="${client.id}">
            <input type="checkbox" class="harvest-parcel-cb" 
                   data-client-id="${client.id}" 
                   data-client-name="${escapeHTML(client.name)}"
                   data-parcel-id="${p.id || ''}"
                   data-parcel-name="${escapeHTML(p.name)}"
                   data-surface="${p.surface || 0}" 
                   data-grape="${escapeHTML(p.grape || '')}"
                   value="${p.id || escapeHTML(p.name)}" 
                   ${shouldBeChecked ? 'checked' : ''}>
            <div class="parcel-item-info">
              <div class="parcel-item-text">
                <span class="parcel-item-name">📍 ${escapeHTML(p.name)}</span>
                ${p.grape ? `<span class="parcel-item-sub">🍇 ${escapeHTML(p.grape)}</span>` : ''}
              </div>
              <span class="parcel-item-surface-badge">${formatSurface(p.surface)} ha</span>
            </div>
          </label>
        `;
      });
    } else {
      const key = `${client.id}:::Toutes parcelles`;
      const shouldBeChecked = preselectedParcelIds.length > 0
        ? preselectedParcelIds.includes(key)
        : ((changedClientId === client.id && isClientChecked) ? true : (previouslyCheckedKeys.has(key) || changedClientId === null));

      html += `
        <label class="parcel-checkbox-item harvest-parcel-item ${shouldBeChecked ? 'selected' : ''}" data-client-id="${client.id}">
          <input type="checkbox" class="harvest-parcel-cb fallback-domain-cb" 
                 data-client-id="${client.id}" 
                 data-client-name="${escapeHTML(client.name)}"
                 data-parcel-id=""
                 data-parcel-name="Toutes parcelles"
                 data-surface="0" 
                 data-grape=""
                 value="Toutes parcelles" 
                 ${shouldBeChecked ? 'checked' : ''}>
          <div class="parcel-item-info">
            <div class="parcel-item-text">
              <span class="parcel-item-name">📍 Tout le domaine</span>
              <span class="parcel-item-sub">Toutes parcelles / Général</span>
            </div>
            <span class="parcel-item-surface-badge">Ensemble</span>
          </div>
        </label>
      `;
    }
  });

  parcelListEl.innerHTML = html;

  const parcelCbs = parcelListEl.querySelectorAll(".harvest-parcel-cb");
  parcelCbs.forEach(cb => {
    cb.addEventListener("change", () => {
      const item = cb.closest(".harvest-parcel-item");
      if (item) {
        if (cb.checked) item.classList.add("selected");
        else item.classList.remove("selected");
      }
      updateHarvestParcelsSummary();
    });
  });

  const domainToggleBtns = parcelListEl.querySelectorAll(".btn-group-toggle-domain-harvest-parcels");
  domainToggleBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const domainId = btn.dataset.clientId;
      const domainCbs = Array.from(parcelListEl.querySelectorAll(`.harvest-parcel-cb[data-client-id="${domainId}"]`));
      const allChecked = domainCbs.length > 0 && domainCbs.every(cb => cb.checked);
      domainCbs.forEach(cb => {
        cb.checked = !allChecked;
        const item = cb.closest(".harvest-parcel-item");
        if (item) {
          if (!allChecked) item.classList.add("selected");
          else item.classList.remove("selected");
        }
      });
      btn.textContent = allChecked ? "Tout cocher" : "Tout décocher";
      updateHarvestParcelsSummary();
    });
  });

  updateHarvestParcelsSummary();
}

function updateHarvestParcelsSummary() {
  const parcelListEl = document.getElementById("harvest-parcel-checkbox-list");
  const toggleAllBtn = document.getElementById("btn-toggle-all-harvest-parcels");
  const parcelTriggerText = document.getElementById("harvest-parcel-trigger-text");
  const parcelTriggerBadge = document.getElementById("harvest-parcel-trigger-badge");
  const recapBar = document.getElementById("harvest-selection-recap-bar");
  const recapClients = document.getElementById("harvest-recap-clients-count");
  const recapParcels = document.getElementById("harvest-recap-parcels-count");
  const recapSurface = document.getElementById("harvest-recap-surface-total");
  const banner = document.getElementById("harvest-parcel-info-banner");
  const surfBadge = document.getElementById("harvest-parcel-surface-badge");
  const varBadge = document.getElementById("harvest-parcel-variety-badge");

  if (!parcelListEl) return;

  const allParcelCbs = Array.from(parcelListEl.querySelectorAll(".harvest-parcel-cb"));
  const checkedParcelCbs = Array.from(parcelListEl.querySelectorAll(".harvest-parcel-cb:checked"));

  let totalSurface = 0;
  checkedParcelCbs.forEach(cb => {
    const s = parseFloat(cb.dataset.surface || 0);
    if (!isNaN(s)) totalSurface += s;
  });

  const count = checkedParcelCbs.length;
  const checkedClientsCount = document.querySelectorAll("#harvest-client-checkbox-list .harvest-client-cb:checked").length;

  if (toggleAllBtn) {
    toggleAllBtn.style.display = allParcelCbs.length > 0 ? "inline-block" : "none";
    toggleAllBtn.textContent = (checkedParcelCbs.length === allParcelCbs.length && allParcelCbs.length > 0)
      ? "Tout décocher"
      : "Tout cocher";
  }

  if (parcelTriggerText) {
    if (checkedClientsCount === 0) {
      parcelTriggerText.textContent = "Sélectionnez d'abord un domaine...";
    } else if (count === 0) {
      parcelTriggerText.textContent = "Sélectionner les parcelles...";
    } else if (count === 1) {
      const pName = checkedParcelCbs[0].dataset.parcelName || checkedParcelCbs[0].value;
      parcelTriggerText.textContent = `${pName} (${formatSurface(totalSurface)} ha)`;
    } else {
      parcelTriggerText.textContent = `${count} parcelles (${formatSurface(totalSurface)} ha)`;
    }
  }

  if (parcelTriggerBadge) {
    if (count > 0) {
      parcelTriggerBadge.textContent = count;
      parcelTriggerBadge.style.display = "inline-block";
    } else {
      parcelTriggerBadge.style.display = "none";
    }
  }

  if (recapBar) {
    if (checkedClientsCount > 0 && count > 0) {
      recapBar.style.display = "flex";
      if (recapClients) recapClients.textContent = `🏰 ${checkedClientsCount} domaine${checkedClientsCount > 1 ? 's' : ''}`;
      if (recapParcels) recapParcels.textContent = `📍 ${count} parcelle${count > 1 ? 's' : ''}`;
      if (recapSurface) recapSurface.textContent = `📐 ${formatSurface(totalSurface)} ha cumulés`;
    } else {
      recapBar.style.display = "none";
    }
  }

  const hiddenParcelInput = document.getElementById("input-harvest-parcel");
  if (hiddenParcelInput) {
    hiddenParcelInput.value = checkedParcelCbs.map(cb => cb.dataset.parcelId || cb.value).join(",");
  }

  if (banner) {
    if (count === 1) {
      const firstCb = checkedParcelCbs[0];
      if (surfBadge) surfBadge.textContent = `📐 ${formatSurface(firstCb.dataset.surface || 0)} ha`;
      if (varBadge) varBadge.textContent = `🍇 ${firstCb.dataset.grape || "Cépage non précisé"}`;
      banner.style.display = "flex";
    } else {
      banner.style.display = "none";
    }
  }
}

// Modal Vendanges (Ajout / Édition)
function openHarvestModal(editId = null) {
  const modal = document.getElementById("harvest-modal");
  const title = document.getElementById("harvest-modal-title");
  const editInput = document.getElementById("harvest-edit-id");
  const workerSelect = document.getElementById("input-harvest-worker");
  const banner = document.getElementById("harvest-parcel-info-banner");
  if (!modal) return;

  closeHarvestClientDropdown();
  closeHarvestParcelDropdown();

  // Remplir les salariés / équipe
  if (workerSelect) {
    const curWorker = workerSelect.value;
    workerSelect.innerHTML = '<option value="">Non assigné (À définir)</option>';
    (teamUsers || []).forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.name;
      opt.textContent = `${u.name} (${u.role})`;
      workerSelect.appendChild(opt);
    });
    if (curWorker) workerSelect.value = curWorker;
  }

  if (editId) {
    const item = (harvestWorks || []).find(h => h.id === editId);
    if (!item) return;

    if (title) title.textContent = "Modifier la vendange de parcelle";
    if (editInput) editInput.value = item.id;

    // Charger les listes avec le client et la parcelle de cet item
    renderHarvestClientsList([item.clientId]);
    onHarvestClientsChanged();
    updateHarvestParcelsList(null, false, [item.parcelId || `${item.clientId}:::${item.parcelName}`]);
    updateHarvestParcelsSummary();

    // Menus déroulants Effeuillage, Coupe & Débardage
    const leafSelect = document.getElementById("input-harvest-leaf");
    if (leafSelect) leafSelect.value = item.leafStatus || "a_effeuiller";

    const leafSrvSelect = document.getElementById("input-harvest-leaf-service");
    const leafPriceInput = document.getElementById("input-harvest-leaf-price");
    let initialLeafName = item.leafServiceName || "Effeuillage manuel face levante";
    if (!initialLeafName.toLowerCase().includes("effeuillage")) {
      initialLeafName = "Effeuillage manuel face levante";
    }
    if (leafSrvSelect) populateHarvestLeafServicesSelect(leafSrvSelect, initialLeafName);
    if (leafPriceInput) {
      leafPriceInput.value = (item.leafPrice && item.leafPrice !== 37) ? item.leafPrice : (leafSrvSelect?.selectedOptions[0]?.dataset.price || 550);
      leafPriceInput.dataset.autoFilled = "false";
    }
    onHarvestModalLeafChange();

    const cutSelect = document.getElementById("input-harvest-cut");
    if (cutSelect) cutSelect.value = item.cutStatus || "a_couper";

    const harvestSrvSelect = document.getElementById("input-harvest-service");
    const harvestPriceInput = document.getElementById("input-harvest-price-kg");
    const harvestBillCheck = document.getElementById("input-harvest-bill-dashboard");
    const kgInput = document.getElementById("input-harvest-yield-kg");
    const boxesInput = document.getElementById("input-harvest-yield-boxes");

    let initialHarvestCutName = item.harvestServiceName || "Coupe vendange (au kilo)";
    if (initialHarvestCutName.toLowerCase().includes("débardage") || initialHarvestCutName.toLowerCase().includes("debardage")) {
      initialHarvestCutName = "Coupe vendange (au kilo)";
    }
    if (harvestSrvSelect) populateHarvestServicesSelect(harvestSrvSelect, initialHarvestCutName);
    if (harvestPriceInput) {
      harvestPriceInput.value = item.yieldPricePerKg || (harvestSrvSelect?.selectedOptions[0]?.dataset.price || 0.35);
      harvestPriceInput.dataset.autoFilled = item.yieldPricePerKg ? "false" : "true";
    }
    if (kgInput) kgInput.value = item.yieldKg || "";
    if (boxesInput) boxesInput.value = item.boxesCount || "";
    if (harvestBillCheck) harvestBillCheck.checked = true;
    onHarvestModalCutChange();

    const haulSelect = document.getElementById("input-harvest-haul");
    if (haulSelect) haulSelect.value = item.haulStatus || "a_debarder";

    const haulSrvSelect = document.getElementById("input-harvest-haul-service");
    const haulPriceInput = document.getElementById("input-harvest-haul-price");
    let initialHaulName = item.haulServiceName || "Débardage vendange (tracteur / porteur)";
    if (initialHaulName.toLowerCase().includes("coupe") || initialHaulName.toLowerCase().includes("récolte") || initialHaulName.toLowerCase().includes("recolte")) {
      initialHaulName = "Débardage vendange (tracteur / porteur)";
    }
    if (haulSrvSelect) populateHarvestHaulServicesSelect(haulSrvSelect, initialHaulName);
    if (haulPriceInput) {
      haulPriceInput.value = (item.haulPrice && item.haulPrice !== 45) ? item.haulPrice : (haulSrvSelect?.selectedOptions[0]?.dataset.price || 0.15);
      haulPriceInput.dataset.autoFilled = "false";
    }
    onHarvestModalHaulChange();

    // Salarié, Date & Notes
    if (workerSelect) {
      if (item.worker && !Array.from(workerSelect.options).some(o => o.value === item.worker)) {
        const opt = document.createElement("option");
        opt.value = item.worker;
        opt.textContent = `${item.worker} (Équipe)`;
        workerSelect.appendChild(opt);
      }
      workerSelect.value = item.worker || "";
    }
    const dateInput = document.getElementById("input-harvest-date");
    if (dateInput) dateInput.value = item.harvestDate || "";
    const notesInput = document.getElementById("input-harvest-notes");
    if (notesInput) notesInput.value = item.notes || "";

  } else {
    // Mode création
    if (title) title.textContent = "Nouvelle parcelle à vendanger";
    if (editInput) editInput.value = "";
    if (banner) banner.style.display = "none";

    renderHarvestClientsList([]);
    updateHarvestParcelsList(null, false, []);
    onHarvestClientsChanged();

    // Défauts menus déroulants
    const leafSelect = document.getElementById("input-harvest-leaf");
    if (leafSelect) leafSelect.value = "a_effeuiller";

    const leafSrvSelect = document.getElementById("input-harvest-leaf-service");
    const leafPriceInput = document.getElementById("input-harvest-leaf-price");
    if (leafSrvSelect) populateHarvestLeafServicesSelect(leafSrvSelect, "Effeuillage manuel face levante");
    if (leafPriceInput) {
      leafPriceInput.value = leafSrvSelect?.selectedOptions[0]?.dataset.price || 550;
      leafPriceInput.dataset.autoFilled = "true";
    }
    onHarvestModalLeafChange();

    const cutSelect = document.getElementById("input-harvest-cut");
    if (cutSelect) cutSelect.value = "a_couper";

    const harvestSrvSelect = document.getElementById("input-harvest-service");
    const harvestPriceInput = document.getElementById("input-harvest-price-kg");
    const harvestBillCheck = document.getElementById("input-harvest-bill-dashboard");
    const kgInput = document.getElementById("input-harvest-yield-kg");
    const boxesInput = document.getElementById("input-harvest-yield-boxes");

    if (harvestSrvSelect) populateHarvestServicesSelect(harvestSrvSelect, "Coupe vendange (au kilo)");
    if (harvestPriceInput) {
      harvestPriceInput.value = harvestSrvSelect?.selectedOptions[0]?.dataset.price || 0.35;
      harvestPriceInput.dataset.autoFilled = "true";
    }
    if (kgInput) kgInput.value = "";
    if (boxesInput) boxesInput.value = "";
    if (harvestBillCheck) harvestBillCheck.checked = true;
    onHarvestModalCutChange();

    const haulSelect = document.getElementById("input-harvest-haul");
    if (haulSelect) haulSelect.value = "a_debarder";

    const haulSrvSelect = document.getElementById("input-harvest-haul-service");
    const haulPriceInput = document.getElementById("input-harvest-haul-price");
    if (haulSrvSelect) populateHarvestHaulServicesSelect(haulSrvSelect, "Débardage vendange (tracteur / porteur)");
    if (haulPriceInput) {
      haulPriceInput.value = haulSrvSelect?.selectedOptions[0]?.dataset.price || 0.15;
      haulPriceInput.dataset.autoFilled = "true";
    }
    onHarvestModalHaulChange();

    const dateInput = document.getElementById("input-harvest-date");
    if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];

    const notesInput = document.getElementById("input-harvest-notes");
    if (notesInput) notesInput.value = "";
  }

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  if (typeof lockBodyScroll === "function") lockBodyScroll();
  const modalBody = modal.querySelector(".modal-body");
  if (modalBody) modalBody.scrollTop = 0;
}

function closeHarvestModal() {
  const modal = document.getElementById("harvest-modal");
  if (modal) {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    if (typeof unlockBodyScroll === "function") unlockBodyScroll();
  }
}

function handleHarvestClientChange() {
  // Rétrocompatibilité
  onHarvestClientsChanged();
}

function handleHarvestParcelChange() {
  // Rétrocompatibilité
  updateHarvestParcelsSummary();
}

function handleHarvestFormSubmit(e) {
  if (e) e.preventDefault();

  const editId = document.getElementById("harvest-edit-id")?.value;
  const checkedParcelCbs = Array.from(document.querySelectorAll("#harvest-parcel-checkbox-list .harvest-parcel-cb:checked"));

  if (!editId && checkedParcelCbs.length === 0) {
    showToast("Veuillez sélectionner au moins une parcelle à vendanger.", "warning");
    return;
  }

  // Étape 1 : Effeuillage
  const leafStatus = document.getElementById("input-harvest-leaf")?.value || "a_effeuiller";
  const leafServiceName = leafStatus !== "non_necessaire"
    ? (document.getElementById("input-harvest-leaf-service")?.value || "Effeuillage manuel face levante")
    : "";
  const leafPrice = leafStatus !== "non_necessaire"
    ? (parseFloat(document.getElementById("input-harvest-leaf-price")?.value) || 550)
    : 0;
  const leafBillToDashboard = document.getElementById("input-harvest-leaf-bill-dashboard")?.checked ?? true;

  // Étape 2 : Coupe / Récolte
  const cutStatus = document.getElementById("input-harvest-cut")?.value || "a_couper";
  const harvestServiceName = document.getElementById("input-harvest-service")?.value || "Coupe vendange (au kilo)";
  const yieldPricePerKg = parseFloat(document.getElementById("input-harvest-price-kg")?.value) || 0.35;
  const yieldKg = parseFloat(document.getElementById("input-harvest-yield-kg")?.value) || 0;
  const boxesCount = parseInt(document.getElementById("input-harvest-yield-boxes")?.value, 10) || 0;
  const billToDashboard = document.getElementById("input-harvest-bill-dashboard")?.checked ?? true;
  const totalAmountHT = Math.round(yieldKg * yieldPricePerKg * 100) / 100;

  // Étape 3 : Débardage
  const haulStatus = document.getElementById("input-harvest-haul")?.value || "a_debarder";
  const haulServiceName = haulStatus !== "non_necessaire"
    ? (document.getElementById("input-harvest-haul-service")?.value || "Débardage vendange (tracteur / porteur)")
    : "";
  const haulPrice = haulStatus !== "non_necessaire"
    ? (parseFloat(document.getElementById("input-harvest-haul-price")?.value) || 0.15)
    : 0;
  const haulBillToDashboard = document.getElementById("input-harvest-haul-bill-dashboard")?.checked ?? true;

  const worker = document.getElementById("input-harvest-worker")?.value || "";
  const harvestDate = document.getElementById("input-harvest-date")?.value || "";
  const notes = document.getElementById("input-harvest-notes")?.value || "";

  if (editId) {
    const idx = (harvestWorks || []).findIndex(h => h.id === editId);
    if (idx !== -1) {
      const firstCb = checkedParcelCbs[0];
      const cId = firstCb ? firstCb.dataset.clientId : harvestWorks[idx].clientId;
      const clientName = firstCb ? firstCb.dataset.clientName : harvestWorks[idx].clientName;
      const pId = firstCb ? firstCb.dataset.parcelId : harvestWorks[idx].parcelId;
      const pName = firstCb ? (firstCb.dataset.parcelName || firstCb.value) : harvestWorks[idx].parcelName;
      const surface = firstCb ? (parseFloat(firstCb.dataset.surface) || 0) : harvestWorks[idx].surface;
      const grapeVariety = firstCb ? (firstCb.dataset.grape || "") : harvestWorks[idx].grapeVariety;

      harvestWorks[idx] = {
        ...harvestWorks[idx],
        clientId: cId,
        clientName,
        parcelId: pId,
        parcelName: pName,
        surface,
        grapeVariety,
        leafStatus,
        leafServiceName,
        leafPrice,
        cutStatus,
        yieldKg: cutStatus === "coupee" ? yieldKg : 0,
        boxesCount: cutStatus === "coupee" ? boxesCount : 0,
        yieldPricePerKg: yieldPricePerKg || 0.35,
        harvestServiceName: harvestServiceName || "Coupe vendange (au kilo)",
        totalAmountHT: cutStatus === "coupee" ? totalAmountHT : 0,
        haulStatus,
        haulServiceName,
        haulPrice,
        worker,
        harvestDate,
        notes
      };

      const targetItem = harvestWorks[idx];
      if (leafStatus === "effeuillee" && leafBillToDashboard) {
        billLeafHarvestToDashboard(targetItem.id, true);
      }
      if (cutStatus === "coupee" && billToDashboard && yieldKg > 0) {
        syncHarvestToIntervention(targetItem, harvestServiceName, yieldKg, boxesCount, yieldPricePerKg);
      }
      if (haulStatus === "debardee" && haulBillToDashboard) {
        billHaulHarvestToDashboard(targetItem.id, true);
      }

      showToast(`Suivi vendange mis à jour pour « ${pName} » !`, "success");
    }
  } else {
    // Mode création : on ajoute chaque parcelle cochée
    let addedCount = 0;
    checkedParcelCbs.forEach(cb => {
      const cId = cb.dataset.clientId;
      const clientName = cb.dataset.clientName || "Domaine inconnu";
      const pId = cb.dataset.parcelId || "";
      const pName = cb.dataset.parcelName || cb.value;
      const surface = parseFloat(cb.dataset.surface || 0);
      const grapeVariety = cb.dataset.grape || "";

      const newHarvest = {
        id: generateUniqueId("HARV"),
        clientId: cId,
        clientName,
        parcelId: pId,
        parcelName: pName,
        surface,
        grapeVariety,
        leafStatus,
        leafServiceName,
        leafPrice,
        cutStatus,
        yieldKg: cutStatus === "coupee" ? yieldKg : 0,
        boxesCount: cutStatus === "coupee" ? boxesCount : 0,
        yieldPricePerKg: yieldPricePerKg || 0.35,
        harvestServiceName: harvestServiceName || "Coupe vendange (au kilo)",
        totalAmountHT: cutStatus === "coupee" ? totalAmountHT : 0,
        haulStatus,
        haulServiceName,
        haulPrice,
        worker,
        harvestDate,
        notes,
        createdAt: new Date().toISOString()
      };

      harvestWorks.unshift(newHarvest);
      addedCount++;

      // Automatisations facturation
      if (leafStatus === "effeuillee" && leafBillToDashboard) {
        billLeafHarvestToDashboard(newHarvest.id, true);
      }
      if (cutStatus === "coupee" && billToDashboard && yieldKg > 0) {
        syncHarvestToIntervention(newHarvest, harvestServiceName, yieldKg, boxesCount, yieldPricePerKg);
      }
      if (haulStatus === "debardee" && haulBillToDashboard) {
        billHaulHarvestToDashboard(newHarvest.id, true);
      }
    });

    showToast(`${addedCount} parcelle${addedCount > 1 ? "s" : ""} ajoutée${addedCount > 1 ? "s" : ""} au suivi des vendanges !`, "success");
  }

  saveHarvestWorks();
  closeHarvestModal();
  renderVendangesView();
  renderVendangesTable();
  if (typeof renderAll === "function") renderAll();
}

function deleteHarvestWork(id) {
  const item = (harvestWorks || []).find(h => h.id === id);
  if (!item) return;

  if (!confirm(`Retirer la parcelle « ${item.parcelName} » (${item.clientName}) du suivi des vendanges ?`)) {
    return;
  }

  harvestWorks = (harvestWorks || []).filter(h => h.id !== id);
  saveHarvestWorks();
  renderVendangesView();
  showToast(`Parcelle « ${item.parcelName} » retirée du suivi des vendanges.`, "info");
}

// ==================== HELPER FONCTIONS FACTURATION & PRESTATIONS VENDANGES ====================

// Remplissage dynamique des prestations d'effeuillage (Étape 1 : Uniquement Effeuillage)
function populateHarvestLeafServicesSelect(selectElem, currentSelectedName) {
  if (!selectElem) return;

  const leafServices = (services || []).filter(s =>
    s.name && s.name.toLowerCase().includes("effeuillage")
  );

  if (!leafServices.some(s => s.name.toLowerCase().includes("effeuillage"))) {
    leafServices.unshift({
      id: "srv-07",
      name: "Effeuillage manuel face levante",
      category: "Palissage & Écimage",
      rateType: "surface",
      price: 550
    });
  }

  selectElem.innerHTML = "";
  leafServices.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.name;
    const rateLabel = s.rateType === "hourly" ? "€/h" : (s.rateType === "surface" ? "€/ha" : (s.rateType === "kilo" ? "€/kg" : "€"));
    opt.textContent = `${s.name} (${s.price} ${rateLabel})`;
    opt.dataset.price = s.price;
    opt.dataset.rateType = s.rateType || "surface";
    if (currentSelectedName && (s.name === currentSelectedName || s.name.toLowerCase().includes(currentSelectedName.toLowerCase()))) {
      opt.selected = true;
    }
    selectElem.appendChild(opt);
  });

  if (!selectElem.value && leafServices.length > 0) {
    const defaultSrv = leafServices.find(s => s.name.toLowerCase().includes("effeuillage")) || leafServices[0];
    selectElem.value = defaultSrv.name;
  }
}

// Gestion de l'affichage du bloc prestation d'effeuillage dans Modal 11
function onHarvestModalLeafChange() {
  const leafSelect = document.getElementById("input-harvest-leaf");
  const leafBox = document.getElementById("harvest-leaf-box");
  const leafSrvSelect = document.getElementById("input-harvest-leaf-service");
  const leafBoxTag = document.getElementById("harvest-leaf-box-tag");
  const leafBillWrap = document.getElementById("harvest-leaf-bill-wrap");
  if (!leafSelect || !leafBox) return;

  const isNeeded = leafSelect.value !== "non_necessaire";
  leafBox.style.display = isNeeded ? "block" : "none";

  if (leafBoxTag) {
    leafBoxTag.textContent = leafSelect.value === "effeuillee" ? "Parcelle effeuillée" : "À effeuiller";
    leafBoxTag.style.background = leafSelect.value === "effeuillee" ? "rgba(82, 183, 136, 0.2)" : "rgba(100, 181, 246, 0.2)";
    leafBoxTag.style.color = leafSelect.value === "effeuillee" ? "#52b788" : "#64b5f6";
  }

  if (leafBillWrap) {
    leafBillWrap.style.display = leafSelect.value === "effeuillee" ? "block" : "none";
  }

  if (isNeeded) {
    const isLeafService = (name) => name && name.toLowerCase().includes("effeuillage");
    if (leafSrvSelect && (!leafSrvSelect.value || !isLeafService(leafSrvSelect.value) || !leafSrvSelect.children || leafSrvSelect.children.length === 0)) {
      populateHarvestLeafServicesSelect(leafSrvSelect, "Effeuillage manuel face levante");
    }
    onHarvestModalLeafServiceChange();
  }
}

// Mise à jour du prix selon la prestation d'effeuillage choisie
function onHarvestModalLeafServiceChange() {
  const leafSrvSelect = document.getElementById("input-harvest-leaf-service");
  const leafPriceInput = document.getElementById("input-harvest-leaf-price");
  const leafHint = document.getElementById("harvest-leaf-price-hint");
  if (!leafSrvSelect) return;

  const selectedOpt = leafSrvSelect.selectedOptions[0];
  const price = selectedOpt ? parseFloat(selectedOpt.dataset.price) : 550;
  const rateType = selectedOpt ? (selectedOpt.dataset.rateType || "surface") : "surface";
  const rateLabel = rateType === "hourly" ? "€ / h" : (rateType === "surface" ? "€ / ha" : (rateType === "kilo" ? "€ / kg" : "€"));

  if (leafPriceInput && (!leafPriceInput.value || leafPriceInput.dataset.autoFilled === "true")) {
    leafPriceInput.value = price;
    leafPriceInput.dataset.autoFilled = "true";
  }

  if (leafPriceInput && !leafPriceInput._hasInputListener) {
    leafPriceInput._hasInputListener = true;
    leafPriceInput.addEventListener("input", () => {
      leafPriceInput.dataset.autoFilled = "false";
    });
  }

  if (leafHint) {
    leafHint.innerHTML = `Tarif préenregistré dans <strong>Prestations Travaux</strong> : <strong style="color: #64b5f6;">${price} ${rateLabel}</strong>`;
  }
}

// Remplissage dynamique des prestations de débardage (Étape 3 : Uniquement Débardage)
function populateHarvestHaulServicesSelect(selectElem, currentSelectedName) {
  if (!selectElem) return;

  const haulServices = (services || []).filter(s => {
    if (!s || !s.name) return false;
    const nl = s.name.toLowerCase();
    if (nl.includes("coupe") || nl.includes("récolte") || nl.includes("recolte") || nl.includes("cueillette")) {
      return false;
    }
    return nl.includes("débardage") || nl.includes("debardage") || nl.includes("benne") || nl.includes("transport");
  });

  if (!haulServices.some(s => s.name.toLowerCase().includes("débardage") || s.name.toLowerCase().includes("debardage"))) {
    haulServices.unshift({
      id: "srv-debardage-vendange",
      name: "Débardage vendange (tracteur / porteur)",
      category: "Vendanges & Récolte",
      rateType: "kilo",
      price: 0.15,
      description: "Évacuation des caisses et sorties de rang au tracteur interligne ou chenillard (0,15 €/kg)."
    });
  }

  selectElem.innerHTML = "";
  haulServices.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.name;
    const rateLabel = s.rateType === "hourly" ? "€/h" : (s.rateType === "surface" ? "€/ha" : (s.rateType === "kilo" ? "€/kg" : "€"));
    opt.textContent = `${s.name} (${s.price} ${rateLabel})`;
    opt.dataset.price = s.price;
    opt.dataset.rateType = s.rateType || "kilo";
    if (currentSelectedName && (s.name === currentSelectedName || s.name.toLowerCase().includes(currentSelectedName.toLowerCase()))) {
      opt.selected = true;
    }
    selectElem.appendChild(opt);
  });

  if (!selectElem.value && haulServices.length > 0) {
    const defaultSrv = haulServices.find(s => s.name.toLowerCase().includes("débardage") || s.name.toLowerCase().includes("debardage")) || haulServices[0];
    selectElem.value = defaultSrv.name;
  }
}

// Gestion de l'affichage du bloc prestation de débardage dans Modal 11
function onHarvestModalHaulChange() {
  const haulSelect = document.getElementById("input-harvest-haul");
  const haulBox = document.getElementById("harvest-haul-box");
  const haulSrvSelect = document.getElementById("input-harvest-haul-service");
  const haulBoxTag = document.getElementById("harvest-haul-box-tag");
  const haulBillWrap = document.getElementById("harvest-haul-bill-wrap");
  if (!haulSelect || !haulBox) return;

  const isNeeded = haulSelect.value !== "non_necessaire";
  haulBox.style.display = isNeeded ? "block" : "none";

  if (haulBoxTag) {
    haulBoxTag.textContent = haulSelect.value === "debardee" ? "Parcelle débardée" : "À débarder";
    haulBoxTag.style.background = haulSelect.value === "debardee" ? "rgba(82, 183, 136, 0.2)" : "rgba(76, 201, 240, 0.2)";
    haulBoxTag.style.color = haulSelect.value === "debardee" ? "#52b788" : "#4cc9f0";
  }

  if (haulBillWrap) {
    haulBillWrap.style.display = haulSelect.value === "debardee" ? "block" : "none";
  }

  if (isNeeded) {
    const isHaulService = (name) => name && (name.toLowerCase().includes("débard") || name.toLowerCase().includes("debard") || name.toLowerCase().includes("benne") || name.toLowerCase().includes("transport"));
    if (haulSrvSelect && (!haulSrvSelect.value || !isHaulService(haulSrvSelect.value) || !haulSrvSelect.children || haulSrvSelect.children.length === 0)) {
      populateHarvestHaulServicesSelect(haulSrvSelect, "Débardage vendange (tracteur / porteur)");
    }
    onHarvestModalHaulServiceChange();
  }
}

// Mise à jour du prix selon la prestation de débardage choisie
function onHarvestModalHaulServiceChange() {
  const haulSrvSelect = document.getElementById("input-harvest-haul-service");
  const haulPriceInput = document.getElementById("input-harvest-haul-price");
  const haulHint = document.getElementById("harvest-haul-price-hint");
  if (!haulSrvSelect) return;

  const selectedOpt = haulSrvSelect.selectedOptions[0];
  const price = selectedOpt ? parseFloat(selectedOpt.dataset.price) : 0.15;
  const rateType = selectedOpt ? (selectedOpt.dataset.rateType || "kilo") : "kilo";
  const rateLabel = rateType === "hourly" ? "€ / h" : (rateType === "surface" ? "€ / ha" : (rateType === "kilo" ? "€ / kg" : "€"));

  if (haulPriceInput && (!haulPriceInput.value || haulPriceInput.dataset.autoFilled === "true")) {
    haulPriceInput.value = price;
    haulPriceInput.dataset.autoFilled = "true";
  }

  if (haulPriceInput && !haulPriceInput._hasInputListener) {
    haulPriceInput._hasInputListener = true;
    haulPriceInput.addEventListener("input", () => {
      haulPriceInput.dataset.autoFilled = "false";
    });
  }

  if (haulHint) {
    haulHint.innerHTML = `Tarif préenregistré dans <strong>Prestations Travaux</strong> : <strong style="color: #4cc9f0;">${price} ${rateLabel}</strong>`;
  }
}

// Remplissage dynamique des prestations de vendange / récolte au kilo (Étape 2 : Uniquement Coupe Vendange / Récolte)
function populateHarvestServicesSelect(selectElem, currentSelectedName) {
  if (!selectElem) return;

  const harvestServices = (services || []).filter(s => {
    if (!s || !s.name) return false;
    const nl = s.name.toLowerCase();
    if (nl.includes("débardage") || nl.includes("debardage") || nl.includes("benne") || nl.includes("transport")) {
      return false;
    }
    return nl.includes("coupe") || nl.includes("récolte") || nl.includes("recolte") || nl.includes("cueillette") ||
      (nl.includes("vendange") && !nl.includes("débard") && !nl.includes("debard"));
  });

  if (!harvestServices.some(s => s.name.toLowerCase().includes("coupe"))) {
    harvestServices.unshift({
      id: "srv-coupe-vendange-kg",
      name: "Coupe vendange (au kilo)",
      category: "Vendanges & Récolte",
      rateType: "kilo",
      price: 0.35
    });
  }

  selectElem.innerHTML = "";
  harvestServices.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.name;
    const rateLabel = s.rateType === "kilo" ? "€/kg" : (s.rateType === "hourly" ? "€/h" : "€");
    opt.textContent = `${s.name} (${s.price} ${rateLabel})`;
    opt.dataset.price = s.price;
    opt.dataset.rateType = s.rateType || "kilo";
    if (currentSelectedName && (s.name === currentSelectedName || s.name.toLowerCase().includes(currentSelectedName.toLowerCase()))) {
      opt.selected = true;
    }
    selectElem.appendChild(opt);
  });

  if (!selectElem.value && harvestServices.length > 0) {
    const defaultCut = harvestServices.find(s => s.name.toLowerCase().includes("coupe")) || harvestServices[0];
    selectElem.value = defaultCut.name;
  }
}

// Gestion de l'affichage du bloc coupe / récolte dans Modal 11
function onHarvestModalCutChange() {
  const cutSelect = document.getElementById("input-harvest-cut");
  const srvSelect = document.getElementById("input-harvest-service");
  const cutBoxTag = document.getElementById("harvest-cut-box-tag");
  const pendingHint = document.getElementById("harvest-cut-pending-hint");
  const yieldBox = document.getElementById("harvest-yield-box");
  if (!cutSelect) return;

  const isCut = cutSelect.value === "coupee";

  if (cutBoxTag) {
    cutBoxTag.textContent = isCut ? "Parcelle coupée (récoltée)" : "À couper";
    cutBoxTag.style.background = isCut ? "rgba(82, 183, 136, 0.2)" : "rgba(255, 183, 3, 0.2)";
    cutBoxTag.style.color = isCut ? "#52b788" : "#ffb703";
  }

  if (pendingHint) {
    pendingHint.style.display = isCut ? "none" : "block";
  }
  if (yieldBox) {
    yieldBox.style.display = isCut ? "block" : "none";
  }

  const isCutService = (name) => name && !name.toLowerCase().includes("débard") && !name.toLowerCase().includes("debard") && (name.toLowerCase().includes("coupe") || name.toLowerCase().includes("récolte") || name.toLowerCase().includes("recolte") || name.toLowerCase().includes("vendange"));
  if (srvSelect && (!srvSelect.value || !isCutService(srvSelect.value) || !srvSelect.children || srvSelect.children.length === 0)) {
    populateHarvestServicesSelect(srvSelect, "Coupe vendange (au kilo)");
  }
  onHarvestModalServiceChange();
}

// Changement de prestation dans la pesée rapide
function onYieldServiceChange() {
  const selectElem = document.getElementById("quick-input-yield-service");
  const priceInput = document.getElementById("quick-input-yield-price");
  if (!selectElem || !priceInput) return;

  const selectedOpt = selectElem.options[selectElem.selectedIndex];
  if (selectedOpt && selectedOpt.dataset.price) {
    priceInput.value = selectedOpt.dataset.price;
  }
  updateYieldModalLiveCalculation();
}

// Calcul en direct dans la modale de pesée rapide
function updateYieldModalLiveCalculation() {
  const kg = parseFloat(document.getElementById("quick-input-yield-kg")?.value) || 0;
  const price = parseFloat(document.getElementById("quick-input-yield-price")?.value) || 0;
  const totalHT = Math.round(kg * price * 100) / 100;
  const totalTTC = Math.round(totalHT * 1.20 * 100) / 100;

  const formulaElem = document.getElementById("quick-yield-calc-formula");
  const htElem = document.getElementById("quick-yield-calc-total-ht");
  const ttcElem = document.getElementById("quick-yield-calc-total-ttc");

  if (formulaElem) {
    formulaElem.textContent = `${kg.toLocaleString("fr-FR")} kg × ${price.toFixed(2)} €/kg`;
  }
  if (htElem) {
    htElem.textContent = `${formatCurrency(totalHT)} HT`;
  }
  if (ttcElem) {
    ttcElem.textContent = `${formatCurrency(totalTTC)} TTC`;
  }
}

// Changement de prestation dans Modal 11
function onHarvestModalServiceChange() {
  const selectElem = document.getElementById("input-harvest-service");
  const priceInput = document.getElementById("input-harvest-price-kg");
  const cutHint = document.getElementById("harvest-cut-price-hint");
  if (!selectElem) return;

  const selectedOpt = selectElem.options[selectElem.selectedIndex];
  const price = selectedOpt && selectedOpt.dataset.price ? parseFloat(selectedOpt.dataset.price) : 0.35;
  const rateType = selectedOpt ? (selectedOpt.dataset.rateType || "kilo") : "kilo";
  const rateLabel = rateType === "kilo" ? "€ / kg" : (rateType === "hourly" ? "€ / h" : "€");

  if (priceInput && (!priceInput.value || priceInput.dataset.autoFilled === "true")) {
    priceInput.value = price;
    priceInput.dataset.autoFilled = "true";
  }

  if (priceInput && !priceInput._hasInputListener) {
    priceInput._hasInputListener = true;
    priceInput.addEventListener("input", () => {
      priceInput.dataset.autoFilled = "false";
    });
  }

  if (cutHint) {
    cutHint.innerHTML = `Tarif préenregistré dans <strong>Prestations Travaux</strong> : <strong style="color: #ffb703;">${price} ${rateLabel}</strong>`;
  }

  updateHarvestModalLiveCalculation();
}

// Calcul en direct dans Modal 11
function updateHarvestModalLiveCalculation() {
  const kg = parseFloat(document.getElementById("input-harvest-yield-kg")?.value) || 0;
  const price = parseFloat(document.getElementById("input-harvest-price-kg")?.value) || 0;
  const totalHT = Math.round(kg * price * 100) / 100;
  const calcElem = document.getElementById("harvest-yield-calc");

  if (calcElem) {
    if (kg > 0) {
      calcElem.style.display = "block";
      calcElem.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>⚖️ ${kg.toLocaleString("fr-FR")} kg × ${price.toFixed(2)} €/kg</span>
          <strong style="color: #52b788; font-size: 0.95rem;">${formatCurrency(totalHT)} HT</strong>
        </div>
      `;
    } else {
      calcElem.style.display = "none";
    }
  }
}

// Synchronisation directe d'une vendange vers le Journal des interventions (Tableau de bord)
function syncHarvestToIntervention(item, serviceName, kg, boxes, pricePerKg) {
  if (!item || !kg || kg <= 0) return null;

  const totalHT = Math.round(kg * pricePerKg * 100) / 100;
  const totalTTC = Math.round(totalHT * 1.20 * 100) / 100;
  const invDate = item.harvestDate ? `${item.harvestDate}T08:00` : new Date().toISOString().slice(0, 16);
  const worker = item.worker || "Équipe Vendanges";
  const taskName = serviceName || item.harvestServiceName || "Coupe vendange (au kilo)";

  let existingInv = null;
  if (item.interventionId) {
    existingInv = (interventions || []).find(inv => inv.id === item.interventionId);
  }

  if (existingInv) {
    existingInv.datetime = invDate;
    existingInv.task = taskName;
    existingInv.rateType = "kilo";
    existingInv.quantity = kg;
    existingInv.unit = "kg";
    existingInv.unitPrice = pricePerKg;
    existingInv.total = totalHT;
    existingInv.totalTTC = totalTTC;
    existingInv.worker = worker;
    existingInv.notes = `Pesée vendange: ${kg.toLocaleString("fr-FR")} kg (${boxes || 0} caisses) à ${pricePerKg.toFixed(2)} €/kg. Cépage: ${item.grapeVariety || "Non précisé"}`;
    saveInterventions(existingInv);
    syncInterventionToSupabase(existingInv);
    return existingInv;
  } else {
    const year = item.harvestDate ? new Date(item.harvestDate).getFullYear() : new Date().getFullYear();
    const newInvId = generateUniqueInterventionId(year);
    const newInv = {
      id: newInvId,
      datetime: invDate,
      worker: worker,
      clientId: item.clientId,
      client: item.clientName,
      parcel: item.parcelName,
      parcelId: item.parcelId,
      task: taskName,
      rateType: "kilo",
      quantity: kg,
      unit: "kg",
      unitPrice: pricePerKg,
      total: totalHT,
      tvaRate: 20,
      totalTTC: totalTTC,
      status: "À facturer",
      notes: `Pesée vendange: ${kg.toLocaleString("fr-FR")} kg (${boxes || 0} caisses) à ${pricePerKg.toFixed(2)} €/kg. Cépage: ${item.grapeVariety || "Non précisé"}`,
      isNewlyCreated: true
    };
    interventions.unshift(newInv);
    item.interventionId = newInvId;
    saveInterventions(newInv);
    syncInterventionToSupabase(newInv);
    return newInv;
  }
}

// Facturation en 1 clic depuis le tableau des vendanges
function billHarvestToDashboard(harvestId) {
  const item = (harvestWorks || []).find(h => h.id === harvestId);
  if (!item) return;

  const kg = parseFloat(item.yieldKg) || 0;
  if (kg <= 0) {
    openYieldModal(harvestId);
    return;
  }

  let pricePerKg = parseFloat(item.yieldPricePerKg);
  if (!pricePerKg && pricePerKg !== 0) {
    pricePerKg = 0.35;
  }
  const serviceName = item.harvestServiceName || "Coupe vendange (au kilo)";

  syncHarvestToIntervention(item, serviceName, kg, item.boxesCount || 0, pricePerKg);
  item.yieldPricePerKg = pricePerKg;
  item.harvestServiceName = serviceName;
  item.totalAmountHT = Math.round(kg * pricePerKg * 100) / 100;
  saveHarvestWorks();
  renderAll();

  showToast(`🍇 Chantier vendange « ${item.parcelName} » ajouté au Tableau de Bord (${formatCurrency(item.totalAmountHT)}) !`, "success");
}

// Facturation en 1 clic de l'effeuillage depuis le tableau des vendanges
function billLeafHarvestToDashboard(harvestId, silent = false) {
  const item = (harvestWorks || []).find(h => h.id === harvestId);
  if (!item) return;

  const matchedService = (services || []).find(s => s.name === item.leafServiceName) ||
    (services || []).find(s => s.name && s.name.toLowerCase().includes("effeuillage")) || {
    name: "Effeuillage manuel face levante",
    price: 550,
    rateType: "surface"
  };

  const serviceName = item.leafServiceName || matchedService.name;
  const invDate = item.harvestDate ? `${item.harvestDate}T08:00` : new Date().toISOString().slice(0, 16);
  const worker = item.worker || "Équipe Effeuillage";
  const surface = parseFloat(item.surface) || 1;
  const rateType = matchedService.rateType || "surface";

  let quantity = 1;
  let unit = "ha";
  let unitPrice = (item.leafPrice && item.leafPrice !== 37) ? item.leafPrice : (matchedService.price || 550);
  let totalHT = unitPrice;

  if (rateType === "surface") {
    quantity = surface;
    unit = "ha";
    totalHT = Math.round(surface * unitPrice * 100) / 100;
  } else if (rateType === "hourly") {
    quantity = Math.max(1, Math.round(surface * 4 * 10) / 10);
    unit = "h";
    totalHT = Math.round(quantity * unitPrice * 100) / 100;
  } else if (rateType === "kilo") {
    quantity = parseFloat(item.yieldKg) || (surface > 0 ? Math.round(surface * 6000) : 1);
    unit = "kg";
    totalHT = Math.round(quantity * unitPrice * 100) / 100;
  } else {
    quantity = 1;
    unit = "forfait";
    totalHT = unitPrice;
  }
  const totalTTC = Math.round(totalHT * 1.20 * 100) / 100;

  const existingInv = item.leafInterventionId
    ? (interventions || []).find(i => i.id === item.leafInterventionId)
    : null;

  if (existingInv) {
    existingInv.task = serviceName;
    existingInv.unitPrice = unitPrice;
    existingInv.quantity = quantity;
    existingInv.rateType = rateType;
    existingInv.unit = unit;
    existingInv.total = totalHT;
    existingInv.totalTTC = totalTTC;
    saveInterventions();
    syncInterventionToSupabase(existingInv);
    renderAll();
    if (!silent) {
      showToast(`🍃 Effeuillage « ${item.parcelName} » actualisé dans le Tableau de Bord (${formatCurrency(totalHT)}) !`, "success");
    }
    return existingInv;
  }

  const year = item.harvestDate ? new Date(item.harvestDate).getFullYear() : new Date().getFullYear();
  const newInvId = generateUniqueInterventionId(year);
  const newInv = {
    id: newInvId,
    datetime: invDate,
    worker: worker,
    clientId: item.clientId,
    client: item.clientName,
    parcel: item.parcelName,
    parcelId: item.parcelId,
    task: serviceName,
    rateType: rateType,
    quantity: quantity,
    unit: unit,
    unitPrice: unitPrice,
    total: totalHT,
    tvaRate: 20,
    totalTTC: totalTTC,
    status: "À facturer",
    notes: `Chantier d'effeuillage avant vendange réalisé sur ${item.parcelName} (${formatSurface(item.surface)} ha, cépage: ${item.grapeVariety || "non précisé"}).`,
    isNewlyCreated: true
  };

  interventions.unshift(newInv);
  item.leafInterventionId = newInvId;
  saveInterventions(newInv);
  syncInterventionToSupabase(newInv);
  saveHarvestWorks();
  renderAll();

  if (!silent) {
    showToast(`🍃 Chantier effeuillage « ${item.parcelName} » ajouté au Tableau de Bord (${formatCurrency(totalHT)}) !`, "success");
  }
  return newInv;
}

// Facturation en 1 clic du débardage depuis le tableau des vendanges
function billHaulHarvestToDashboard(harvestId, silent = false) {
  const item = (harvestWorks || []).find(h => h.id === harvestId);
  if (!item) return;

  const matchedService = (services || []).find(s => s.name === item.haulServiceName) ||
    (services || []).find(s => s.name && (s.name.toLowerCase().includes("débardage") || s.name.toLowerCase().includes("debardage"))) || {
    name: "Débardage vendange (tracteur / porteur)",
    price: 0.15,
    rateType: "kilo"
  };

  const serviceName = item.haulServiceName || matchedService.name;
  const invDate = item.harvestDate ? `${item.harvestDate}T14:00` : new Date().toISOString().slice(0, 16);
  const worker = item.worker || "Équipe Débardage & Tractoriste";
  const surface = parseFloat(item.surface) || 1;
  const rateType = matchedService.rateType || "kilo";

  let quantity = 1;
  let unit = "kg";
  let unitPrice = (item.haulPrice && item.haulPrice !== 45) ? item.haulPrice : (matchedService.price || 0.15);
  let totalHT = unitPrice;

  if (rateType === "kilo") {
    const yieldKg = parseFloat(item.yieldKg) || 0;
    if (yieldKg > 0) {
      quantity = yieldKg;
    } else if (surface > 0) {
      quantity = Math.round(surface * 6000); // estimation vendange standard
    } else {
      quantity = 1;
    }
    unit = "kg";
    totalHT = Math.round(quantity * unitPrice * 100) / 100;
  } else if (rateType === "surface") {
    quantity = surface;
    unit = "ha";
    totalHT = Math.round(surface * unitPrice * 100) / 100;
  } else if (rateType === "hourly") {
    // Débardage au tracteur/porteur : environ 2.5 heures par hectare
    quantity = Math.max(1, Math.round(surface * 2.5 * 10) / 10);
    unit = "h";
    totalHT = Math.round(quantity * unitPrice * 100) / 100;
  } else {
    quantity = 1;
    unit = "forfait";
    totalHT = unitPrice;
  }
  const totalTTC = Math.round(totalHT * 1.20 * 100) / 100;

  const existingInv = item.haulInterventionId
    ? (interventions || []).find(i => i.id === item.haulInterventionId)
    : null;

  if (existingInv) {
    existingInv.task = serviceName;
    existingInv.unitPrice = unitPrice;
    existingInv.quantity = quantity;
    existingInv.rateType = rateType;
    existingInv.unit = unit;
    existingInv.total = totalHT;
    existingInv.totalTTC = totalTTC;
    saveInterventions();
    syncInterventionToSupabase(existingInv);
    renderAll();
    if (!silent) {
      showToast(`🚜 Débardage « ${item.parcelName} » actualisé dans le Tableau de Bord (${formatCurrency(totalHT)}) !`, "success");
    }
    return existingInv;
  }

  const year = item.harvestDate ? new Date(item.harvestDate).getFullYear() : new Date().getFullYear();
  const newInvId = generateUniqueInterventionId(year);
  const newInv = {
    id: newInvId,
    datetime: invDate,
    worker: worker,
    clientId: item.clientId,
    client: item.clientName,
    parcel: item.parcelName,
    parcelId: item.parcelId,
    task: serviceName,
    rateType: rateType,
    quantity: quantity,
    unit: unit,
    unitPrice: unitPrice,
    total: totalHT,
    tvaRate: 20,
    totalTTC: totalTTC,
    status: "À facturer",
    notes: `Débardage et sortie de rang réalisés sur ${item.parcelName} (${formatSurface(item.surface)} ha, cépage: ${item.grapeVariety || "non précisé"}).`,
    isNewlyCreated: true
  };

  interventions.unshift(newInv);
  item.haulInterventionId = newInvId;
  saveInterventions(newInv);
  syncInterventionToSupabase(newInv);
  saveHarvestWorks();
  renderAll();

  if (!silent) {
    showToast(`🚜 Chantier débardage « ${item.parcelName} » ajouté au Tableau de Bord (${formatCurrency(totalHT)}) !`, "success");
  }
  return newInv;
}

// Navigation fluide vers une intervention dans le Tableau de Bord
function navigateToIntervention(invId) {
  if (typeof switchTab === "function") {
    switchTab("overview");
  }
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.value = invId;
    if (typeof filterInterventions === "function") {
      filterInterventions();
    }
  }
  setTimeout(() => {
    const row = document.querySelector(`tr[data-id="${invId}"]`);
    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.style.transition = "background 0.5s ease";
      row.style.background = "rgba(82, 183, 136, 0.25)";
      setTimeout(() => { row.style.background = ""; }, 2000);
    } else {
      const tableSec = document.getElementById("interventions-table-section") || document.getElementById("interventions-table");
      if (tableSec) tableSec.scrollIntoView({ behavior: "smooth" });
    }
  }, 200);
}

// Modal Pesée Rapide (Kilos / Caisses & Tarification)
function openYieldModal(id) {
  const item = (harvestWorks || []).find(h => h.id === id);
  if (!item) return;

  const modal = document.getElementById("harvest-yield-modal");
  const entryIdInput = document.getElementById("yield-modal-entry-id");
  const summaryBox = document.getElementById("yield-parcel-summary");
  const kgInput = document.getElementById("quick-input-yield-kg");
  const boxesInput = document.getElementById("quick-input-yield-boxes");
  const serviceSelect = document.getElementById("quick-input-yield-service");
  const priceInput = document.getElementById("quick-input-yield-price");
  const billCheckbox = document.getElementById("quick-yield-bill-dashboard");
  if (!modal) return;

  if (entryIdInput) entryIdInput.value = item.id;
  if (summaryBox) {
    summaryBox.innerHTML = `
      <div style="font-weight: 700; color: var(--text-heading); font-size: 1.05rem;">${escapeHTML(item.clientName)}</div>
      <div style="font-size: 0.88rem; color: var(--text-muted); display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 4px;">
        <span>📍 ${escapeHTML(item.parcelName)}</span>
        <span>•</span>
        <span>📐 ${formatSurface(item.surface)} ha</span>
        ${item.grapeVariety ? `<span>•</span><span>🍇 ${escapeHTML(item.grapeVariety)}</span>` : ""}
      </div>
    `;
  }
  if (kgInput) kgInput.value = item.yieldKg || "";
  if (boxesInput) boxesInput.value = item.boxesCount || "";

  // Remplissage de la liste des prestations de vendange
  populateHarvestServicesSelect(serviceSelect, item.harvestServiceName || "Coupe vendange (au kilo)");

  // Prix au kilo
  let defaultPrice = item.yieldPricePerKg;
  if (!defaultPrice && defaultPrice !== 0) {
    const selectedOpt = serviceSelect?.options[serviceSelect.selectedIndex];
    defaultPrice = selectedOpt && selectedOpt.dataset.price ? parseFloat(selectedOpt.dataset.price) : 0.35;
  }
  if (priceInput) priceInput.value = defaultPrice;

  // Case à cocher pour facturation
  if (billCheckbox) {
    billCheckbox.checked = true;
  }

  updateYieldModalLiveCalculation();

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  if (typeof lockBodyScroll === "function") lockBodyScroll();
  setTimeout(() => { if (kgInput) kgInput.focus(); }, 150);
}

function closeYieldModal() {
  const modal = document.getElementById("harvest-yield-modal");
  if (modal) {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    if (typeof unlockBodyScroll === "function") unlockBodyScroll();
  }
}

function handleYieldQuickFormSubmit(e) {
  if (e) e.preventDefault();

  const id = document.getElementById("yield-modal-entry-id")?.value;
  const item = (harvestWorks || []).find(h => h.id === id);
  if (!item) return;

  const kg = parseFloat(document.getElementById("quick-input-yield-kg")?.value) || 0;
  const boxes = parseInt(document.getElementById("quick-input-yield-boxes")?.value, 10) || 0;
  const serviceSelect = document.getElementById("quick-input-yield-service");
  const serviceName = serviceSelect?.value || "Coupe vendange (au kilo)";
  const pricePerKg = parseFloat(document.getElementById("quick-input-yield-price")?.value) || 0;
  const surface = parseFloat(item.surface) || 1;
  const finalKg = kg > 0 ? kg : (surface > 0 ? Math.round(surface * 6000) : 1000);
  const finalPrice = pricePerKg > 0 ? pricePerKg : 0.35;

  item.yieldKg = finalKg;
  item.boxesCount = boxes;
  item.yieldPricePerKg = finalPrice;
  item.harvestServiceName = serviceName;
  item.totalAmountHT = Math.round(finalKg * finalPrice * 100) / 100;
  item.cutStatus = "coupee"; // Si la pesée est validée, la parcelle est nécessairement coupée

  // Transfert direct et automatique vers le Tableau de bord pour la facturation ("À facturer")
  syncHarvestToIntervention(item, serviceName, finalKg, boxes, finalPrice);

  // Si le débardage a déjà été facturé (ex: au kilo), actualiser son intervention avec les kilos pesés
  if (item.haulStatus === "debardee" && item.haulInterventionId) {
    billHaulHarvestToDashboard(item.id, true);
  }

  saveHarvestWorks();
  closeYieldModal();
  renderAll();

  showToast(`🍇 Coupe « ${item.parcelName} » (${finalKg.toLocaleString("fr-FR")} kg à ${finalPrice.toFixed(2)} €/kg) validée et envoyée directement à facturer (${formatCurrency(item.totalAmountHT)}) !`, "success");
}

// Export CSV Vendanges
function exportVendangesCSV() {
  let list = [...(harvestWorks || [])];

  // 1. Filtre Domaine
  if (Array.isArray(vendangesClientFilters) && vendangesClientFilters.length > 0) {
    const totalCount = document.querySelectorAll("#list-vendanges-filter-client .vendanges-client-cb").length;
    if (vendangesClientFilters.length < totalCount) {
      list = list.filter(h =>
        vendangesClientFilters.includes(h.clientId) ||
        vendangesClientFilters.includes(h.clientName)
      );
    }
  } else if (vendangesClientFilter && vendangesClientFilter !== "all") {
    list = list.filter(h => h.clientId === vendangesClientFilter || h.clientName === vendangesClientFilter);
  }

  // 1b. Filtre Parcelle
  const totalVendangesParcels = document.querySelectorAll("#list-vendanges-filter-parcel .vendanges-parcel-cb").length;
  if (totalVendangesParcels > 0 && vendangesParcelFilters.length < totalVendangesParcels) {
    list = list.filter(h => {
      const pKey = (h.clientId || "") + "___" + (h.parcelId || h.parcelName);
      return vendangesParcelFilters.includes(pKey) ||
             vendangesParcelFilters.includes(h.parcelId) ||
             vendangesParcelFilters.includes(h.parcelName);
    });
  }

  // 1c. Filtre Équipe & Suivi
  const totalVendangesTeams = document.querySelectorAll("#list-vendanges-filter-team .vendanges-team-cb").length;
  if (totalVendangesTeams > 0 && Array.isArray(vendangesTeamFilters) && vendangesTeamFilters.length < totalVendangesTeams) {
    list = list.filter(h => {
      const w = (h.worker || "").trim();
      const isUnassigned = !w || w.toLowerCase() === "non assigné" || w.toLowerCase() === "non assigne" || w.toLowerCase() === "à définir";
      if (isUnassigned) {
        return vendangesTeamFilters.includes("__unassigned__");
      }
      if (vendangesTeamFilters.includes(w)) return true;
      for (const tKey of vendangesTeamFilters) {
        if (tKey === "__unassigned__") continue;
        if (w.toLowerCase().includes(tKey.toLowerCase()) || tKey.toLowerCase().includes(w.toLowerCase())) return true;
        const parts = tKey.split(" ");
        if (parts.length >= 2 && w.toLowerCase().startsWith(parts[0].toLowerCase())) return true;
      }
      return false;
    });
  }

  // 2. Filtre Étape
  const allStages = ["leaf_todo", "leaf_done", "cut_todo", "cut_done", "haul_todo", "haul_done"];
  if (Array.isArray(vendangesStageFilters) && vendangesStageFilters.length < allStages.length) {
    list = list.filter(h => {
      if (vendangesStageFilters.includes("leaf_todo") && h.leafStatus === "a_effeuiller") return true;
      if (vendangesStageFilters.includes("leaf_done") && h.leafStatus === "effeuillee") return true;
      if (vendangesStageFilters.includes("cut_todo") && h.cutStatus === "a_couper") return true;
      if (vendangesStageFilters.includes("cut_done") && h.cutStatus === "coupee") return true;
      if (vendangesStageFilters.includes("haul_todo") && h.haulStatus === "a_debarder") return true;
      if (vendangesStageFilters.includes("haul_done") && h.haulStatus === "debardee") return true;
      return false;
    });
  }

  // 3. Filtre Recherche
  if (vendangesSearchFilter) {
    const q = vendangesSearchFilter.toLowerCase();
    list = list.filter(h =>
      (h.clientName && h.clientName.toLowerCase().includes(q)) ||
      (h.parcelName && h.parcelName.toLowerCase().includes(q)) ||
      (h.grapeVariety && h.grapeVariety.toLowerCase().includes(q)) ||
      (h.worker && h.worker.toLowerCase().includes(q)) ||
      (h.notes && h.notes.toLowerCase().includes(q))
    );
  }

  if (list.length === 0) {
    showToast("Aucune donnée de vendange ne correspond aux filtres actuels pour l'export.", "warning");
    return;
  }

  const headers = [
    "Domaine Viticole",
    "Parcelle",
    "Surface (ha)",
    "Cépage",
    "Effeuillage",
    "Coupe",
    "Poids Récolté (kg)",
    "Nombre de Caisses",
    "Prix au Kilo (€ HT/kg)",
    "Montant Total HT (€)",
    "Statut Facturation",
    "Débardage",
    "Prestation Débardage",
    "Tarif Débardage (€ HT)",
    "Salarié Affecté",
    "Date Récolte",
    "Notes"
  ];

  const escapeCSV = (str) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = list.map(h => {
    let leafLabel = "À effeuiller";
    if (h.leafStatus === "effeuillee") leafLabel = "Effeuillée";
    else if (h.leafStatus === "non_necessaire") leafLabel = "Non nécessaire";

    let cutLabel = h.cutStatus === "coupee" ? "Coupée" : "À couper";

    let haulLabel = "À débarder";
    if (h.haulStatus === "debardee") haulLabel = "Débardée";
    else if (h.haulStatus === "non_necessaire") haulLabel = "Non nécessaire";

    const kg = parseFloat(h.yieldKg) || 0;
    const price = parseFloat(h.yieldPricePerKg) || 0;
    const totalHT = Math.round(kg * price * 100) / 100;
    const linkedInv = h.interventionId ? (interventions || []).find(i => i.id === h.interventionId) : null;
    const billingStatus = linkedInv ? linkedInv.status : (kg > 0 ? "Non transféré" : "Non applicable");

    const haulServiceName = h.haulStatus !== "non_necessaire" ? (h.haulServiceName || "Débardage vendange (tracteur / porteur)") : "";
    const haulPrice = h.haulStatus !== "non_necessaire" ? (parseFloat(h.haulPrice) || 0.15) : "";

    return [
      escapeCSV(h.clientName),
      escapeCSV(h.parcelName),
      formatSurface(h.surface),
      escapeCSV(h.grapeVariety || ""),
      escapeCSV(leafLabel),
      escapeCSV(cutLabel),
      kg,
      h.boxesCount || 0,
      price > 0 ? price.toFixed(2) : "",
      totalHT > 0 ? totalHT.toFixed(2) : "",
      escapeCSV(billingStatus),
      escapeCSV(haulLabel),
      escapeCSV(haulServiceName),
      haulPrice !== "" ? Number(haulPrice).toFixed(2) : "",
      escapeCSV(h.worker || ""),
      escapeCSV(h.harvestDate || ""),
      escapeCSV(h.notes || "")
    ].join(";");
  });

  const csvContent = "\uFEFF" + [headers.join(";"), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const today = new Date().toISOString().split("T")[0];
  link.setAttribute("href", url);
  link.setAttribute("download", `suivi_vendanges_vititrack_${today}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast("Feuille de vendanges exportée avec succès (CSV) !", "success");
}

// Exports globaux sur window
window.openTeamModal = openTeamModal;
window.closeTeamModal = closeTeamModal;
window.renderTeamList = renderTeamList;
window.handleTeamSearch = handleTeamSearch;
window.handleTeamRoleFilter = handleTeamRoleFilter;
window.openAddTeamMemberModal = openAddTeamMemberModal;
window.openEditTeamMemberModal = openEditTeamMemberModal;
window.closeTeamMemberModal = closeTeamMemberModal;
window.handleTeamMemberFormSubmit = handleTeamMemberFormSubmit;
window.deleteTeamMember = deleteTeamMember;
window.populatePlannedWorkerSelect = populatePlannedWorkerSelect;
window.generateMemberPin = generateMemberPin;
window.copyMemberAccess = copyMemberAccess;
window.syncGlobalTeamDirectory = syncGlobalTeamDirectory;

// Exports Vendanges
window.renderVendangesView = renderVendangesView;
window.renderVendangesKPIs = renderVendangesKPIs;
window.renderVendangesTable = renderVendangesTable;
window.openHarvestModal = openHarvestModal;
window.closeHarvestModal = closeHarvestModal;
window.openHarvestClientDropdown = openHarvestClientDropdown;
window.closeHarvestClientDropdown = closeHarvestClientDropdown;
window.toggleHarvestClientDropdown = toggleHarvestClientDropdown;
window.openHarvestParcelDropdown = openHarvestParcelDropdown;
window.closeHarvestParcelDropdown = closeHarvestParcelDropdown;
window.toggleHarvestParcelDropdown = toggleHarvestParcelDropdown;
window.setupHarvestModalDropdownEvents = setupHarvestModalDropdownEvents;
window.renderHarvestClientsList = renderHarvestClientsList;
window.onHarvestClientsChanged = onHarvestClientsChanged;
window.updateHarvestParcelsList = updateHarvestParcelsList;
window.updateHarvestParcelsSummary = updateHarvestParcelsSummary;
window.formatDateFr = formatDateFr;
window.formatTime = formatTime;
window.formatCurrency = formatCurrency;
window.formatVolumeUnit = formatVolumeUnit;
window.handleHarvestClientChange = handleHarvestClientChange;
window.handleHarvestParcelChange = handleHarvestParcelChange;
window.handleHarvestFormSubmit = handleHarvestFormSubmit;
window.deleteHarvestWork = deleteHarvestWork;
window.quickToggleHarvestLeaf = quickToggleHarvestLeaf;
window.quickToggleHarvestCut = quickToggleHarvestCut;
window.quickToggleHarvestHaul = quickToggleHarvestHaul;
window.changeHarvestLeaf = changeHarvestLeaf;
window.changeHarvestCut = changeHarvestCut;
window.changeHarvestHaul = changeHarvestHaul;
window.openYieldModal = openYieldModal;
window.closeYieldModal = closeYieldModal;
window.handleYieldQuickFormSubmit = handleYieldQuickFormSubmit;
window.billHarvestToDashboard = billHarvestToDashboard;
window.billLeafHarvestToDashboard = billLeafHarvestToDashboard;
window.onHarvestModalLeafChange = onHarvestModalLeafChange;
window.onHarvestModalLeafServiceChange = onHarvestModalLeafServiceChange;
window.onHarvestModalCutChange = onHarvestModalCutChange;
window.onHarvestModalServiceChange = onHarvestModalServiceChange;
window.populateHarvestLeafServicesSelect = populateHarvestLeafServicesSelect;
window.populateHarvestHaulServicesSelect = populateHarvestHaulServicesSelect;
window.onHarvestModalHaulChange = onHarvestModalHaulChange;
window.onHarvestModalHaulServiceChange = onHarvestModalHaulServiceChange;
window.billHaulHarvestToDashboard = billHaulHarvestToDashboard;
window.exportVendangesCSV = exportVendangesCSV;
window.filterVendangesByStage = filterVendangesByStage;
window.toggleVendangesStage = toggleVendangesStage;
window.toggleAllVendangesStages = toggleAllVendangesStages;
window.updateVendangesStageFilterUI = updateVendangesStageFilterUI;
window.initVendangesParcelFilterMultiSelect = initVendangesParcelFilterMultiSelect;
window.populateVendangesParcelFilter = populateVendangesParcelFilter;
window.updateVendangesParcelFilterUI = updateVendangesParcelFilterUI;
window.toggleVendangesParcel = toggleVendangesParcel;
window.toggleAllVendangesParcels = toggleAllVendangesParcels;
window.toggleVendangesClientGroupParcels = toggleVendangesClientGroupParcels;
window.initVendangesTeamFilterMultiSelect = initVendangesTeamFilterMultiSelect;
window.populateVendangesTeamFilter = populateVendangesTeamFilter;
window.updateVendangesTeamFilterUI = updateVendangesTeamFilterUI;
window.toggleVendangesTeam = toggleVendangesTeam;
window.toggleAllVendangesTeams = toggleAllVendangesTeams;
window.resetVendangesFilters = resetVendangesFilters;

// ==================== HISTORIQUE & SUIVI PAR CLIENT ====================
let clientHistorySelectedClientIds = [];
let clientHistorySelectedClientId = null; // Rétrocompatibilité
let clientHistorySelectedParcelIds = new Set();
let clientHistoryStatusFilter = "all";
let clientHistoryDateFilter = "all";
let clientHistorySearchFilter = "";

let _chFilterMsInitialized = false;
function initClientHistoryFilterMultiSelect() {
  if (_chFilterMsInitialized) return;
  _chFilterMsInitialized = true;

  const wrap = document.getElementById("wrap-ch-filter-client");
  const btn = document.getElementById("btn-ch-filter-client");
  const dropdown = document.getElementById("dropdown-ch-filter-client");
  const searchInput = document.getElementById("search-ch-filter-client");
  const btnAll = document.getElementById("btn-ch-select-all-clients");
  const btnClear = document.getElementById("btn-ch-clear-clients");

  if (btn && dropdown) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = dropdown.style.display === "flex";
      closeAllFilterMultiSelects();
      if (!isOpen) {
        dropdown.style.display = "flex";
        if (wrap) wrap.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
        if (searchInput) setTimeout(() => searchInput.focus(), 60);
      }
    });
  }

  if (dropdown) {
    dropdown.addEventListener("click", (e) => e.stopPropagation());
  }

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase().trim();
      const items = document.querySelectorAll("#list-ch-filter-client .filter-ms-item");
      items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(q) ? "flex" : "none";
      });
    });
  }

  if (btnAll) {
    btnAll.addEventListener("click", (e) => {
      e.preventDefault();
      toggleAllClientHistoryClients(true);
    });
  }

  if (btnClear) {
    btnClear.addEventListener("click", (e) => {
      e.preventDefault();
      toggleAllClientHistoryClients(false);
    });
  }
}

function updateClientHistoryFilterUI() {
  const textEl = document.getElementById("ch-client-text");
  const badgeEl = document.getElementById("ch-client-badge");
  const dropdownBadgeEl = document.getElementById("ch-client-dropdown-badge");
  const allClients = clients || [];
  const count = clientHistorySelectedClientIds.length;

  if (count === 0) {
    if (textEl) textEl.textContent = "Aucun domaine sélectionné";
    if (badgeEl) badgeEl.textContent = "0 sélectionné";
    if (dropdownBadgeEl) dropdownBadgeEl.textContent = "Aucun";
  } else if (count === 1) {
    const c = allClients.find(cl => cl.id === clientHistorySelectedClientIds[0]);
    const name = c ? c.name : "1 domaine";
    if (textEl) textEl.textContent = name;
    if (badgeEl) badgeEl.textContent = "1 sélectionné";
    if (dropdownBadgeEl) dropdownBadgeEl.textContent = "1 sélectionné";
  } else if (count === allClients.length && allClients.length > 1) {
    if (textEl) textEl.textContent = "Tous les domaines viticoles";
    if (badgeEl) badgeEl.textContent = "Tous";
    if (dropdownBadgeEl) dropdownBadgeEl.textContent = "Tous";
  } else {
    const firstClient = allClients.find(cl => cl.id === clientHistorySelectedClientIds[0]);
    const firstName = firstClient ? firstClient.name : "Domaine";
    if (textEl) textEl.textContent = `${firstName} +${count - 1}`;
    if (badgeEl) badgeEl.textContent = `${count} sélectionnés`;
    if (dropdownBadgeEl) dropdownBadgeEl.textContent = `${count} sélectionnés`;
  }
}

function populateClientHistoryClientSelect() {
  initClientHistoryFilterMultiSelect();
  const listEl = document.getElementById("list-ch-filter-client");
  if (!listEl) return;

  listEl.innerHTML = "";
  const allClients = clients || [];

  if (allClients.length === 0) {
    listEl.innerHTML = '<div style="padding: 0.8rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">Aucun domaine viticole enregistré.</div>';
    updateClientHistoryFilterUI();
    return;
  }

  allClients.forEach(c => {
    const isChecked = clientHistorySelectedClientIds.includes(c.id);
    const item = document.createElement("label");
    item.className = `filter-ms-item ${isChecked ? "is-checked" : ""}`;
    item.dataset.clientId = c.id;

    const loc = c.location || c.commune || "Localisation non précisée";
    const parcelCount = (c.parcels || []).length;

    item.innerHTML = `
      <input type="checkbox" class="ch-client-cb" value="${c.id}" ${isChecked ? "checked" : ""}>
      <span class="filter-ms-checkbox-box"></span>
      <div class="filter-ms-item-text">
        <span class="filter-ms-item-title">${escapeHTML(c.name)}</span>
        <span class="filter-ms-item-sub">📍 ${escapeHTML(loc)} • ${parcelCount} parcelle${parcelCount > 1 ? "s" : ""}</span>
      </div>
    `;

    const cb = item.querySelector(".ch-client-cb");
    cb.addEventListener("change", (e) => {
      toggleClientHistoryClient(c.id, e.target.checked);
    });

    listEl.appendChild(item);
  });

  updateClientHistoryFilterUI();
}

function toggleClientHistoryClient(clientId, isChecked) {
  if (isChecked) {
    if (!clientHistorySelectedClientIds.includes(clientId)) {
      clientHistorySelectedClientIds.push(clientId);
    }
  } else {
    clientHistorySelectedClientIds = clientHistorySelectedClientIds.filter(id => id !== clientId);
  }

  clientHistorySelectedClientId = clientHistorySelectedClientIds[0] || null;

  const item = document.querySelector(`#list-ch-filter-client .filter-ms-item[data-client-id="${clientId}"]`);
  if (item) {
    item.classList.toggle("is-checked", isChecked);
    const cb = item.querySelector(".ch-client-cb");
    if (cb) cb.checked = isChecked;
  }

  updateClientHistoryFilterUI();
  handleClientHistoryClientsChangeInternal(isChecked ? clientId : null, !isChecked ? clientId : null);
}

function toggleAllClientHistoryClients(checkAll) {
  const allClients = clients || [];
  if (checkAll) {
    clientHistorySelectedClientIds = allClients.map(c => c.id);
  } else {
    clientHistorySelectedClientIds = [];
  }
  clientHistorySelectedClientId = clientHistorySelectedClientIds[0] || null;

  const checkboxes = document.querySelectorAll("#list-ch-filter-client .ch-client-cb");
  checkboxes.forEach(cb => {
    cb.checked = checkAll;
    const item = cb.closest(".filter-ms-item");
    if (item) item.classList.toggle("is-checked", checkAll);
  });

  updateClientHistoryFilterUI();
  handleClientHistoryClientsChangeInternal();
}

function renderClientHistoryView(preselectedClientId = null) {
  if (preselectedClientId) {
    clientHistorySelectedClientIds = [preselectedClientId];
    clientHistorySelectedClientId = preselectedClientId;
  } else if (clientHistorySelectedClientIds.length === 0 && (clients || []).length > 0) {
    clientHistorySelectedClientIds = [clients[0].id];
    clientHistorySelectedClientId = clients[0].id;
  }

  populateClientHistoryClientSelect();
  handleClientHistoryClientsChangeInternal();
}

function handleClientHistoryClientChange(clientId) {
  if (clientId) {
    clientHistorySelectedClientIds = [clientId];
    clientHistorySelectedClientId = clientId;
  }
  populateClientHistoryClientSelect();
  handleClientHistoryClientsChangeInternal();
}

let _chParcelFilterMsInitialized = false;
function initClientHistoryParcelFilterMultiSelect() {
  if (_chParcelFilterMsInitialized) return;
  _chParcelFilterMsInitialized = true;

  const wrap = document.getElementById("wrap-ch-filter-parcel");
  const btn = document.getElementById("btn-ch-filter-parcel");
  const dropdown = document.getElementById("dropdown-ch-filter-parcel");
  const searchInput = document.getElementById("search-ch-filter-parcel");
  const btnAll = document.getElementById("btn-ch-select-all-parcels");
  const btnClear = document.getElementById("btn-ch-clear-parcels");

  if (btn && dropdown) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = dropdown.style.display === "flex";
      closeAllFilterMultiSelects();
      if (!isOpen) {
        dropdown.style.display = "flex";
        if (wrap) wrap.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
        if (searchInput) setTimeout(() => searchInput.focus(), 60);
      }
    });
  }

  if (dropdown) {
    dropdown.addEventListener("click", (e) => e.stopPropagation());
  }

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase().trim();
      const items = document.querySelectorAll("#list-ch-filter-parcel .filter-ms-item");
      items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(q) ? "flex" : "none";
      });
    });
  }

  if (btnAll) {
    btnAll.addEventListener("click", (e) => {
      e.preventDefault();
      toggleAllClientHistoryParcels(true);
    });
  }

  if (btnClear) {
    btnClear.addEventListener("click", (e) => {
      e.preventDefault();
      toggleAllClientHistoryParcels(false);
    });
  }
}

function updateClientHistoryParcelFilterUI() {
  const textEl = document.getElementById("ch-parcel-text");
  const badgeEl = document.getElementById("ch-parcel-badge");
  const dropdownBadgeEl = document.getElementById("ch-parcel-dropdown-badge");

  const selectedClients = (clients || []).filter(c => clientHistorySelectedClientIds.includes(c.id));
  let totalAvailableParcels = 0;
  selectedClients.forEach(c => {
    totalAvailableParcels += (c.parcels || []).length;
  });

  const countSelected = clientHistorySelectedParcelIds.size;

  if (totalAvailableParcels === 0) {
    if (textEl) textEl.textContent = "Aucune parcelle";
    if (badgeEl) badgeEl.textContent = "0";
    if (dropdownBadgeEl) dropdownBadgeEl.textContent = "0";
  } else if (countSelected === 0) {
    if (textEl) textEl.textContent = "Aucune parcelle cochée";
    if (badgeEl) badgeEl.textContent = `0 / ${totalAvailableParcels}`;
    if (dropdownBadgeEl) dropdownBadgeEl.textContent = "0";
  } else if (countSelected === totalAvailableParcels) {
    if (textEl) textEl.textContent = `Toutes les parcelles (${totalAvailableParcels})`;
    if (badgeEl) badgeEl.textContent = "Toutes";
    if (dropdownBadgeEl) dropdownBadgeEl.textContent = "Toutes";
  } else if (countSelected === 1) {
    let singleParcelName = "1 parcelle";
    for (const c of selectedClients) {
      const found = (c.parcels || []).find(p => clientHistorySelectedParcelIds.has(p.id));
      if (found) { singleParcelName = found.name; break; }
    }
    if (textEl) textEl.textContent = `📍 ${singleParcelName}`;
    if (badgeEl) badgeEl.textContent = `1 / ${totalAvailableParcels}`;
    if (dropdownBadgeEl) dropdownBadgeEl.textContent = `1 / ${totalAvailableParcels}`;
  } else {
    if (textEl) textEl.textContent = `${countSelected} / ${totalAvailableParcels} parcelles`;
    if (badgeEl) badgeEl.textContent = `${countSelected} / ${totalAvailableParcels}`;
    if (dropdownBadgeEl) dropdownBadgeEl.textContent = `${countSelected} / ${totalAvailableParcels}`;
  }
}

function populateClientHistoryParcelSelect() {
  initClientHistoryParcelFilterMultiSelect();
  const listEl = document.getElementById("list-ch-filter-parcel");
  if (!listEl) return;

  listEl.innerHTML = "";
  const selectedClients = (clients || []).filter(c => clientHistorySelectedClientIds.includes(c.id));

  if (selectedClients.length === 0) {
    listEl.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">👆 Cochez au moins un domaine à l\'étape 1.</div>';
    updateClientHistoryParcelFilterUI();
    return;
  }

  let totalParcelsCount = 0;
  selectedClients.forEach(c => {
    totalParcelsCount += (c.parcels || []).length;
  });

  if (totalParcelsCount === 0) {
    listEl.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">Aucune parcelle répertoriée pour ce(s) domaine(s).</div>';
    updateClientHistoryParcelFilterUI();
    return;
  }

  if (selectedClients.length === 1) {
    const singleClient = selectedClients[0];
    (singleClient.parcels || []).forEach(p => {
      const isChecked = clientHistorySelectedParcelIds.has(p.id);
      const item = document.createElement("label");
      item.className = `filter-ms-item ${isChecked ? "is-checked" : ""}`;
      item.dataset.parcelId = p.id;
      const grape = p.grapeVariety ? ` • ${escapeHTML(p.grapeVariety)}` : "";

      item.innerHTML = `
        <input type="checkbox" class="ch-parcel-cb" value="${p.id}" ${isChecked ? "checked" : ""}>
        <span class="filter-ms-checkbox-box"></span>
        <div class="filter-ms-item-text">
          <span class="filter-ms-item-title">📍 ${escapeHTML(p.name)}</span>
          <span class="filter-ms-item-sub">${formatSurface(p.surface)} ha${grape}</span>
        </div>
      `;

      const cb = item.querySelector(".ch-parcel-cb");
      cb.addEventListener("change", (e) => {
        toggleClientHistoryParcel(p.id, e.target.checked);
      });

      listEl.appendChild(item);
    });
  } else {
    // Regroupement élégant par domaine viticole
    selectedClients.forEach(c => {
      const parcels = c.parcels || [];
      if (parcels.length === 0) return;

      const grpHdr = document.createElement("div");
      grpHdr.className = "filter-ms-group-header";
      grpHdr.innerHTML = `
        <span>🍇 ${escapeHTML(c.name)} (${parcels.length})</span>
        <div class="filter-ms-group-actions">
          <button type="button" class="btn-link" onclick="toggleClientGroupParcels('${c.id}', true)">Tout</button>
          <span>•</span>
          <button type="button" class="btn-link" onclick="toggleClientGroupParcels('${c.id}', false)">Aucun</button>
        </div>
      `;
      listEl.appendChild(grpHdr);

      parcels.forEach(p => {
        const isChecked = clientHistorySelectedParcelIds.has(p.id);
        const item = document.createElement("label");
        item.className = `filter-ms-item ${isChecked ? "is-checked" : ""}`;
        item.dataset.parcelId = p.id;
        const grape = p.grapeVariety ? ` • ${escapeHTML(p.grapeVariety)}` : "";

        item.innerHTML = `
          <input type="checkbox" class="ch-parcel-cb" value="${p.id}" ${isChecked ? "checked" : ""}>
          <span class="filter-ms-checkbox-box"></span>
          <div class="filter-ms-item-text">
            <span class="filter-ms-item-title">📍 ${escapeHTML(p.name)}</span>
            <span class="filter-ms-item-sub">${formatSurface(p.surface)} ha${grape}</span>
          </div>
        `;

        const cb = item.querySelector(".ch-parcel-cb");
        cb.addEventListener("change", (e) => {
          toggleClientHistoryParcel(p.id, e.target.checked);
        });

        listEl.appendChild(item);
      });
    });
  }

  updateClientHistoryParcelFilterUI();
}

function handleClientHistoryClientsChangeInternal(addedClientId = null, removedClientId = null) {
  const selectedClients = (clients || []).filter(c => clientHistorySelectedClientIds.includes(c.id));

  const infoPill = document.getElementById("ch-client-info-pill");
  const communeElem = document.getElementById("ch-client-commune");
  const contactElem = document.getElementById("ch-client-contact");

  if (selectedClients.length === 0) {
    if (infoPill) infoPill.style.display = "none";
    clientHistorySelectedParcelIds.clear();
    populateClientHistoryParcelSelect();
    updateClientHistoryData();
    return;
  }

  // Info pill
  if (infoPill) infoPill.style.display = "inline-flex";
  if (selectedClients.length === 1) {
    const singleClient = selectedClients[0];
    if (communeElem) communeElem.textContent = `📍 ${singleClient.location || singleClient.commune || 'Localisation non précisée'}`;
    if (contactElem) contactElem.textContent = `👤 ${singleClient.contact || 'Exploitant'}`;
  } else {
    if (communeElem) communeElem.textContent = `📍 ${selectedClients.length} domaines sélectionnés`;
    if (contactElem) contactElem.textContent = `👤 Multi-domaines viticoles`;
  }

  // Synchronisation des parcelles cochées
  if (addedClientId) {
    const addedClient = selectedClients.find(c => c.id === addedClientId);
    if (addedClient && addedClient.parcels) {
      addedClient.parcels.forEach(p => clientHistorySelectedParcelIds.add(p.id));
    }
  } else if (removedClientId) {
    const removedClient = (clients || []).find(c => c.id === removedClientId);
    if (removedClient && removedClient.parcels) {
      removedClient.parcels.forEach(p => clientHistorySelectedParcelIds.delete(p.id));
    }
  } else {
    clientHistorySelectedParcelIds = new Set();
    selectedClients.forEach(c => {
      (c.parcels || []).forEach(p => clientHistorySelectedParcelIds.add(p.id));
    });
  }

  populateClientHistoryParcelSelect();
  updateClientHistoryData();
}

function toggleClientGroupParcels(clientId, checkAll) {
  const client = (clients || []).find(c => c.id === clientId);
  if (!client || !client.parcels) return;

  client.parcels.forEach(p => {
    if (checkAll) {
      clientHistorySelectedParcelIds.add(p.id);
    } else {
      clientHistorySelectedParcelIds.delete(p.id);
    }
    const item = document.querySelector(`#list-ch-filter-parcel .filter-ms-item[data-parcel-id="${p.id}"]`);
    if (item) {
      item.classList.toggle("is-checked", checkAll);
      const cb = item.querySelector(".ch-parcel-cb");
      if (cb) cb.checked = checkAll;
    }
  });

  updateClientHistoryParcelFilterUI();
  updateClientHistoryData();
}

function toggleClientHistoryParcel(parcelId, isChecked) {
  if (isChecked) {
    clientHistorySelectedParcelIds.add(parcelId);
  } else {
    clientHistorySelectedParcelIds.delete(parcelId);
  }

  const item = document.querySelector(`#list-ch-filter-parcel .filter-ms-item[data-parcel-id="${parcelId}"]`);
  if (item) {
    item.classList.toggle("is-checked", isChecked);
    const cb = item.querySelector(".ch-parcel-cb");
    if (cb) cb.checked = isChecked;
  }

  updateClientHistoryParcelFilterUI();
  updateClientHistoryData();
}

function toggleAllClientHistoryParcels(checkAll) {
  const selectedClients = (clients || []).filter(c => clientHistorySelectedClientIds.includes(c.id));

  if (checkAll) {
    clientHistorySelectedParcelIds.clear();
    selectedClients.forEach(c => {
      (c.parcels || []).forEach(p => clientHistorySelectedParcelIds.add(p.id));
    });
  } else {
    clientHistorySelectedParcelIds.clear();
  }

  const checkboxes = document.querySelectorAll("#list-ch-filter-parcel .ch-parcel-cb");
  checkboxes.forEach(cb => {
    cb.checked = checkAll;
    const item = cb.closest(".filter-ms-item");
    if (item) item.classList.toggle("is-checked", checkAll);
  });

  updateClientHistoryParcelFilterUI();
  updateClientHistoryData();
}

function updateClientHistoryData() {
  const emptyNoClient = document.getElementById("ch-empty-no-client");
  const emptyNoInterventions = document.getElementById("ch-empty-no-interventions");
  const table = document.getElementById("ch-interventions-table");
  const tbody = document.getElementById("ch-interventions-tbody");
  const recapBar = document.getElementById("ch-recap-bar");
  const resetBtn = document.getElementById("btn-reset-ch-filters");

  const selectedClients = (clients || []).filter(c => clientHistorySelectedClientIds.includes(c.id));
  if (selectedClients.length === 0) {
    if (emptyNoClient) emptyNoClient.style.display = "block";
    if (emptyNoInterventions) emptyNoInterventions.style.display = "none";
    if (table) table.style.display = "none";
    if (recapBar) recapBar.style.display = "none";
    resetClientHistoryKPIs();
    return;
  }

  if (emptyNoClient) emptyNoClient.style.display = "none";

  // Collecte des parcelles sélectionnées et surface cumulée
  const selectedParcelNames = [];
  let totalSelectedHa = 0;
  let totalParcelsCount = 0;
  selectedClients.forEach(c => {
    (c.parcels || []).forEach(p => {
      totalParcelsCount++;
      if (clientHistorySelectedParcelIds.has(p.id)) {
        selectedParcelNames.push(p.name.toLowerCase().trim());
        totalSelectedHa += (parseFloat(p.surface) || 0);
      }
    });
  });

  // Filtrage des interventions appartenant aux clients sélectionnés
  const selectedClientIdsSet = new Set(clientHistorySelectedClientIds);
  const selectedClientNamesLower = selectedClients.map(c => c.name.toLowerCase().trim());

  const allSelectedClientsInterventions = (interventions || []).filter(i => {
    if (i.clientId && selectedClientIdsSet.has(i.clientId)) return true;
    if (i.client && selectedClientNamesLower.includes(i.client.toLowerCase().trim())) return true;
    return false;
  });

  let filtered = allSelectedClientsInterventions.filter(i => {
    // Filtrage parcellaire
    if (totalParcelsCount > 0) {
      if (clientHistorySelectedParcelIds.size === 0) return false;
      const allSelected = clientHistorySelectedParcelIds.size === totalParcelsCount;
      if (!allSelected) {
        let match = false;
        if (i.parcelId && clientHistorySelectedParcelIds.has(i.parcelId)) match = true;
        if (Array.isArray(i.parcelIds) && i.parcelIds.some(pid => clientHistorySelectedParcelIds.has(pid))) match = true;
        if (!match && i.parcel) {
          const pLower = i.parcel.toLowerCase();
          if (selectedParcelNames.some(name => pLower.includes(name))) match = true;
        }
        if (!match) return false;
      }
    }

    // Filtre statut
    if (clientHistoryStatusFilter && clientHistoryStatusFilter !== "all") {
      if (i.status !== clientHistoryStatusFilter) return false;
    }

    // Filtre date
    if (clientHistoryDateFilter && clientHistoryDateFilter !== "all") {
      if (!i.datetime) return false;
      const itemDate = new Date(i.datetime.split("T")[0]);
      const now = new Date();
      if (clientHistoryDateFilter === "this_year") {
        if (itemDate.getFullYear() !== now.getFullYear()) return false;
      } else if (clientHistoryDateFilter === "this_month") {
        if (itemDate.getFullYear() !== now.getFullYear() || itemDate.getMonth() !== now.getMonth()) return false;
      } else if (clientHistoryDateFilter === "last_30_days") {
        const past30 = new Date();
        past30.setDate(now.getDate() - 30);
        if (itemDate < past30) return false;
      }
    }

    // Recherche plein texte
    if (clientHistorySearchFilter) {
      const q = clientHistorySearchFilter;
      const inClient = i.client && i.client.toLowerCase().includes(q);
      const inTask = i.task && i.task.toLowerCase().includes(q);
      const inParcel = i.parcel && i.parcel.toLowerCase().includes(q);
      const inWorker = i.worker && i.worker.toLowerCase().includes(q);
      const inNotes = i.notes && i.notes.toLowerCase().includes(q);
      if (!inClient && !inTask && !inParcel && !inWorker && !inNotes) return false;
    }

    return true;
  });

  // Tri par date décroissante
  filtered.sort((a, b) => new Date(b.datetime || 0) - new Date(a.datetime || 0));

  // Calcul des KPIs
  const totalInterventionsCount = filtered.length;
  let totalSurfaceWorked = 0;
  let totalHours = 0;
  let totalHT = 0;
  let totalTTC = 0;
  let unbilledHT = 0;
  let unbilledCount = 0;
  let billedHT = 0;
  let billedCount = 0;

  filtered.forEach(i => {
    const rateType = i.unit || i.rateType || "ha";
    const vol = parseFloat(i.quantity != null ? i.quantity : (i.volume != null ? i.volume : 0)) || 0;
    if (rateType === "ha") totalSurfaceWorked += vol;
    else if (rateType === "h") totalHours += vol;

    const ht = (i.total != null ? parseFloat(i.total) : (parseFloat(i.amount) || 0));
    const ttc = (i.totalTtc != null ? parseFloat(i.totalTtc) : (i.amountTtc != null ? parseFloat(i.amountTtc) : ht * (1 + (typeof getTvaRate === "function" ? getTvaRate(i) : 0.20))));
    totalHT += ht;
    totalTTC += ttc;

    if (i.status === "À facturer") {
      unbilledHT += ht;
      unbilledCount++;
    } else {
      billedHT += ht;
      billedCount++;
    }
  });

  setElemText("ch-kpi-total-interventions", totalInterventionsCount);
  setElemText("ch-kpi-surface-worked", `${formatSurface(totalSurfaceWorked)} ha`);
  setElemText("ch-kpi-hours-worked", `${totalHours.toFixed(1)} h`);
  setElemText("ch-kpi-amount-total", `${formatCurrency(totalHT)} HT`);
  setElemText("ch-kpi-amount-ttc", `${formatCurrency(totalTTC)} TTC`);
  setElemText("ch-kpi-amount-unbilled", `${formatCurrency(unbilledHT)} HT`);
  setElemText("ch-kpi-unbilled-count", `${unbilledCount} chantier(s)`);
  setElemText("ch-kpi-amount-billed", `${formatCurrency(billedHT)} HT`);
  setElemText("ch-kpi-billed-count", `${billedCount} chantier(s)`);

  // Barre récapitulative
  if (recapBar) {
    recapBar.style.display = "flex";
    setElemText("ch-recap-parcels-count", `${clientHistorySelectedParcelIds.size} parcelle(s) sélectionnée(s)`);
    setElemText("ch-recap-surface", `${formatSurface(totalSelectedHa)} ha au cadastre`);
    setElemText("ch-recap-interventions-count", `${totalInterventionsCount} chantier(s) trouvé(s)`);
  }

  // Badges de décompte des statuts
  const allMatchingParcelsInterventions = allSelectedClientsInterventions.filter(i => {
    if (totalParcelsCount > 0) {
      if (clientHistorySelectedParcelIds.size === 0) return false;
      if (clientHistorySelectedParcelIds.size === totalParcelsCount) return true;
      if (i.parcelId && clientHistorySelectedParcelIds.has(i.parcelId)) return true;
      if (Array.isArray(i.parcelIds) && i.parcelIds.some(pid => clientHistorySelectedParcelIds.has(pid))) return true;
      if (i.parcel && selectedParcelNames.some(name => i.parcel.toLowerCase().includes(name))) return true;
      return false;
    }
    return true;
  });
  const countUnbilled = allMatchingParcelsInterventions.filter(i => i.status === "À facturer").length;
  const countBilled = allMatchingParcelsInterventions.filter(i => i.status === "Facturée").length;

  setElemText("ch-count-status-all", allMatchingParcelsInterventions.length);
  setElemText("ch-count-status-unbilled", countUnbilled);
  setElemText("ch-count-status-billed", countBilled);

  setElemText("ch-table-count", `${totalInterventionsCount} chantier${totalInterventionsCount > 1 ? "s" : ""}`);
  setElemText("ch-footer-count", `${totalInterventionsCount} intervention(s) affichée(s)`);

  // Visibilité bouton réinitialiser
  const hasFilter = (clientHistoryStatusFilter && clientHistoryStatusFilter !== "all") ||
                    (clientHistoryDateFilter && clientHistoryDateFilter !== "all") ||
                    (clientHistorySearchFilter && clientHistorySearchFilter !== "");
  if (resetBtn) resetBtn.style.display = hasFilter ? "inline-flex" : "none";

  if (filtered.length === 0) {
    if (tbody) tbody.innerHTML = "";
    if (table) table.style.display = "none";
    if (emptyNoInterventions) {
      emptyNoInterventions.style.display = "block";
      const msgElem = document.getElementById("ch-empty-message");
      if (msgElem) {
        msgElem.textContent = clientHistorySelectedParcelIds.size === 0
          ? "Aucune parcelle n'est cochée. Cochez au moins une parcelle à l'étape 2 pour voir son historique."
          : "Aucun chantier n'a été enregistré pour les parcelles sélectionnées avec ces filtres.";
      }
    }
    return;
  }

  if (emptyNoInterventions) emptyNoInterventions.style.display = "none";
  if (table) table.style.display = "table";

  const isMultiClients = selectedClients.length > 1;

  if (tbody) {
    tbody.innerHTML = filtered.map(i => {
      const formattedDate = formatDateDisplay(i.datetime);
      const dateDisplay = formattedDate.date;
      const timeDisplay = formattedDate.time;
      const statusClass = i.status === "Facturée" ? "status-billed" : "status-unbilled";
      const statusIcon = i.status === "Facturée" ? "✅" : "⏳";
      const vol = (i.quantity != null ? i.quantity : (i.volume != null ? i.volume : 0));
      const rateType = i.unit || i.rateType || "ha";
      const volumeFormatted = formatVolumeUnit(vol, rateType);
      const totalHT = (i.total != null ? parseFloat(i.total) : (parseFloat(i.amount) || 0));
      const totalTTC = (i.totalTtc != null ? parseFloat(i.totalTtc) : (i.amountTtc != null ? parseFloat(i.amountTtc) : totalHT * (1 + (typeof getTvaRate === "function" ? getTvaRate(i) : 0.20))));
      const amountHT = formatCurrency(totalHT);
      const amountTTC = formatCurrency(totalTTC);

      return `
        <tr data-intervention-id="${escapeHTML(i.id)}">
          <td>
            <div style="font-weight: 600; color: var(--text-heading);">${dateDisplay}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${timeDisplay}</div>
          </td>
          <td>
            ${isMultiClients ? `<div style="font-size: 0.76rem; color: #2d6a4f; font-weight: 700; margin-bottom: 2px;">🍇 ${escapeHTML(i.client || "Client")}</div>` : ''}
            <div style="font-weight: 600; color: #52b788; display: flex; align-items: center; gap: 0.35rem;">
              <span>📍</span> <span>${escapeHTML(i.parcel || "Parcelle non spécifiée")}</span>
            </div>
          </td>
          <td>
            <div style="font-weight: 600; color: var(--text-heading);">${escapeHTML(i.task || i.service || "Prestation")}</div>
            ${i.notes ? `<div style="font-size: 0.78rem; color: var(--text-muted); max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHTML(i.notes)}">📝 ${escapeHTML(i.notes)}</div>` : ''}
          </td>
          <td>
            <div style="font-family: monospace; font-weight: 700;">${volumeFormatted}</div>
          </td>
          <td>
            <div style="font-weight: 700; color: var(--text-heading);">${amountHT} HT</div>
          </td>
          <td>
            <div style="font-size: 0.85rem; color: var(--text-muted);">${amountTTC} TTC</div>
          </td>
          <td>
            <button type="button" class="status-pill-toggle status-badge ${statusClass}" onclick="toggleInterventionStatus('${i.id}')" title="Cliquer pour basculer le statut">
              <span>${statusIcon}</span> <span>${escapeHTML(i.status)}</span>
            </button>
          </td>
          <td>
            <div style="font-size: 0.84rem; color: var(--text-heading);">👤 ${escapeHTML(i.worker || "Non assigné")}</div>
          </td>
          <td class="text-right">
            <div class="table-actions" style="justify-content: flex-end;">
              <button type="button" class="action-btn" onclick="openCreateModal('${i.id}')" title="Modifier l'intervention">✏️</button>
              <button type="button" class="action-btn action-btn-danger" onclick="deleteIntervention('${i.id}')" title="Supprimer l'intervention">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }
}

function resetClientHistoryKPIs() {
  setElemText("ch-kpi-total-interventions", "0");
  setElemText("ch-kpi-surface-worked", "0.0000 ha");
  setElemText("ch-kpi-hours-worked", "0 h");
  setElemText("ch-kpi-amount-total", "0.00 € HT");
  setElemText("ch-kpi-amount-ttc", "0.00 € TTC");
  setElemText("ch-kpi-amount-unbilled", "0.00 € HT");
  setElemText("ch-kpi-unbilled-count", "0 chantier(s)");
  setElemText("ch-kpi-amount-billed", "0.00 € HT");
  setElemText("ch-kpi-billed-count", "0 chantier(s)");
}

function filterClientHistoryStatus(status) {
  clientHistoryStatusFilter = status;
  document.querySelectorAll(".ch-status-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.status === status);
  });
  updateClientHistoryData();
}

function handleClientHistoryDateChange(preset) {
  clientHistoryDateFilter = preset;
  updateClientHistoryData();
}

function resetClientHistoryFilters() {
  clientHistoryStatusFilter = "all";
  clientHistoryDateFilter = "all";
  clientHistorySearchFilter = "";

  const searchInput = document.getElementById("ch-search-input");
  if (searchInput) searchInput.value = "";
  const clearBtn = document.getElementById("ch-search-clear");
  if (clearBtn) clearBtn.style.display = "none";
  const dateSelect = document.getElementById("ch-filter-date");
  if (dateSelect) dateSelect.value = "all";

  document.querySelectorAll(".ch-status-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.status === "all");
  });

  updateClientHistoryData();
}

function openCreateModalForCurrentHistoryClient() {
  if (clientHistorySelectedClientIds.length === 1) {
    quickCreateForClient(clientHistorySelectedClientIds[0]);
  } else {
    openCreateModal();
  }
}

function exportClientHistoryCSV() {
  const selectedClients = (clients || []).filter(c => clientHistorySelectedClientIds.includes(c.id));
  if (selectedClients.length === 0) {
    showToast("Veuillez sélectionner au moins un domaine viticole pour exporter l'historique.", "warning");
    return;
  }

  const selectedParcelNames = [];
  let totalParcelsCount = 0;
  selectedClients.forEach(c => {
    (c.parcels || []).forEach(p => {
      totalParcelsCount++;
      if (clientHistorySelectedParcelIds.has(p.id)) {
        selectedParcelNames.push(p.name.toLowerCase().trim());
      }
    });
  });

  const selectedClientIdsSet = new Set(clientHistorySelectedClientIds);
  const selectedClientNamesLower = selectedClients.map(c => c.name.toLowerCase().trim());

  const allSelectedClientsInterventions = (interventions || []).filter(i => {
    if (i.clientId && selectedClientIdsSet.has(i.clientId)) return true;
    if (i.client && selectedClientNamesLower.includes(i.client.toLowerCase().trim())) return true;
    return false;
  });

  const filtered = allSelectedClientsInterventions.filter(i => {
    if (clientHistorySelectedParcelIds.size === 0) return false;
    if (clientHistorySelectedParcelIds.size !== totalParcelsCount) {
      let match = false;
      if (i.parcelId && clientHistorySelectedParcelIds.has(i.parcelId)) match = true;
      if (Array.isArray(i.parcelIds) && i.parcelIds.some(pid => clientHistorySelectedParcelIds.has(pid))) match = true;
      if (!match && i.parcel) {
        const pLower = i.parcel.toLowerCase();
        if (selectedParcelNames.some(name => pLower.includes(name))) match = true;
      }
      if (!match) return false;
    }
    if (clientHistoryStatusFilter && clientHistoryStatusFilter !== "all" && i.status !== clientHistoryStatusFilter) return false;
    return true;
  });

  if (filtered.length === 0) {
    showToast("Aucun chantier à exporter pour cette sélection.", "warning");
    return;
  }

  const headers = ["Date & Heure", "Client", "Parcelle(s)", "Prestation", "Volume", "Unité", "Montant HT", "Montant TTC", "Statut", "Salarié", "Notes"];
  const escapeCSV = (s) => `"${String(s || '').replace(/"/g, '""')}"`;

  const rows = filtered.map(i => [
    escapeCSV(i.datetime),
    escapeCSV(i.client),
    escapeCSV(i.parcel),
    escapeCSV(i.task || i.service),
    i.volume || 0,
    escapeCSV(i.rateType || "ha"),
    i.amount || 0,
    i.amountTtc || (parseFloat(i.amount || 0) * 1.2),
    escapeCSV(i.status),
    escapeCSV(i.worker),
    escapeCSV(i.notes)
  ].join(";"));

  const csvContent = "\uFEFF" + [headers.join(";"), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const today = new Date().toISOString().split("T")[0];
  const filename = selectedClients.length === 1
    ? `historique_${selectedClients[0].name.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${today}.csv`
    : `historique_${selectedClients.length}_domaines_${today}.csv`;
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast("Historique exporté avec succès (CSV) !", "success");
}

// Window Exports for Client History
window.renderClientHistoryView = renderClientHistoryView;
window.populateClientHistoryClientSelect = populateClientHistoryClientSelect;
window.populateClientHistoryParcelSelect = populateClientHistoryParcelSelect;
window.handleClientHistoryClientChange = handleClientHistoryClientChange;
window.initClientHistoryFilterMultiSelect = initClientHistoryFilterMultiSelect;
window.initClientHistoryParcelFilterMultiSelect = initClientHistoryParcelFilterMultiSelect;
window.updateClientHistoryFilterUI = updateClientHistoryFilterUI;
window.updateClientHistoryParcelFilterUI = updateClientHistoryParcelFilterUI;
window.toggleClientHistoryClient = toggleClientHistoryClient;
window.toggleAllClientHistoryClients = toggleAllClientHistoryClients;
window.toggleClientGroupParcels = toggleClientGroupParcels;
window.toggleClientHistoryParcel = toggleClientHistoryParcel;
window.toggleAllClientHistoryParcels = toggleAllClientHistoryParcels;
window.updateClientHistoryData = updateClientHistoryData;
window.filterClientHistoryStatus = filterClientHistoryStatus;
window.handleClientHistoryDateChange = handleClientHistoryDateChange;
window.resetClientHistoryFilters = resetClientHistoryFilters;
window.openCreateModalForCurrentHistoryClient = openCreateModalForCurrentHistoryClient;
window.exportClientHistoryCSV = exportClientHistoryCSV;
window.syncTeamUserToSupabaseAuth = syncTeamUserToSupabaseAuth;

// ==========================================================================
// VUE CALENDRIER & PLANNING AU JOUR LE JOUR
// ==========================================================================

let calendarCurrentDate = new Date();
let calendarViewMode = "month"; // "month" | "week" | "day"
let calendarTypeFilter = "all"; // "all" | "interventions" | "planned" | "harvest"
let calendarClientFilter = "all";
let calendarWorkerFilter = "all";
let calendarSelectedDate = new Date().toISOString().split("T")[0];

const CAL_MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

const CAL_DAYS_FULL_FR = [
  "Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"
];

const CAL_DAYS_SHORT_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function initCalendarControls() {
  const btnPrev = document.getElementById("btn-cal-prev");
  const btnNext = document.getElementById("btn-cal-next");
  const btnToday = document.getElementById("btn-cal-today");

  const btnMonth = document.getElementById("btn-cal-mode-month");
  const btnWeek = document.getElementById("btn-cal-mode-week");
  const btnDay = document.getElementById("btn-cal-mode-day");

  const filterType = document.getElementById("cal-filter-type");
  const filterClient = document.getElementById("cal-filter-client");
  const filterWorker = document.getElementById("cal-filter-worker");

  const btnAgendaPlan = document.getElementById("btn-cal-agenda-plan");
  const btnAgendaAdd = document.getElementById("btn-cal-agenda-add");

  if (btnPrev) btnPrev.addEventListener("click", () => navigateCalendar(-1));
  if (btnNext) btnNext.addEventListener("click", () => navigateCalendar(1));
  if (btnToday) btnToday.addEventListener("click", () => {
    calendarCurrentDate = new Date();
    calendarSelectedDate = new Date().toISOString().split("T")[0];
    renderCalendarView();
  });

  if (btnMonth) btnMonth.addEventListener("click", () => setCalendarViewMode("month"));
  if (btnWeek) btnWeek.addEventListener("click", () => setCalendarViewMode("week"));
  if (btnDay) btnDay.addEventListener("click", () => setCalendarViewMode("day"));

  if (filterType) filterType.addEventListener("change", (e) => {
    calendarTypeFilter = e.target.value;
    renderCalendarView();
  });
  if (filterClient) filterClient.addEventListener("change", (e) => {
    calendarClientFilter = e.target.value;
    renderCalendarView();
  });
  if (filterWorker) filterWorker.addEventListener("change", (e) => {
    calendarWorkerFilter = e.target.value;
    renderCalendarView();
  });

  if (btnAgendaPlan) btnAgendaPlan.addEventListener("click", () => {
    openPlannedModal(calendarSelectedDate);
  });
  if (btnAgendaAdd) btnAgendaAdd.addEventListener("click", () => {
    openCreateModal(null, calendarSelectedDate);
  });
}

function setCalendarViewMode(mode) {
  calendarViewMode = mode;
  ["month", "week", "day"].forEach(m => {
    const btn = document.getElementById(`btn-cal-mode-${m}`);
    const panel = document.getElementById(`cal-view-${m}`);
    if (btn) btn.classList.toggle("active", m === mode);
    if (panel) panel.style.display = m === mode ? "block" : "none";
  });

  if (mode === "day" && calendarSelectedDate) {
    const parts = calendarSelectedDate.split("-").map(Number);
    if (parts.length === 3 && !isNaN(parts[0])) {
      calendarCurrentDate = new Date(parts[0], parts[1] - 1, parts[2]);
    }
  }

  const agendaSec = document.getElementById("cal-selected-day-agenda");
  if (agendaSec) {
    agendaSec.style.display = mode === "month" ? "flex" : "none";
  }

  renderCalendarView();
}

function navigateCalendar(delta) {
  const cur = new Date(calendarCurrentDate);
  if (calendarViewMode === "month") {
    cur.setMonth(cur.getMonth() + delta);
  } else if (calendarViewMode === "week") {
    cur.setDate(cur.getDate() + (delta * 7));
  } else if (calendarViewMode === "day") {
    cur.setDate(cur.getDate() + delta);
    calendarSelectedDate = cur.toISOString().split("T")[0];
  }
  calendarCurrentDate = cur;
  renderCalendarView();
}

// Extraction globale et unifiée de tous les événements
function getAllCalendarEvents() {
  const events = [];

  // 1. Interventions réalisées
  (interventions || []).forEach(inv => {
    if (!inv) return;
    const dateStr = (inv.datetime || "").split("T")[0].split(" ")[0];
    if (!dateStr || dateStr.length < 10) return;
    events.push({
      id: inv.id,
      type: "intervention",
      date: dateStr,
      time: (inv.datetime && inv.datetime.includes("T")) ? inv.datetime.split("T")[1].slice(0, 5) : "",
      title: inv.task || inv.service || "Intervention viticole",
      client: inv.client || "Client non spécifié",
      clientId: inv.clientId || "",
      parcel: inv.parcel || "",
      worker: inv.worker || "",
      quantity: parseFloat(inv.quantity || 0),
      rateType: inv.rateType || "ha",
      unit: inv.unit || inv.rateType || "ha",
      unitPrice: parseFloat(inv.unitPrice || 0),
      amount: parseFloat(inv.total || 0),
      status: inv.status || "À facturer",
      notes: inv.notes || "",
      raw: inv
    });
  });

  // 2. Travaux à faire & Planifiés
  (plannedWorks || []).forEach(pw => {
    if (!pw) return;
    const dateStr = (pw.date || "").split("T")[0];
    if (!dateStr || dateStr.length < 10) return;
    events.push({
      id: pw.id,
      type: "planned",
      date: dateStr,
      time: "",
      title: pw.service || "Travail planifié",
      client: pw.clientName || "Client non spécifié",
      clientId: pw.clientId || "",
      parcel: pw.parcel || "",
      worker: pw.worker || "",
      quantity: parseFloat(pw.quantity || 0),
      rateType: "ha",
      unit: "ha",
      unitPrice: 0,
      amount: 0,
      status: pw.status || "À réaliser",
      notes: pw.notes || "",
      raw: pw
    });
  });

  // 3. Suivi des vendanges
  (harvestWorks || []).forEach(hw => {
    if (!hw) return;
    const dateStr = (hw.cutDate || hw.date || "").split("T")[0];
    if (!dateStr || dateStr.length < 10) return;
    events.push({
      id: hw.id || ("HW-" + Math.random().toString(36).slice(2, 7)),
      type: "harvest",
      date: dateStr,
      time: "",
      title: `Vendange • ${hw.grape || "Cépage"}`,
      client: hw.clientName || hw.domain || "Domaine",
      clientId: hw.clientId || "",
      parcel: hw.parcelName || hw.parcel || "",
      worker: hw.worker || "",
      quantity: parseFloat(hw.surface || 0),
      rateType: "kg",
      unit: "ha",
      amount: 0,
      status: hw.statusCut === "COUPEE" ? "Coupée" : "À couper",
      notes: hw.notes || "",
      raw: hw
    });
  });

  return events;
}

function countCalendarEventsForDate(dateStr) {
  if (!dateStr) return 0;
  const all = getAllCalendarEvents();
  return all.filter(e => e.date === dateStr).length;
}

function getFilteredCalendarEvents() {
  const all = getAllCalendarEvents();
  return all.filter(e => {
    if (calendarTypeFilter === "interventions" && e.type !== "intervention") return false;
    if (calendarTypeFilter === "planned" && e.type !== "planned") return false;
    if (calendarTypeFilter === "harvest" && e.type !== "harvest") return false;

    if (calendarClientFilter !== "all") {
      const matchName = (e.client || "").toLowerCase() === calendarClientFilter.toLowerCase();
      const matchId = e.clientId === calendarClientFilter;
      if (!matchName && !matchId) return false;
    }

    if (calendarWorkerFilter !== "all") {
      const wLower = (e.worker || "").toLowerCase().trim();
      const targetLower = calendarWorkerFilter.toLowerCase().trim();
      if (!wLower.includes(targetLower)) return false;
    }

    return true;
  });
}

function getCalendarPeriodBounds(mode, refDate) {
  const d = new Date(refDate);
  const y = d.getFullYear();
  const m = d.getMonth();

  if (mode === "month") {
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);
    const title = `${CAL_MONTHS_FR[m]} ${y}`;
    return {
      start: firstDay.toISOString().split("T")[0],
      end: lastDay.toISOString().split("T")[0],
      title
    };
  } else if (mode === "week") {
    const dayOfWeek = d.getDay();
    const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const monStr = `${monday.getDate()} ${CAL_MONTHS_FR[monday.getMonth()].slice(0, 4)}.`;
    const sunStr = `${sunday.getDate()} ${CAL_MONTHS_FR[sunday.getMonth()].slice(0, 4)}. ${sunday.getFullYear()}`;
    const title = `Semaine • ${monStr} au ${sunStr}`;
    return {
      start: monday.toISOString().split("T")[0],
      end: sunday.toISOString().split("T")[0],
      title
    };
  } else {
    const dayName = CAL_DAYS_FULL_FR[d.getDay()];
    const dayNum = d.getDate();
    const monthName = CAL_MONTHS_FR[m];
    const title = `${dayName} ${dayNum === 1 ? "1er" : dayNum} ${monthName} ${y}`;
    const dateStr = d.toISOString().split("T")[0];
    return {
      start: dateStr,
      end: dateStr,
      title
    };
  }
}

function populateCalendarFilterSelects() {
  const clientSelect = document.getElementById("cal-filter-client");
  const workerSelect = document.getElementById("cal-filter-worker");

  if (clientSelect) {
    const prevClient = clientSelect.value || "all";
    const clientMap = new Map();
    (clients || []).forEach(c => clientMap.set(c.id, c.name));
    (interventions || []).forEach(i => {
      if (i.client && !clientMap.has(i.clientId || i.client)) clientMap.set(i.clientId || i.client, i.client);
    });
    (plannedWorks || []).forEach(pw => {
      if (pw.clientName && !clientMap.has(pw.clientId || pw.clientName)) clientMap.set(pw.clientId || pw.clientName, pw.clientName);
    });

    let html = '<option value="all">🍇 Tous les domaines</option>';
    clientMap.forEach((name, id) => {
      html += `<option value="${escapeHTML(id)}">${escapeHTML(name)}</option>`;
    });
    clientSelect.innerHTML = html;
    if (Array.from(clientSelect.options).some(o => o.value === prevClient)) {
      clientSelect.value = prevClient;
    }
  }

  if (workerSelect) {
    const prevWorker = workerSelect.value || "all";
    const workerSet = new Set();
    (teamUsers || []).forEach(u => { if (u.name) workerSet.add(u.name); });
    (interventions || []).forEach(i => { if (i.worker) workerSet.add(i.worker); });
    (plannedWorks || []).forEach(pw => { if (pw.worker) workerSet.add(pw.worker); });

    let html = '<option value="all">👥 Toute l\'équipe</option>';
    workerSet.forEach(name => {
      html += `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`;
    });
    workerSelect.innerHTML = html;
    if (Array.from(workerSelect.options).some(o => o.value === prevWorker)) {
      workerSelect.value = prevWorker;
    }
  }
}

function calculateAndRenderCalendarKPIs(events, startStr, endStr) {
  const periodEvents = events.filter(e => e.date >= startStr && e.date <= endStr);
  const doneEvents = periodEvents.filter(e => e.type === "intervention");
  const plannedEvents = periodEvents.filter(e => e.type === "planned");

  let totalSurface = 0;
  let totalHours = 0;
  let totalRevenue = 0;
  const activeDates = new Set();

  periodEvents.forEach(e => {
    activeDates.add(e.date);
    if (e.type === "intervention") {
      if (e.unit === "ha" || e.rateType === "ha") {
        totalSurface += (e.quantity || 0);
      } else if (e.unit === "h" || e.rateType === "hourly") {
        totalHours += (e.quantity || 0);
      }
      totalRevenue += (e.amount || 0);
    } else if (e.type === "planned") {
      totalSurface += (e.quantity || 0);
    }
  });

  const totalRevenueTTC = totalRevenue * 1.20;

  const todayStr = new Date().toISOString().split("T")[0];
  const todayEvents = events.filter(e => e.date === todayStr);

  setElemText("cal-kpi-total-events", periodEvents.length);
  setElemText("cal-kpi-done-count", `${doneEvents.length} réalisé${doneEvents.length > 1 ? 's' : ''}`);
  setElemText("cal-kpi-planned-count", `${plannedEvents.length} planifié${plannedEvents.length > 1 ? 's' : ''}`);

  setElemText("cal-kpi-surface", `${formatSurface(totalSurface)} ha`);
  setElemText("cal-kpi-hours", `${totalHours.toFixed(1)} h machine`);

  setElemText("cal-kpi-revenue", formatCurrency(totalRevenue));
  setElemText("cal-kpi-revenue-ttc", `${formatCurrency(totalRevenueTTC)} TTC`);

  setElemText("cal-kpi-active-days", `${activeDates.size} j`);
  setElemText("cal-kpi-today-status", `Aujourd'hui : ${todayEvents.length} chantier${todayEvents.length > 1 ? 's' : ''}`);
}

function renderCalendarMonthGrid(events) {
  const gridEl = document.getElementById("cal-month-grid-days");
  if (!gridEl) return;
  gridEl.innerHTML = "";

  const y = calendarCurrentDate.getFullYear();
  const m = calendarCurrentDate.getMonth();
  const firstDayOfMonth = new Date(y, m, 1);
  const lastDayOfMonth = new Date(y, m + 1, 0);

  let startDayOfWeek = firstDayOfMonth.getDay();
  startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // 0 = Lundi, 6 = Dimanche

  const totalDays = lastDayOfMonth.getDate();
  const prevMonthLastDay = new Date(y, m, 0).getDate();

  const todayStr = new Date().toISOString().split("T")[0];

  // Jours du mois précédent
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthLastDay - i;
    const prevDate = new Date(y, m - 1, dayNum);
    const dateStr = prevDate.toISOString().split("T")[0];
    const cell = createCalendarMonthDayCell(dayNum, dateStr, events, true, dateStr === todayStr, dateStr === calendarSelectedDate);
    gridEl.appendChild(cell);
  }

  // Jours du mois en cours
  for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
    const curDate = new Date(y, m, dayNum);
    const dateStr = curDate.toISOString().split("T")[0];
    const cell = createCalendarMonthDayCell(dayNum, dateStr, events, false, dateStr === todayStr, dateStr === calendarSelectedDate);
    gridEl.appendChild(cell);
  }

  // Jours du mois suivant
  const currentTotalCells = startDayOfWeek + totalDays;
  const neededCells = currentTotalCells <= 35 ? 35 : 42;
  const remaining = neededCells - currentTotalCells;

  for (let dayNum = 1; dayNum <= remaining; dayNum++) {
    const nextDate = new Date(y, m + 1, dayNum);
    const dateStr = nextDate.toISOString().split("T")[0];
    const cell = createCalendarMonthDayCell(dayNum, dateStr, events, true, dateStr === todayStr, dateStr === calendarSelectedDate);
    gridEl.appendChild(cell);
  }
}

function createCalendarMonthDayCell(dayNum, dateStr, events, isOtherMonth, isToday, isSelected) {
  const cell = document.createElement("div");
  cell.className = `cal-day-cell ${isOtherMonth ? "is-other-month" : ""} ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}`;
  cell.dataset.date = dateStr;

  const dayEvents = events.filter(e => e.date === dateStr);

  const topDiv = document.createElement("div");
  topDiv.className = "cal-day-top";

  const numSpan = document.createElement("span");
  numSpan.className = "cal-day-num";
  numSpan.textContent = dayNum;
  topDiv.appendChild(numSpan);

  const actionsDiv = document.createElement("div");
  actionsDiv.className = "cal-day-quick-actions";

  if (dayEvents.length > 0) {
    const badge = document.createElement("span");
    badge.className = "cal-day-count-badge";
    badge.textContent = dayEvents.length;
    actionsDiv.appendChild(badge);
  }

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "cal-day-add-btn";
  addBtn.title = `Ajouter une intervention pour le ${dateStr}`;
  addBtn.innerHTML = "＋";
  addBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openCreateModal(null, dateStr);
  });
  actionsDiv.appendChild(addBtn);

  topDiv.appendChild(actionsDiv);
  cell.appendChild(topDiv);

  const listDiv = document.createElement("div");
  listDiv.className = "cal-day-events-list";

  const maxVisible = 3;
  dayEvents.slice(0, maxVisible).forEach(evt => {
    const pill = document.createElement("div");
    let pillTypeClass = "cal-pill-done";
    let icon = "🚜";
    if (evt.type === "planned") {
      pillTypeClass = "cal-pill-planned";
      icon = "📌";
    } else if (evt.type === "harvest") {
      pillTypeClass = "cal-pill-harvest";
      icon = "🍇";
    }
    pill.className = `cal-event-pill ${pillTypeClass}`;
    pill.title = `${evt.client} - ${evt.title} (${evt.worker || 'Non assigné'})`;
    pill.innerHTML = `<span>${icon}</span> <strong style="max-width: 65px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(evt.client)}</strong> <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(evt.title)}</span>`;
    listDiv.appendChild(pill);
  });

  if (dayEvents.length > maxVisible) {
    const morePill = document.createElement("div");
    morePill.className = "cal-more-pill";
    morePill.textContent = `+${dayEvents.length - maxVisible} de plus`;
    listDiv.appendChild(morePill);
  }

  cell.appendChild(listDiv);

  cell.addEventListener("click", () => {
    calendarSelectedDate = dateStr;
    const allCells = document.querySelectorAll(".cal-day-cell");
    allCells.forEach(c => c.classList.remove("is-selected"));
    cell.classList.add("is-selected");
    renderCalendarSelectedDayAgenda(dateStr, events);
  });

  cell.addEventListener("dblclick", () => {
    calendarSelectedDate = dateStr;
    setCalendarViewMode("day");
  });

  return cell;
}

function renderCalendarWeekGrid(events, mondayStr) {
  const container = document.getElementById("cal-week-grid-container");
  if (!container) return;
  container.innerHTML = "";

  const [y, m, d] = mondayStr.split("-").map(Number);
  const monday = new Date(y, m - 1, d);
  const todayStr = new Date().toISOString().split("T")[0];

  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    const dateStr = cur.toISOString().split("T")[0];
    const dayEvents = events.filter(e => e.date === dateStr);
    const isToday = dateStr === todayStr;

    const col = document.createElement("div");
    col.className = `cal-week-col ${isToday ? "is-today" : ""}`;

    const colHeader = document.createElement("div");
    colHeader.className = "cal-week-col-header";
    colHeader.innerHTML = `
      <div class="cal-week-dayname">${CAL_DAYS_SHORT_FR[i]}</div>
      <div class="cal-week-daynum">${cur.getDate()}</div>
      <span class="cal-week-count">${dayEvents.length} chantier(s)</span>
    `;
    colHeader.addEventListener("click", () => {
      calendarSelectedDate = dateStr;
      setCalendarViewMode("day");
    });
    col.appendChild(colHeader);

    const colBody = document.createElement("div");
    colBody.className = "cal-week-body";

    if (dayEvents.length === 0) {
      const emptyP = document.createElement("div");
      emptyP.className = "cal-week-empty-text";
      emptyP.textContent = "Aucun chantier";
      colBody.appendChild(emptyP);
    } else {
      dayEvents.forEach(evt => {
        const card = document.createElement("div");
        let cardTypeClass = "card-done";
        let icon = "🚜";
        let badgeText = "Réalisé";
        if (evt.type === "planned") {
          cardTypeClass = "card-planned";
          icon = "📌";
          badgeText = "À faire";
        } else if (evt.type === "harvest") {
          cardTypeClass = "card-harvest";
          icon = "🍇";
          badgeText = "Vendange";
        }
        card.className = `cal-card-compact ${cardTypeClass}`;
        card.innerHTML = `
          <div class="cal-card-top-row">
            <span>${icon} ${badgeText}</span>
            <span>${evt.time || (evt.quantity ? evt.quantity + " ha" : "")}</span>
          </div>
          <div class="cal-card-title">${escapeHTML(evt.title)}</div>
          <div class="cal-card-client">🏰 ${escapeHTML(evt.client)}</div>
          <div class="cal-card-meta">
            <span>👤 ${escapeHTML(evt.worker || "Équipe")}</span>
            ${evt.amount > 0 ? `<strong>${formatCurrency(evt.amount)}</strong>` : ""}
          </div>
        `;
        card.addEventListener("click", () => {
          calendarSelectedDate = dateStr;
          setCalendarViewMode("day");
        });
        colBody.appendChild(card);
      });
    }

    col.appendChild(colBody);
    container.appendChild(col);
  }
}

function renderCalendarDayView(dateStr, events) {
  const container = document.getElementById("cal-day-container-content");
  if (!container) return;
  container.innerHTML = "";

  const [y, m, d] = dateStr.split("-").map(Number);
  const curDate = new Date(y, m - 1, d);
  const dayName = CAL_DAYS_FULL_FR[curDate.getDay()];
  const dayNum = curDate.getDate();
  const monthName = CAL_MONTHS_FR[curDate.getMonth()];
  const fullDateLabel = `${dayName} ${dayNum === 1 ? "1er" : dayNum} ${monthName} ${curDate.getFullYear()}`;

  const dayEvents = events.filter(e => e.date === dateStr);
  const interventionsList = dayEvents.filter(e => e.type === "intervention");
  const plannedList = dayEvents.filter(e => e.type === "planned");
  const harvestList = dayEvents.filter(e => e.type === "harvest");

  let totalSurface = 0;
  let totalRevenue = 0;
  const workersSet = new Set();

  dayEvents.forEach(e => {
    if (e.quantity && (e.unit === "ha" || e.rateType === "ha")) totalSurface += e.quantity;
    if (e.amount) totalRevenue += e.amount;
    if (e.worker) workersSet.add(e.worker);
  });

  // Bannière du jour
  const banner = document.createElement("div");
  banner.className = "cal-day-banner";
  banner.innerHTML = `
    <div class="cal-day-banner-left">
      <span class="cal-day-banner-label">Planning & Suivi au Jour le Jour</span>
      <div class="cal-day-banner-date">📅 ${fullDateLabel}</div>
    </div>
    <div class="cal-day-banner-stats">
      <div class="cal-day-stat-chip">
        <span class="cal-day-stat-num">${dayEvents.length}</span>
        <span class="cal-day-stat-desc">Chantier(s)</span>
      </div>
      <div class="cal-day-stat-chip">
        <span class="cal-day-stat-num">${formatSurface(totalSurface)} ha</span>
        <span class="cal-day-stat-desc">Surface</span>
      </div>
      <div class="cal-day-stat-chip">
        <span class="cal-day-stat-num">${formatCurrency(totalRevenue)}</span>
        <span class="cal-day-stat-desc">Total HT</span>
      </div>
      <div class="cal-day-stat-chip">
        <span class="cal-day-stat-num">${workersSet.size}</span>
        <span class="cal-day-stat-desc">Salarié(s)</span>
      </div>
    </div>
    <div class="cal-day-banner-actions">
      <button type="button" class="btn btn-outline btn-sm" onclick="openPlannedModal('${dateStr}')">
        <span>📌 Planifier ce jour</span>
      </button>
      <button type="button" class="btn btn-primary btn-sm" onclick="openCreateModal(null, '${dateStr}')">
        <span>＋ Saisir intervention</span>
      </button>
    </div>
  `;
  container.appendChild(banner);

  if (dayEvents.length === 0) {
    const emptyBox = document.createElement("div");
    emptyBox.className = "cal-day-empty";
    emptyBox.innerHTML = `
      <div class="cal-empty-icon">🍇</div>
      <div class="cal-empty-title">Aucun chantier programmé pour le ${fullDateLabel}</div>
      <div class="cal-empty-sub">Tous les travaux réalisés ou prévus pour cette journée apparaîtront ici avec leur détail complet.</div>
      <div class="cal-empty-btns">
        <button type="button" class="btn btn-primary btn-sm" onclick="openCreateModal(null, '${dateStr}')">
          <span>🚜 Enregistrer une intervention</span>
        </button>
        <button type="button" class="btn btn-outline btn-sm" onclick="openPlannedModal('${dateStr}')">
          <span>📌 Planifier un travail</span>
        </button>
      </div>
    `;
    container.appendChild(emptyBox);
    return;
  }

  const sectionsGrid = document.createElement("div");
  sectionsGrid.className = "cal-day-sections-grid";

  // Section 1 : Interventions Réalisées
  if (interventionsList.length > 0) {
    const sec1 = document.createElement("div");
    sec1.innerHTML = `
      <div class="cal-day-group-header">
        <div class="cal-day-group-title">
          <span>🚜</span>
          <span>Interventions Réalisées du Jour</span>
        </div>
        <span class="cal-day-group-count">${interventionsList.length} réalisée(s)</span>
      </div>
    `;
    const cardsList = document.createElement("div");
    cardsList.className = "cal-day-cards-list";

    interventionsList.forEach(inv => {
      const card = createCalendarFullEventCard(inv);
      cardsList.appendChild(card);
    });
    sec1.appendChild(cardsList);
    sectionsGrid.appendChild(sec1);
  }

  // Section 2 : Travaux Planifiés & À Réaliser
  if (plannedList.length > 0) {
    const sec2 = document.createElement("div");
    sec2.innerHTML = `
      <div class="cal-day-group-header">
        <div class="cal-day-group-title">
          <span>📌</span>
          <span>Travaux à Réaliser & Planifiés</span>
        </div>
        <span class="cal-day-group-count">${plannedList.length} à faire</span>
      </div>
    `;
    const cardsList = document.createElement("div");
    cardsList.className = "cal-day-cards-list";

    plannedList.forEach(pw => {
      const card = createCalendarFullEventCard(pw);
      cardsList.appendChild(card);
    });
    sec2.appendChild(cardsList);
    sectionsGrid.appendChild(sec2);
  }

  // Section 3 : Vendanges & Récoltes
  if (harvestList.length > 0) {
    const sec3 = document.createElement("div");
    sec3.innerHTML = `
      <div class="cal-day-group-header">
        <div class="cal-day-group-title">
          <span>🍇</span>
          <span>Vendanges & Récoltes</span>
        </div>
        <span class="cal-day-group-count">${harvestList.length} parcelle(s)</span>
      </div>
    `;
    const cardsList = document.createElement("div");
    cardsList.className = "cal-day-cards-list";

    harvestList.forEach(hw => {
      const card = createCalendarFullEventCard(hw);
      cardsList.appendChild(card);
    });
    sec3.appendChild(cardsList);
    sectionsGrid.appendChild(sec3);
  }

  container.appendChild(sectionsGrid);
}

function createCalendarFullEventCard(evt) {
  const card = document.createElement("div");
  let cardClass = "card-done";
  if (evt.type === "planned") cardClass = "card-planned";
  if (evt.type === "harvest") cardClass = "card-harvest";
  card.className = `cal-full-card ${cardClass}`;

  if (evt.type === "intervention") {
    const isBilled = evt.status === "Facturée";
    const statusBadgeClass = isBilled ? "status-facturee" : "status-a-facturer";
    const statusBadgeIcon = isBilled ? "✅" : "⏳";

    card.innerHTML = `
      <div class="cal-full-card-header">
        <div>
          <div class="cal-full-card-task">${escapeHTML(evt.title)}</div>
          <div class="cal-full-card-client-row">
            <span>🏰 ${escapeHTML(evt.client)}</span>
            ${evt.time ? `<span style="color: var(--color-text-secondary); font-size: 0.78rem;">• 🕒 ${evt.time}</span>` : ""}
          </div>
        </div>
        <button type="button" class="status-badge ${statusBadgeClass}" onclick="toggleInterventionStatus('${evt.id}'); renderCalendarView();" title="Cliquer pour basculer le statut de facturation">
          <span>${statusBadgeIcon} ${escapeHTML(evt.status)}</span>
        </button>
      </div>

      <div>
        <span class="cal-full-card-parcel-tag">🌿 Parcelles : ${escapeHTML(evt.parcel || "Toutes")}</span>
      </div>

      <div class="cal-full-card-metrics-grid">
        <div class="cal-metric-box">
          <span class="cal-metric-label">Volume / Surface</span>
          <span class="cal-metric-val">${formatVolumeUnit(evt.quantity, evt.rateType)}</span>
        </div>
        <div class="cal-metric-box">
          <span class="cal-metric-label">Prix unitaire HT</span>
          <span class="cal-metric-val">${formatCurrency(evt.unitPrice)}</span>
        </div>
        <div class="cal-metric-box">
          <span class="cal-metric-label">Montant HT</span>
          <span class="cal-metric-val" style="color: #74c69d;">${formatCurrency(evt.amount)} HT</span>
        </div>
        <div class="cal-metric-box">
          <span class="cal-metric-label">Montant TTC</span>
          <span class="cal-metric-val">${formatCurrency(evt.amount * 1.20)} TTC</span>
        </div>
      </div>

      <div class="cal-full-card-footer">
        <div class="cal-full-card-worker">
          <span>👤</span>
          <span>${escapeHTML(evt.worker || "Équipe générale")}</span>
        </div>
        <div class="cal-full-card-actions">
          ${evt.clientId ? `<button type="button" class="btn btn-outline btn-xs" onclick="openClientDossier('${evt.clientId}')" title="Voir le dossier complet du client">📋 Dossier</button>` : ""}
          <button type="button" class="btn btn-outline btn-xs" onclick="openCreateModal('${evt.id}')" title="Modifier l'intervention">✏️ Modifier</button>
        </div>
      </div>
    `;
  } else if (evt.type === "planned") {
    card.innerHTML = `
      <div class="cal-full-card-header">
        <div>
          <div class="cal-full-card-task">${escapeHTML(evt.title)}</div>
          <div class="cal-full-card-client-row">
            <span>🏰 ${escapeHTML(evt.client)}</span>
          </div>
        </div>
        <span class="status-badge" style="background: rgba(245, 158, 11, 0.2); color: #fde68a; border: 1px solid rgba(245, 158, 11, 0.5);">
          <span>📌 À réaliser</span>
        </span>
      </div>

      <div>
        <span class="cal-full-card-parcel-tag">🌿 Parcelles prévues : ${escapeHTML(evt.parcel || "À définir")}</span>
      </div>

      <div class="cal-full-card-metrics-grid">
        <div class="cal-metric-box">
          <span class="cal-metric-label">Surface prévue</span>
          <span class="cal-metric-val">${formatSurface(evt.quantity)} ha</span>
        </div>
        <div class="cal-metric-box">
          <span class="cal-metric-label">Salarié assigné</span>
          <span class="cal-metric-val">${escapeHTML(evt.worker || "Non assigné")}</span>
        </div>
      </div>

      <div class="cal-full-card-footer">
        <div class="cal-full-card-worker">
          <span>💡 Travail prévisionnel</span>
        </div>
        <div class="cal-full-card-actions">
          <button type="button" class="btn btn-primary btn-xs" onclick="window.convertPlannedWork('${evt.id}')" title="Convertir en intervention réalisée">
            <span>🚜 Valider & enregistrer comme fait</span>
          </button>
        </div>
      </div>
    `;
  } else if (evt.type === "harvest") {
    card.innerHTML = `
      <div class="cal-full-card-header">
        <div>
          <div class="cal-full-card-task">${escapeHTML(evt.title)}</div>
          <div class="cal-full-card-client-row">
            <span>🏰 ${escapeHTML(evt.client)}</span>
          </div>
        </div>
        <span class="status-badge" style="background: rgba(168, 85, 247, 0.2); color: #e9d5ff; border: 1px solid rgba(168, 85, 247, 0.5);">
          <span>🍇 ${escapeHTML(evt.status)}</span>
        </span>
      </div>

      <div>
        <span class="cal-full-card-parcel-tag">🌿 Parcelle : ${escapeHTML(evt.parcel || "Vignoble")}</span>
      </div>

      <div class="cal-full-card-metrics-grid">
        <div class="cal-metric-box">
          <span class="cal-metric-label">Superficie</span>
          <span class="cal-metric-val">${formatSurface(evt.quantity)} ha</span>
        </div>
        <div class="cal-metric-box">
          <span class="cal-metric-label">Étape vendange</span>
          <span class="cal-metric-val">${escapeHTML(evt.status)}</span>
        </div>
      </div>

      <div class="cal-full-card-footer">
        <div class="cal-full-card-worker">
          <span>🧺 Suivi vendange</span>
        </div>
        <div class="cal-full-card-actions">
          <button type="button" class="btn btn-outline btn-xs" onclick="switchView('vendanges')" title="Consulter le pilotage vendanges">
            <span>🍇 Suivi vendanges</span>
          </button>
        </div>
      </div>
    `;
  }

  return card;
}

function renderCalendarSelectedDayAgenda(dateStr, events) {
  const container = document.getElementById("cal-agenda-items-list");
  const titleEl = document.getElementById("cal-agenda-date-title");
  const subtitleEl = document.getElementById("cal-agenda-date-subtitle");
  if (!container) return;

  const [y, m, d] = dateStr.split("-").map(Number);
  const curDate = new Date(y, m - 1, d);
  const dayName = CAL_DAYS_FULL_FR[curDate.getDay()];
  const dayNum = curDate.getDate();
  const monthName = CAL_MONTHS_FR[curDate.getMonth()];
  const formattedDate = `${dayName} ${dayNum === 1 ? "1er" : dayNum} ${monthName} ${curDate.getFullYear()}`;

  if (titleEl) titleEl.textContent = `Chantiers du ${formattedDate}`;

  const dayEvents = events.filter(e => e.date === dateStr);

  if (subtitleEl) {
    subtitleEl.textContent = dayEvents.length === 0
      ? `Aucun chantier pour cette journée. Cliquez sur « ＋ Saisir intervention » pour ajouter un travail.`
      : `${dayEvents.length} chantier(s) répertorié(s) pour cette journée.`;
  }

  container.innerHTML = "";

  if (dayEvents.length === 0) {
    const emptyRow = document.createElement("div");
    emptyRow.style.textAlign = "center";
    emptyRow.style.padding = "1.5rem";
    emptyRow.style.color = "var(--color-text-secondary)";
    emptyRow.style.fontSize = "0.88rem";
    emptyRow.innerHTML = `
      <span>🌱 Aucun chantier enregistré le ${formattedDate}.</span>
      <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem; justify-content: center;">
        <button type="button" class="btn btn-primary btn-xs" onclick="openCreateModal(null, '${dateStr}')">＋ Saisir une intervention</button>
        <button type="button" class="btn btn-outline btn-xs" onclick="openPlannedModal('${dateStr}')">📌 Planifier un travail</button>
      </div>
    `;
    container.appendChild(emptyRow);
    return;
  }

  dayEvents.forEach(evt => {
    const row = document.createElement("div");
    let rowTypeClass = "item-done";
    let icon = "🚜";
    if (evt.type === "planned") {
      rowTypeClass = "item-planned";
      icon = "📌";
    } else if (evt.type === "harvest") {
      rowTypeClass = "item-harvest";
      icon = "🍇";
    }
    row.className = `cal-agenda-item-row ${rowTypeClass}`;

    row.innerHTML = `
      <div class="cal-agenda-item-left">
        <span class="cal-agenda-type-icon">${icon}</span>
        <div class="cal-agenda-item-info">
          <div class="cal-agenda-item-task">${escapeHTML(evt.title)}</div>
          <div class="cal-agenda-item-details">
            <span>🏰 <strong>${escapeHTML(evt.client)}</strong></span>
            ${evt.parcel ? `<span>• 🌿 ${escapeHTML(evt.parcel)}</span>` : ""}
            ${evt.worker ? `<span>• 👤 ${escapeHTML(evt.worker)}</span>` : ""}
            ${evt.time ? `<span>• 🕒 ${evt.time}</span>` : ""}
          </div>
        </div>
      </div>
      <div class="cal-agenda-item-right">
        ${evt.amount > 0 ? `<span class="cal-agenda-amount">${formatCurrency(evt.amount)} HT</span>` : ""}
        ${evt.quantity ? `<span class="badge-tag">${formatVolumeUnit(evt.quantity, evt.rateType)}</span>` : ""}
        ${evt.type === "intervention" 
          ? `<button type="button" class="status-badge ${evt.status === 'Facturée' ? 'status-facturee' : 'status-a-facturer'}" onclick="toggleInterventionStatus('${evt.id}'); renderCalendarView();">
               <span>${evt.status === 'Facturée' ? '✅' : '⏳'} ${escapeHTML(evt.status)}</span>
             </button>`
          : (evt.type === "planned"
              ? `<button type="button" class="btn btn-primary btn-xs" onclick="window.convertPlannedWork('${evt.id}')">🚜 Faire</button>`
              : `<span class="badge-tag" style="background: rgba(168, 85, 247, 0.2); color: #e9d5ff;">🍇 ${escapeHTML(evt.status)}</span>`
            )
        }
      </div>
    `;
    container.appendChild(row);
  });
}

function renderCalendarView() {
  populateCalendarFilterSelects();

  const titleEl = document.getElementById("cal-period-title");
  const filteredEvents = getFilteredCalendarEvents();

  const bounds = getCalendarPeriodBounds(calendarViewMode, calendarCurrentDate);
  if (titleEl) titleEl.textContent = bounds.title;

  calculateAndRenderCalendarKPIs(filteredEvents, bounds.start, bounds.end);

  if (calendarViewMode === "month") {
    renderCalendarMonthGrid(filteredEvents);
    renderCalendarSelectedDayAgenda(calendarSelectedDate, filteredEvents);
  } else if (calendarViewMode === "week") {
    renderCalendarWeekGrid(filteredEvents, bounds.start);
  } else if (calendarViewMode === "day") {
    renderCalendarDayView(calendarSelectedDate, filteredEvents);
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const todayCount = countCalendarEventsForDate(todayStr);
  const badgeEl = document.getElementById("sidebar-calendar-count");
  if (badgeEl) {
    badgeEl.textContent = todayCount;
    badgeEl.style.display = todayCount > 0 ? "inline-block" : "none";
  }
}

// Window Exports for Calendar
window.initCalendarControls = initCalendarControls;
window.renderCalendarView = renderCalendarView;
window.setCalendarViewMode = setCalendarViewMode;
window.navigateCalendar = navigateCalendar;
window.countCalendarEventsForDate = countCalendarEventsForDate;
window.getAllCalendarEvents = getAllCalendarEvents;
window.getFilteredCalendarEvents = getFilteredCalendarEvents;
