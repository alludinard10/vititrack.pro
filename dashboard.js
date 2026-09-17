/**
 * VitiTrack Pro — Dashboard Application Logic
 * Base de données neutre : Gestion des Clients, Parcelles et Interventions viticoles.
 */

// ==================== MULTI-TENANT STORAGE KEYS ====================
const STORAGE_CLIENTS_BASE = "vititrack_clients_user_v3";
const STORAGE_INTERVENTIONS_BASE = "vititrack_interventions_user_v3";
const STORAGE_SERVICES_BASE = "vititrack_services_user_v3";
const STORAGE_PLANNED_BASE = "vititrack_planned_works_user_v3";

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
    rateType: "hourly",
    price: 37,
    description: "Découverte raisonnée des grappes côté soleil levant pour optimiser l'état sanitaire."
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
let currentFilter = {
  search: "",
  client: "all",
  task: "all",
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
  checkAuthUser().catch(err => {
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

      // Save fresh data to user's isolated local cache
      saveClientsLocally();
      saveInterventionsLocally();
      saveServicesLocally();
      savePlannedWorksLocally();

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
    if (errCli) return;

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
      await window.supabaseClient.from("parcelles").upsert(parcelsData);
    }
  } catch (err) {
    console.warn("Notice sync client Supabase :", err);
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
  const navClients = document.getElementById("nav-btn-clients");
  const navServices = document.getElementById("nav-btn-services");
  const navInterventions = document.getElementById("nav-btn-interventions");
  const navBilling = document.getElementById("nav-btn-billing");

  if (navOverview) navOverview.addEventListener("click", (e) => { e.preventDefault(); switchView("overview"); closeSidebar(); });
  if (navClients) navClients.addEventListener("click", (e) => { e.preventDefault(); switchView("clients"); closeSidebar(); });
  if (navServices) navServices.addEventListener("click", (e) => { e.preventDefault(); switchView("services"); closeSidebar(); });
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

  const categoryChips = document.querySelectorAll("#category-filter-chips .chip");
  categoryChips.forEach(chip => {
    chip.addEventListener("click", () => {
      categoryChips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      servicesCategoryFilter = chip.getAttribute("data-category") || "all";
      renderServices();
    });
  });

  const rateChips = document.querySelectorAll("#rate-filter-chips .chip");
  rateChips.forEach(chip => {
    chip.addEventListener("click", () => {
      rateChips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      servicesRateTypeFilter = chip.getAttribute("data-rate") || "all";
      renderServices();
    });
  });

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

  // Client Selection in Planned Work Modal
  const plannedClientSelect = document.getElementById("input-planned-client");
  const plannedParcelSelect = document.getElementById("input-planned-parcel");
  if (plannedClientSelect) {
    plannedClientSelect.addEventListener("change", (e) => {
      const clientId = e.target.value;
      if (plannedParcelSelect) {
        if (!clientId) {
          plannedParcelSelect.innerHTML = '<option value="">Sélectionnez d\'abord un client...</option>';
          plannedParcelSelect.disabled = true;
          return;
        }
        const client = clients.find(c => c.id === clientId);
        if (client && client.parcels && client.parcels.length > 0) {
          plannedParcelSelect.innerHTML = '<option value="">Sélectionner une parcelle...</option>';
          client.parcels.forEach(p => {
            const opt = document.createElement("option");
            opt.value = p.name;
            opt.textContent = `${p.name} (${formatSurface(p.surface)} ha${p.grape ? ' - ' + p.grape : ''})`;
            plannedParcelSelect.appendChild(opt);
          });
          plannedParcelSelect.disabled = false;
        } else {
          plannedParcelSelect.innerHTML = '<option value="Toutes parcelles">Toutes parcelles / Général</option>';
          plannedParcelSelect.disabled = false;
        }
      }
    });
  }

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
      if (mode === "hourly") {
        labelQuantity.innerHTML = '<span>Durée travaillée</span> <span class="required">*</span>';
        if (badgeUnit) badgeUnit.textContent = "heures";
        inputQuantity.step = "0.25";
        inputQuantity.value = "4.0";
        labelUnitPrice.innerHTML = '<span>Taux horaire HT (€/h)</span>';
        if (!inputUnitPrice.value || inputUnitPrice.value === "110" || inputUnitPrice.value === "95" || inputUnitPrice.value === "250") {
          inputUnitPrice.value = "38";
        }
      } else if (mode === "surface") {
        labelQuantity.innerHTML = '<span>Surface travaillée</span> <span class="required">*</span>';
        if (badgeUnit) badgeUnit.textContent = "ha";
        inputQuantity.step = "0.0001";
        
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
        if (!inputUnitPrice.value || inputUnitPrice.value === "38" || inputUnitPrice.value === "250") {
          inputUnitPrice.value = "95";
        }
      } else {
        labelQuantity.innerHTML = '<span>Quantité forfaitaire</span> <span class="required">*</span>';
        if (badgeUnit) badgeUnit.textContent = "forfait";
        inputQuantity.step = "1";
        inputQuantity.value = "1";
        labelUnitPrice.innerHTML = '<span>Montant forfaitaire HT (€)</span>';
        if (!inputUnitPrice.value || inputUnitPrice.value === "38" || inputUnitPrice.value === "110" || inputUnitPrice.value === "95") {
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

  const clientFilter = document.getElementById("filter-client");
  if (clientFilter) {
    clientFilter.addEventListener("change", (e) => {
      if (e.target.value === "__create_client__") {
        clientFilter.value = "all";
        currentFilter.client = "all";
        openClientModal();
        return;
      }
      currentFilter.client = e.target.value;
      renderTable();
    });
  }

  const taskFilter = document.getElementById("filter-task");
  if (taskFilter) {
    taskFilter.addEventListener("change", (e) => {
      currentFilter.task = e.target.value;
      renderTable();
    });
  }

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
      currentFilter.task = "all";
      currentFilter.status = "all";
      currentFilter.dateFrom = "";
      currentFilter.dateTo = "";
      currentFilter.datePreset = "all";

      const searchInput = document.getElementById("filter-search");
      if (searchInput) searchInput.value = "";

      const clientSelect = document.getElementById("filter-client");
      if (clientSelect) clientSelect.value = "all";

      const taskSelect = document.getElementById("filter-task");
      if (taskSelect) taskSelect.value = "all";

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
  }
}

// ==================== VIEW SWITCHING ====================
function switchView(viewName) {
  const viewOverview = document.getElementById("view-overview");
  const viewClients = document.getElementById("view-clients");
  const viewServices = document.getElementById("view-services");

  const navOverview = document.getElementById("nav-btn-overview");
  const navClients = document.getElementById("nav-btn-clients");
  const navServices = document.getElementById("nav-btn-services");
  const navInterventions = document.getElementById("nav-btn-interventions");
  const navBilling = document.getElementById("nav-btn-billing");

  // Deactivate all navigation links
  [navOverview, navClients, navServices, navInterventions, navBilling].forEach(b => {
    if (b) b.classList.remove("active");
  });

  const mNavOverview = document.getElementById("mobile-nav-overview");
  const mNavClients = document.getElementById("mobile-nav-clients");
  const mNavServices = document.getElementById("mobile-nav-services");
  [mNavOverview, mNavClients, mNavServices].forEach(b => {
    if (b) b.classList.remove("active");
  });

  if (viewName === "clients") {
    if (viewOverview) {
      viewOverview.style.display = "none";
      viewOverview.classList.remove("active");
    }
    if (viewServices) {
      viewServices.style.display = "none";
      viewServices.classList.remove("active");
    }
    if (viewClients) {
      viewClients.style.display = "flex";
      viewClients.classList.add("active");
    }
    if (navClients) navClients.classList.add("active");
    if (mNavClients) mNavClients.classList.add("active");
    renderClientsView();
  } else if (viewName === "services") {
    if (viewOverview) {
      viewOverview.style.display = "none";
      viewOverview.classList.remove("active");
    }
    if (viewClients) {
      viewClients.style.display = "none";
      viewClients.classList.remove("active");
    }
    if (viewServices) {
      viewServices.style.display = "flex";
      viewServices.classList.add("active");
    }
    if (navServices) navServices.classList.add("active");
    if (mNavServices) mNavServices.classList.add("active");
    renderServicesView();
  } else if (viewName === "interventions") {
    if (viewClients) {
      viewClients.style.display = "none";
      viewClients.classList.remove("active");
    }
    if (viewServices) {
      viewServices.style.display = "none";
      viewServices.classList.remove("active");
    }
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
    if (viewClients) {
      viewClients.style.display = "none";
      viewClients.classList.remove("active");
    }
    if (viewServices) {
      viewServices.style.display = "none";
      viewServices.classList.remove("active");
    }
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
    if (viewClients) {
      viewClients.style.display = "none";
      viewClients.classList.remove("active");
    }
    if (viewServices) {
      viewServices.style.display = "none";
      viewServices.classList.remove("active");
    }
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
    document.body.style.overflow = "hidden";
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
    document.body.style.overflow = "";
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
  const clientId = `CLI-${Date.now().toString().slice(-4)}`;

  // Optional initial parcel
  const initialParcelName = document.getElementById("input-initial-parcel-name")?.value.trim();
  const initialParcelSurface = parseFloat(document.getElementById("input-initial-parcel-surface")?.value || 0);
  const initialParcelGrape = document.getElementById("input-initial-parcel-grape")?.value.trim() || "Non spécifié";

  const parcels = [];
  if (initialParcelName) {
    parcels.push({
      id: `PAR-${Date.now().toString().slice(-4)}`,
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
    document.body.style.overflow = "hidden";
  }
};

function closeParcelModal() {
  const modal = document.getElementById("parcel-modal");
  if (modal) {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
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
    id: `PAR-${Date.now().toString().slice(-4)}`,
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
function populateParcelSelectForClient(clientId) {
  const parcelContainer = document.getElementById("parcel-checkbox-list");
  const hiddenParcelInput = document.getElementById("input-parcel");
  const parcelHint = document.getElementById("parcel-hint");
  const quickAddParcelBtn = document.getElementById("btn-quick-add-parcel");
  const toggleAllParcelsBtn = document.getElementById("btn-toggle-all-parcels");
  const summaryBar = document.getElementById("parcel-summary-bar");

  if (!parcelContainer) return;

  if (!clientId) {
    parcelContainer.innerHTML = '<div class="parcel-list-empty">Sélectionnez d\'abord un client pour charger ses parcelles.</div>';
    if (hiddenParcelInput) hiddenParcelInput.value = "";
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
    if (hiddenParcelInput) hiddenParcelInput.value = "";
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

  // Preselect the first parcel by default so user has immediate visual confirmation & calculated total
  const firstCb = parcelContainer.querySelector(".parcel-checkbox-input");
  if (firstCb) {
    firstCb.checked = true;
    firstCb.closest(".parcel-checkbox-item")?.classList.add("selected");
    updateParcelSelectionSummary(client);
  }
}

function updateParcelSelectionSummary(client) {
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
    if (mode === "surface" && inputQuantity) {
      inputQuantity.value = parseFloat(totalSurface.toFixed(4));
      updateCalculatedPrice();
    }
  } else {
    if (summaryBar) summaryBar.style.display = "none";
    if (rateTypeSelect?.value === "surface" && inputQuantity) {
      inputQuantity.value = "0.0000";
      updateCalculatedPrice();
    }
  }
}

// ==================== INTERVENTION CREATION ====================
function openCreateModal() {
  const modal = document.getElementById("create-modal");
  const datetimeInput = document.getElementById("input-datetime");

  if (datetimeInput && !datetimeInput.value) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    datetimeInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  populateClientSelect();
  updateCalculatedPrice();

  if (modal) {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
}

function closeCreateModal() {
  const modal = document.getElementById("create-modal");
  if (modal) {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
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
}

function updateCalculatedPrice() {
  const quantity = parseFloat(document.getElementById("input-quantity")?.value || 0);
  const unitPrice = parseFloat(document.getElementById("input-unit-price")?.value || 0);
  const task = document.getElementById("input-task")?.value || "";
  const display = document.getElementById("calculated-total-display");

  const total = quantity * unitPrice;
  const rate = getTvaRate(task);
  const ratePct = Math.round(rate * 100);
  const totalTTC = total * (1 + rate);
  if (display) {
    display.textContent = `${total.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € HT (${totalTTC.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € TTC — TVA ${ratePct}%)`;
  }
}

function handleCreateInterventionSubmit(e) {
  e.preventDefault();

  const authUser = getAuthUser();
  const defaultWorker = authUser ? (authUser.fullName || authUser.name || "Exploitant") : "Exploitant";
  const worker = document.getElementById("input-worker")?.value?.trim() || defaultWorker;
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
  const unit = rateType === "hourly" ? "heures" : (rateType === "surface" ? "ha" : "forfait");
  const total = quantity * unitPrice;
  const tvaRate = getTvaRate(task);
  const totalTTC = total * (1 + tvaRate);
  const id = `VT-${new Date().getFullYear()}-${String(interventions.length + 1).padStart(3, '0')}`;

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
  saveInterventions();

  // Synchronisation Cloud Supabase si session active
  syncInterventionToSupabase(newIntervention);

  closeCreateModal();
  renderTable();
  renderKPIs();
  updateClientCardsStats();

  showToast(`✅ Intervention #${id} enregistrée avec succès (${clientName}) !`, "success");
}

// ==================== RENDERING ALL ====================
function renderAll() {
  populateClientSelect();
  populateTaskSelects();
  renderKPIs();
  renderTable();
  renderClientsView();
  renderServicesView();
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

  // Sidebar badges
  setElemText("sidebar-clients-count", totalClients);
  setElemText("sidebar-interventions-count", totalInterventions);
  setElemText("sidebar-unbilled-count", unbilledCount);
  setElemText("sidebar-services-count", services.length);

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
    if (currentFilter.client !== "all" && item.client !== currentFilter.client) return false;
    if (currentFilter.task !== "all" && !item.task.includes(currentFilter.task)) return false;
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
  const wrapClient = document.getElementById("wrap-filter-client");
  if (wrapClient) {
    wrapClient.classList.toggle("is-active", currentFilter.client !== "all");
  }
  const wrapTask = document.getElementById("wrap-filter-task");
  if (wrapTask) {
    wrapTask.classList.toggle("is-active", currentFilter.task !== "all");
  }
  const wrapDate = document.getElementById("wrap-filter-date");
  if (wrapDate) {
    wrapDate.classList.toggle("is-active", currentFilter.datePreset !== "all" || Boolean(currentFilter.dateFrom) || Boolean(currentFilter.dateTo));
  }
  const resetBtn = document.getElementById("btn-reset-table-filters");
  if (resetBtn) {
    const hasFilter = currentFilter.client !== "all" || 
                      currentFilter.task !== "all" || 
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
    const workerInitials = (item.worker || "VT").split(" ").filter(Boolean).map(w => w[0]).join("") || "VT";
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
          <div class="worker-badge">
            <span class="worker-avatar-mini">${workerInitials}</span>
            <span>${escapeHTML(item.worker)}</span>
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
          <span class="volume-value">${item.unit === 'ha' ? formatSurface(item.quantity) : item.quantity} ${item.unit}</span>
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

  if (!retainTab) {
    switchDossierTab("parcels");
  }

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
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
            <td>👤 ${escapeHTML(item.worker || '—')}</td>
            <td>${item.unit === 'ha' ? formatSurface(item.quantity) : item.quantity} ${item.unit}</td>
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

window.closeClientDossier = function() {
  const modal = document.getElementById("client-dossier-modal");
  if (modal) {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
};

window.deleteParcelFromDossier = function(clientId, parcelId) {
  deleteParcel(clientId, parcelId);
  openClientDossier(clientId, true);
};

window.toggleInterventionStatusFromDossier = function(interventionId, clientId) {
  toggleInterventionStatus(interventionId);
  openClientDossier(clientId, true);
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

window.deleteIntervention = function(id) {
  const index = interventions.findIndex(i => i.id === id);
  if (index === -1) return;

  if (confirm(`Supprimer définitivement l'intervention #${id} ?`)) {
    interventions.splice(index, 1);
    saveInterventionsLocally();
    deleteInterventionFromSupabase(id);
    renderAll();
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

  if (detailId) detailId.textContent = `Intervention #${item.id} — ${item.client}`;

  const formattedDate = formatDateDisplay(item.datetime);

  if (detailBody) {
    detailBody.innerHTML = `
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Date & Heure</span>
          <span class="detail-value">${formattedDate.date} à ${formattedDate.time}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Salarié</span>
          <span class="detail-value">${escapeHTML(item.worker)}</span>
        </div>
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
          <span class="detail-value">${item.unit === 'ha' ? formatSurface(item.quantity) : item.quantity} ${item.unit} (@ ${item.unitPrice} €)</span>
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
    document.body.style.overflow = "hidden";
  }
};

function closeDetailModal() {
  const modal = document.getElementById("detail-modal");
  if (modal) {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
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
        const rateLabel = s.rateType === "hourly" ? `${s.price} €/h` : (s.rateType === "surface" ? `${s.price} €/ha` : `${s.price} € forfait`);
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
  const plannedCount = plannedWorks.length;

  setElemText("services-total-count", total);
  setElemText("services-hourly-count", hourlyCount);
  setElemText("services-surface-count", surfaceCount);
  setElemText("services-fixed-count", fixedCount);
  setElemText("services-planned-count", plannedCount);

  setElemText("count-tab-catalog", total);
  setElemText("count-tab-planned", plannedCount);

  // Update Category Filter Badges
  setElemText("count-cat-all", total);
  setElemText("count-cat-taille", services.filter(s => s.category === "Taille & Végétal").length);
  setElemText("count-cat-palissage", services.filter(s => s.category === "Palissage & Écimage").length);
  setElemText("count-cat-sol", services.filter(s => s.category === "Sol & Mécanisation").length);
  setElemText("count-cat-soins", services.filter(s => s.category === "Traitements & Soins").length);
  setElemText("count-cat-vendanges", services.filter(s => s.category === "Vendanges & Récolte").length);
  setElemText("count-cat-plantations", services.filter(s => s.category === "Aménagement & Plantations").length);

  // Update Rate Type Filter Badges
  setElemText("count-rate-all", total);
  setElemText("count-rate-hourly", hourlyCount);
  setElemText("count-rate-surface", surfaceCount);
  setElemText("count-rate-fixed", fixedCount);
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

  grid.innerHTML = filtered.map(s => {
    let rateBadgeClass = "rate-hourly";
    let rateUnit = "€/h";
    let rateModeText = "Au temps passé";
    if (s.rateType === "surface") {
      rateBadgeClass = "rate-surface";
      rateUnit = "€/ha";
      rateModeText = "À la surface";
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
  }).join("");
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
    document.body.style.overflow = "hidden";
  }
}

function closeServiceModal() {
  const modal = document.getElementById("service-modal");
  if (modal) {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
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
      id: `srv-${Date.now().toString().slice(-4)}`,
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

// Planned Work Modal logic
function openPlannedModal() {
  const modal = document.getElementById("planned-modal");
  const form = document.getElementById("create-planned-form");
  const clientSelect = document.getElementById("input-planned-client");
  const parcelSelect = document.getElementById("input-planned-parcel");
  const dateInput = document.getElementById("input-planned-date");

  if (form) form.reset();

  if (clientSelect) {
    clientSelect.innerHTML = '<option value="">Sélectionner un client...</option>';
    clients.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name + (c.commune ? ` (${c.commune})` : '');
      clientSelect.appendChild(opt);
    });
  }

  if (parcelSelect) {
    parcelSelect.innerHTML = '<option value="">Sélectionnez d\'abord un client...</option>';
    parcelSelect.disabled = true;
  }

  populateTaskSelects();

  if (dateInput) {
    const today = new Date().toISOString().split("T")[0];
    dateInput.value = today;
  }

  if (modal) {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
}

function closePlannedModal() {
  const modal = document.getElementById("planned-modal");
  if (modal) {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
}

function handleCreatePlannedSubmit(e) {
  e.preventDefault();

  const clientId = document.getElementById("input-planned-client")?.value;
  const parcel = document.getElementById("input-planned-parcel")?.value;
  const service = document.getElementById("input-planned-service")?.value;
  const date = document.getElementById("input-planned-date")?.value;
  const worker = document.getElementById("input-planned-worker")?.value || "Non assigné";
  const quantity = parseFloat(document.getElementById("input-planned-quantity")?.value || 0);
  const notes = document.getElementById("input-planned-notes")?.value || "";

  if (!clientId || !parcel || !service || !date) {
    showToast("Veuillez renseigner le client, la parcelle, la prestation et la date prévue.", "warning");
    return;
  }

  const client = clients.find(c => c.id === clientId);
  const clientName = client ? client.name : "Client Inconnu";

  const newPlanned = {
    id: `PLN-${Date.now().toString().slice(-4)}`,
    clientId,
    clientName,
    parcel,
    service,
    date,
    worker,
    quantity,
    notes
  };

  plannedWorks.unshift(newPlanned);
  savePlannedWorks();
  closePlannedModal();
  renderServicesView();
  showToast(`Travail à faire « ${service} » planifié pour ${clientName} !`, "success");
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
      const cbs = Array.from(parcelContainer.querySelectorAll(".parcel-checkbox-input"));
      let found = false;
      cbs.forEach(cb => {
        if (cb.value === planned.parcel || planned.parcel.includes(cb.value)) {
          cb.checked = true;
          cb.closest(".parcel-checkbox-item")?.classList.add("selected");
          found = true;
        } else {
          cb.checked = false;
          cb.closest(".parcel-checkbox-item")?.classList.remove("selected");
        }
      });
      const client = clients.find(c => c.id === planned.clientId);
      if (found) updateParcelSelectionSummary(client);
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

  // Remove from planned works list
  plannedWorks = plannedWorks.filter(w => w.id !== id);
  savePlannedWorks();
  renderServicesView();
  showToast(`Formulaire d'intervention prérempli pour ${planned.clientName}. Ajustez les heures si besoin et validez.`, "info");
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

