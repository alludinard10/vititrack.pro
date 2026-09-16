/**
 * VitiTrack Pro — Dashboard Application Logic
 * Base de données neutre : Gestion des Clients, Parcelles et Interventions viticoles.
 */

// ==================== STORAGE KEYS ====================
const STORAGE_CLIENTS_KEY = "vititrack_clients_db_v2";
const STORAGE_INTERVENTIONS_KEY = "vititrack_interventions_db_v2";

// ==================== APPLICATION STATE ====================
let clients = [];
let interventions = [];
let currentFilter = {
  search: "",
  client: "all",
  task: "all",
  status: "all"
};
let clientsSearchFilter = "";
let pendingInterventionFormState = null;

// ==================== INITIALIZATION ====================
document.addEventListener("DOMContentLoaded", () => {
  loadDatabase();
  setupEventListeners();
  renderAll();
});

// Load neutral database from localStorage
function loadDatabase() {
  const savedClients = localStorage.getItem(STORAGE_CLIENTS_KEY);
  if (savedClients) {
    try {
      clients = JSON.parse(savedClients);
    } catch (e) {
      console.error("Erreur de parsing clients, réinitialisation", e);
      clients = [];
    }
  } else {
    // Neutral state: empty array
    clients = [];
    saveClients();
  }

  const savedInterventions = localStorage.getItem(STORAGE_INTERVENTIONS_KEY);
  if (savedInterventions) {
    try {
      interventions = JSON.parse(savedInterventions);
    } catch (e) {
      console.error("Erreur de parsing interventions, réinitialisation", e);
      interventions = [];
    }
  } else {
    // Neutral state: empty array
    interventions = [];
    saveInterventions();
  }
}

function saveClients() {
  localStorage.setItem(STORAGE_CLIENTS_KEY, JSON.stringify(clients));
}

function saveInterventions() {
  localStorage.setItem(STORAGE_INTERVENTIONS_KEY, JSON.stringify(interventions));
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
  const navInterventions = document.getElementById("nav-btn-interventions");
  const navBilling = document.getElementById("nav-btn-billing");

  if (navOverview) navOverview.addEventListener("click", (e) => { e.preventDefault(); switchView("overview"); closeSidebar(); });
  if (navClients) navClients.addEventListener("click", (e) => { e.preventDefault(); switchView("clients"); closeSidebar(); });
  if (navInterventions) navInterventions.addEventListener("click", (e) => {
    e.preventDefault();
    switchView("overview");
    filterByStatus("all");
    closeSidebar();
  });
  if (navBilling) navBilling.addEventListener("click", (e) => {
    e.preventDefault();
    switchView("overview");
    filterByStatus("À facturer");
    closeSidebar();
  });

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

  // Intervention creation buttons
  const openModalBtn = document.getElementById("btn-open-create-modal");
  const openModalBottomBtn = document.getElementById("btn-open-create-bottom");
  const emptyAddIntervention = document.getElementById("btn-empty-add-intervention");

  if (openModalBtn) openModalBtn.addEventListener("click", () => openCreateModal());
  if (openModalBottomBtn) openModalBottomBtn.addEventListener("click", () => openCreateModal());
  if (emptyAddIntervention) emptyAddIntervention.addEventListener("click", () => openCreateModal());

  // Modal Closers
  setupModalCloser("create-modal", "modal-close-btn", "modal-cancel-btn", closeCreateModal);
  setupModalCloser("client-modal", "client-modal-close-btn", "client-modal-cancel-btn", closeClientModal);
  setupModalCloser("parcel-modal", "parcel-modal-close-btn", "parcel-modal-cancel-btn", closeParcelModal);
  setupModalCloser("detail-modal", "detail-close-btn", "detail-dismiss-btn", closeDetailModal);

  // Forms Submissions
  const clientForm = document.getElementById("create-client-form");
  if (clientForm) clientForm.addEventListener("submit", handleCreateClientSubmit);

  const parcelForm = document.getElementById("create-parcel-form");
  if (parcelForm) parcelForm.addEventListener("submit", handleCreateParcelSubmit);

  const interventionForm = document.getElementById("create-intervention-form");
  if (interventionForm) interventionForm.addEventListener("submit", handleCreateInterventionSubmit);

  // Client Selection in Intervention Modal -> Updates Parcelles Dropdown
  const modalClientSelect = document.getElementById("input-client");
  const modalParcelSelect = document.getElementById("input-parcel");
  const parcelHint = document.getElementById("parcel-hint");
  const quickAddParcelBtn = document.getElementById("btn-quick-add-parcel");

  if (modalClientSelect) {
    modalClientSelect.addEventListener("change", (e) => {
      const clientId = e.target.value;
      populateParcelSelectForClient(clientId);
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
      if (mode === "hourly") {
        labelQuantity.innerHTML = '<span>Durée travaillée (heures)</span> <span class="required">*</span>';
        if (iconQuantity) iconQuantity.textContent = "⏱️";
        inputQuantity.step = "0.25";
        inputQuantity.value = "4.0";
        labelUnitPrice.innerHTML = '<span>Taux horaire HT (€/h)</span>';
        inputUnitPrice.value = "38";
      } else if (mode === "surface") {
        labelQuantity.innerHTML = '<span>Surface travaillée (hectares)</span> <span class="required">*</span>';
        if (iconQuantity) iconQuantity.textContent = "🌿";
        inputQuantity.step = "0.1";
        inputQuantity.value = "2.0";
        labelUnitPrice.innerHTML = '<span>Forfait par hectare HT (€/ha)</span>';
        inputUnitPrice.value = "110";
      } else {
        labelQuantity.innerHTML = '<span>Quantité forfaitaire</span> <span class="required">*</span>';
        if (iconQuantity) iconQuantity.textContent = "📦";
        inputQuantity.step = "1";
        inputQuantity.value = "1";
        labelUnitPrice.innerHTML = '<span>Prix forfaitaire total HT (€)</span>';
        inputUnitPrice.value = "250";
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

  // Reset / Clear Database Button
  const resetBtn = document.getElementById("sidebar-reset-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (confirm("Voulez-vous réinitialiser complètement la base de données (vider tous les clients et interventions) ?")) {
        clients = [];
        interventions = [];
        saveClients();
        saveInterventions();
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
  const pageTitle = document.getElementById("page-title");
  const pageSubtitle = document.getElementById("page-subtitle");

  const navOverview = document.getElementById("nav-btn-overview");
  const navClients = document.getElementById("nav-btn-clients");

  if (viewName === "clients") {
    if (viewOverview) viewOverview.style.display = "none";
    if (viewClients) viewClients.style.display = "block";
    if (pageTitle) pageTitle.textContent = "Clients & Parcelles";
    if (pageSubtitle) pageSubtitle.textContent = "Répertoire des domaines viticoles et de leurs parcelles sous contrat";
    if (navClients) navClients.classList.add("active");
    if (navOverview) navOverview.classList.remove("active");
    renderClientsView();
  } else {
    if (viewOverview) viewOverview.style.display = "block";
    if (viewClients) viewClients.style.display = "none";
    if (pageTitle) pageTitle.textContent = "Tableau de bord";
    if (pageSubtitle) pageSubtitle.textContent = "Suivi des travaux viticoles & préparation de la facturation";
    if (navOverview) navOverview.classList.add("active");
    if (navClients) navClients.classList.remove("active");
    renderTable();
    renderKPIs();
  }
}

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
function openClientModal() {
  const modal = document.getElementById("client-modal");
  const form = document.getElementById("create-client-form");
  if (form) form.reset();

  if (modal) {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
}

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

  // Generate ID
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
    saveClients();
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

  // If intervention modal is open, refresh parcel dropdown and auto-select
  const modalClientSelect = document.getElementById("input-client");
  if (modalClientSelect && modalClientSelect.value === clientId) {
    populateParcelSelectForClient(clientId);
    const parcelSelect = document.getElementById("input-parcel");
    if (parcelSelect) {
      parcelSelect.value = `${newParcel.name} (${newParcel.surface} ha - ${newParcel.grape})`;
    }
  }

  showToast(`Parcelle « ${name} » (${surface} ha) ajoutée à ${client.name} !`, "success");
}

window.deleteParcel = function(clientId, parcelId) {
  const client = clients.find(c => c.id === clientId);
  if (!client || !client.parcels) return;

  if (confirm("Supprimer cette parcelle ?")) {
    client.parcels = client.parcels.filter(p => p.id !== parcelId);
    saveClients();
    renderAll();
    showToast("Parcelle supprimée.", "info");
  }
};

// ==================== PARCEL DROPDOWN LOGIC FOR INTERVENTION MODAL ====================
function populateParcelSelectForClient(clientId) {
  const modalParcelSelect = document.getElementById("input-parcel");
  const parcelHint = document.getElementById("parcel-hint");
  const quickAddParcelBtn = document.getElementById("btn-quick-add-parcel");

  if (!modalParcelSelect) return;

  if (!clientId) {
    modalParcelSelect.innerHTML = '<option value="">Sélectionnez d\'abord un client...</option>';
    modalParcelSelect.disabled = true;
    if (parcelHint) parcelHint.textContent = "Sélectionnez un client pour charger ses parcelles.";
    if (quickAddParcelBtn) quickAddParcelBtn.style.display = "none";
    return;
  }

  const client = clients.find(c => c.id === clientId);
  if (!client) return;

  if (quickAddParcelBtn) quickAddParcelBtn.style.display = "inline-block";

  if (!client.parcels || client.parcels.length === 0) {
    modalParcelSelect.innerHTML = '<option value="">Aucune parcelle répertoriée pour ce client</option>';
    modalParcelSelect.disabled = true;
    if (parcelHint) {
      parcelHint.innerHTML = `⚠️ Ce client n'a pas encore de parcelle. <a href="#" onclick="openParcelModal('${client.id}'); return false;" style="color:var(--color-primary-lighter); text-decoration:underline;">Ajouter une parcelle maintenant</a>`;
    }
    return;
  }

  modalParcelSelect.disabled = false;
  modalParcelSelect.innerHTML = '<option value="">Choisir la parcelle...</option>';
  client.parcels.forEach(p => {
    const opt = document.createElement("option");
    opt.value = `${p.name} (${p.surface} ha - ${p.grape})`;
    opt.textContent = `${p.name} — ${p.surface} ha (${p.grape}${p.soil ? ' • ' + p.soil : ''})`;
    modalParcelSelect.appendChild(opt);
  });

  if (parcelHint) parcelHint.textContent = `${client.parcels.length} parcelle(s) répertoriée(s) pour ${client.name}.`;
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
      modalClientSelect.innerHTML = '<option value="">⚠️ Aucun client enregistré — Cliquez sur « ＋ Nouveau client »</option>';
    } else {
      modalClientSelect.innerHTML = '<option value="">Sélectionner un domaine client...</option>';
      clients.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name + (c.commune ? ` (${c.commune})` : '');
        modalClientSelect.appendChild(opt);
      });
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
  }
}

function updateCalculatedPrice() {
  const quantity = parseFloat(document.getElementById("input-quantity")?.value || 0);
  const unitPrice = parseFloat(document.getElementById("input-unit-price")?.value || 0);
  const display = document.getElementById("calculated-total-display");

  const total = quantity * unitPrice;
  if (display) {
    display.textContent = total.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  }
}

function handleCreateInterventionSubmit(e) {
  e.preventDefault();

  const worker = document.getElementById("input-worker")?.value;
  const datetime = document.getElementById("input-datetime")?.value;
  const clientId = document.getElementById("input-client")?.value;
  const parcel = document.getElementById("input-parcel")?.value;
  const task = document.getElementById("input-task")?.value;
  const rateType = document.getElementById("input-rate-type")?.value || "hourly";
  const quantity = parseFloat(document.getElementById("input-quantity")?.value || 0);
  const unitPrice = parseFloat(document.getElementById("input-unit-price")?.value || 0);
  const notes = document.getElementById("input-notes")?.value || "";
  const status = document.getElementById("input-status")?.value || "À facturer";

  if (!clientId) {
    showToast("Veuillez sélectionner ou créer un client partenaire.", "warning");
    return;
  }

  const clientObj = clients.find(c => c.id === clientId);
  const clientName = clientObj ? clientObj.name : "Client Inconnu";

  if (!worker || !datetime || !parcel || !task || isNaN(quantity) || quantity <= 0) {
    showToast("Veuillez remplir tous les champs obligatoires (*)", "warning");
    return;
  }

  const unit = rateType === "hourly" ? "heures" : (rateType === "surface" ? "ha" : "forfait");
  const total = quantity * unitPrice;
  const id = `VT-${new Date().getFullYear()}-${String(interventions.length + 1).padStart(3, '0')}`;

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
    status,
    notes,
    isNewlyCreated: true
  };

  interventions.unshift(newIntervention);
  saveInterventions();

  closeCreateModal();
  document.getElementById("create-intervention-form").reset();

  const parcelSelect = document.getElementById("input-parcel");
  if (parcelSelect) {
    parcelSelect.innerHTML = '<option value="">Sélectionnez d\'abord un client...</option>';
    parcelSelect.disabled = true;
  }

  renderAll();
  showToast(`Intervention #${id} enregistrée pour ${clientName} !`, "success");
}

// ==================== RENDERING ALL ====================
function renderAll() {
  populateClientSelect();
  renderKPIs();
  renderTable();
  renderClientsView();
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
  let unbilledCount = 0;
  let billedAmount = 0;
  let billedCount = 0;

  interventions.forEach(item => {
    if (item.unit === "ha") workedSurface += item.quantity;
    else if (item.unit === "heures") workedHours += item.quantity;

    if (item.status === "À facturer") {
      unbilledAmount += item.total;
      unbilledCount++;
    } else {
      billedAmount += item.total;
      billedCount++;
    }
  });

  // Overview KPIs
  setElemText("kpi-clients-count", totalClients);
  setElemText("kpi-parcels-count", `${totalParcels} parcelle${totalParcels > 1 ? 's' : ''}`);
  setElemText("kpi-total-surface", `${totalHectares.toFixed(1)} ha répertoriés`);

  setElemText("kpi-total-count", totalInterventions);
  setElemText("kpi-surface-hours", `${workedSurface.toFixed(1)} ha / ${Math.round(workedHours)} h travaillées`);

  setElemText("kpi-unbilled-amount", `${unbilledAmount.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €`);
  setElemText("kpi-unbilled-badge", `${unbilledCount} chantier${unbilledCount > 1 ? 's' : ''}`);

  setElemText("kpi-billed-amount", `${billedAmount.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €`);
  setElemText("kpi-billed-badge", `${billedCount} chantier${billedCount > 1 ? 's' : ''}`);

  // Sidebar badges
  setElemText("sidebar-clients-count", totalClients);
  setElemText("sidebar-interventions-count", totalInterventions);
  setElemText("sidebar-unbilled-count", unbilledCount);

  // Clients view stats
  setElemText("clients-total-count", totalClients);
  setElemText("clients-total-parcels", totalParcels);
  setElemText("clients-total-ha", `${totalHectares.toFixed(1)} ha`);
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
    const workerInitials = item.worker.split(" ").map(w => w[0]).join("");
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
          <span class="volume-value">${item.quantity} ${item.unit}</span>
        </td>
        <td>
          <span class="amount-value">${item.total.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
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

    let parcelsHtml = "";
    if (c.parcels && c.parcels.length > 0) {
      parcelsHtml = c.parcels.map(p => `
        <div class="parcel-item">
          <div class="parcel-item-info">
            <span class="parcel-item-name">${escapeHTML(p.name)} (${p.surface} ha)</span>
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
            <h3 class="domain-name">${escapeHTML(c.name)}</h3>
            <span class="domain-commune">📍 ${escapeHTML(c.commune || 'Région non précisée')}</span>
          </div>
          <span class="badge-tag">${totalParcels} parcelle${totalParcels > 1 ? 's' : ''} • ${totalHa.toFixed(1)} ha</span>
        </div>

        <div class="client-card-meta">
          ${c.contact ? `<div class="client-meta-line"><span>👤</span> <strong>${escapeHTML(c.contact)}</strong></div>` : ''}
          ${c.phone ? `<div class="client-meta-line"><span>📞</span> ${escapeHTML(c.phone)}</div>` : ''}
          ${c.email ? `<div class="client-meta-line"><span>✉️</span> ${escapeHTML(c.email)}</div>` : ''}
          ${c.notes ? `<div class="client-meta-line" style="font-style:italic; color:var(--color-text-muted);">📝 ${escapeHTML(c.notes)}</div>` : ''}
        </div>

        <div class="client-parcels-section">
          <div class="parcels-section-title">
            <span>Parcelles associées (${totalParcels})</span>
            <button class="btn-link-action" onclick="openParcelModal('${c.id}')">＋ Ajouter une parcelle</button>
          </div>
          <div class="parcels-list">
            ${parcelsHtml}
          </div>
        </div>

        <div class="client-card-footer">
          <button class="btn btn-primary btn-xs" onclick="quickCreateForClient('${c.id}')">🚜 Créer intervention</button>
          <button class="action-btn delete-btn" onclick="deleteClient('${c.id}')" title="Supprimer le domaine">🗑️</button>
        </div>
      </div>
    `;
  });

  grid.innerHTML = html;
}

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

  saveInterventions();
  renderAll();
};

window.deleteIntervention = function(id) {
  const index = interventions.findIndex(i => i.id === id);
  if (index === -1) return;

  if (confirm(`Supprimer définitivement l'intervention #${id} ?`)) {
    interventions.splice(index, 1);
    saveInterventions();
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
          <span class="detail-value">${item.quantity} ${item.unit} (@ ${item.unitPrice} €)</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Total estimé HT</span>
          <span class="detail-value text-gradient" style="font-size: 1.2rem;">${item.total.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
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
  const headers = ["ID", "Date", "Heure", "Salarié", "Client", "Parcelle", "Prestation", "Quantité", "Unité", "Tarif Unitaire HT", "Total HT", "Statut", "Observations"];

  const rows = interventions.map(item => {
    const formatted = formatDateDisplay(item.datetime);
    return [
      `"${item.id}"`,
      `"${formatted.date}"`,
      `"${formatted.time}"`,
      `"${item.worker.replace(/"/g, '""')}"`,
      `"${item.client.replace(/"/g, '""')}"`,
      `"${item.parcel.replace(/"/g, '""')}"`,
      `"${item.task.replace(/"/g, '""')}"`,
      `"${item.quantity}"`,
      `"${item.unit}"`,
      `"${item.unitPrice}"`,
      `"${item.total.toFixed(2)}"`,
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

// ==================== HELPERS ====================
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
