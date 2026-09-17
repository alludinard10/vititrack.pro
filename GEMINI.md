# Vititrack Pro — Guide de Référence & Architecture du Projet

Ce document sert de référence permanente pour comprendre la raison d'être de **Vititrack Pro**, l'ensemble de ses fonctionnalités implémentées, son architecture logicielle, ses choix de design et les consignes strictes à suivre pour tout futur modèle d'IA ou développeur intervenant sur le code.

---

## 1. Vue d'Ensemble du Projet

### 1.1 Qu'est-ce que Vititrack Pro ?
**Vititrack Pro** est une application web moderne (SaaS) conçue sur-mesure pour les **entreprises de travaux viticoles à façon (ETV)**, les **prestataires de services viticoles** et les **domaines/exploitations viticoles**.

Elle répond aux défis spécifiques du monde viti-vinicole :
- Le suivi des chantiers réalisés chez différents clients (domaines, châteaux, coopératives).
- Le découpage parcellaire cadastral précis.
- Le suivi des interventions des ouvriers et tractoristes (taille, travail du sol, traitements, vendanges, etc.).
- Le suivi financier en temps réel (montants HT, statut "À facturer" vs "Facturée").
- La planification des travaux saisonniers à venir.
- L'utilisation directe sur le terrain via smartphone ou tablette par les équipes.

### 1.2 Principes Fondateurs
1. **Zéro dépendance lourde** : Pas de Node.js obligatoire en production, pas de build runner complexe, pas de framework lourd (React, Angular, Vue). L'application s'exécute nativement dans n'importe quel navigateur moderne.
2. **Persistance locale & autonomie** : Utilisation de `localStorage` pour une persistance immédiate sans base de données serveur obligatoire, avec import/export JSON complet pour la portabilité et les sauvegardes.
3. **Ergonomie "Terrain" & Mobile-First** : Interface haut de gamme optimisée aussi bien pour les grands écrans de bureau que pour les smartphones manipulés dans les vignes (barre de navigation mobile fixe, bouton de saisie rapide, zones tactiles de 44px minimum, zéro zoom involontaire iOS).

---

## 2. Structure Détaillée des Fichiers

```text
Vititrack pro/
├── assets/                          # Médias et visuels du projet
│   ├── logo.png                     # Logo officiel VitiTrack Pro complet
│   ├── logo-circle.png              # Écusson circulaire officiel pour en-têtes et avatars
│   ├── logo-icon.png                # Pictogramme pin & grappe transparent
│   ├── app-icon.png                 # Icône carrée arrondie pour raccourcis PWA/Mobile
│   ├── dashboard-preview.jpg        # Aperçu visuel du tableau de bord
│   ├── hero-vineyard.jpg            # Image d'ambiance vignoble haute définition
│   └── mobile-field.jpg             # Image d'illustration utilisation mobile/terrain
│
├── index.html                       # Landing page marketing / Vitrine de présentation
├── style.css                        # Styles CSS de la landing page vitrine
├── script.js                        # Logique et interactions de la landing page (FAQ, simulateur, modal)
│
├── login.html                       # Page de connexion autonome et sécurisée côté client
│
├── dashboard.html                   # Application SaaS principale (Tableau de bord, Clients, Prestations...)
├── dashboard.css                    # Design system complet, composants, thèmes sombres et responsive
├── dashboard.js                     # Logique applicative, gestion d'état, calculs, filtrage et modales
├── supabase-config.js               # Initialisation et configuration du client Supabase (Cloud & Offline)
│
├── GEMINI.md                        # Ce fichier : Guide de référence et règles pour les modèles IA
└── .gitignore                       # Fichiers et dossiers exclus du suivi de version
```

---

## 3. Technologies & Choix Techniques

| Domaine | Technologie | Justification |
| :--- | :--- | :--- |
| **Structure** | **HTML5 Sémantique** | Accessibilité, référencement propre, balises claires (`<dialog>`, `<details>`, `<summary>`, `<nav>`, `<main>`). |
| **Styles** | **Vanilla CSS3** | Contrôle total des performances, variables CSS (tokens), CSS Grid, Flexbox, glassmorphism (`backdrop-filter`), zéro dépendance Tailwind. |
| **Logique** | **Vanilla JavaScript (ES6+)** | Rapidité d'exécution, chargement instantané, maintenance directe sans transpilation. |
| **Backend & Base** | **Supabase (PostgreSQL + RLS)** | Persistance Cloud relationnelle temps réel, authentification, RLS, API temps réel. |
| **Typographie** | **Google Fonts (Outfit & Inter)** | Rendu typographique moderne, haut de gamme et lisible même sur petits écrans. |
| **Données & Hors-ligne**| **Supabase + HTML5 LocalStorage** | Synchronisation Cloud temps réel + cache hors-ligne instantané pour une utilisation fluide dans les vignes. |

---

## 4. Fonctionnalités Implémentées

### 4.1 Vitrine Marketing (`index.html`, `style.css`, `script.js`)
- **Hero Section** : Titre percutant, badges de statut, boutons d'action rapide ("Accéder à la Démo", "Découvrir les fonctionnalités").
- **Barre de Navigation avec Connexion** : Bouton d'accès direct au Dashboard et bouton "Connexion" ouvrant une modale de connexion rapide (`#quick-login-modal`).
- **Simulateur de Rentabilité Dynamique** : Calculateur interactif pour estimer le gain de temps et d'argent en fonction du nombre d'hectares et du nombre de clients.
- **Section Fonctionnalités & Avantages** : Cartes illustrées (Gestion parcellaire, Chantiers en temps réel, Suivi des salariés, Facturation simplifiée).
- **Aperçu Dashboard interactif** : Visuel avec points clés explicatifs.
- **Tarification & Abonnements** :
  - **Basic (29 € / mois)** : jusqu'à **5 clients** et **10 parcelles** (pour les petits domaines et démarrages).
  - **Professionnel (49 € / mois)** : **5 à 15 clients** et **10 à 20 parcelles** (pour les exploitations et prestataires actifs).
  - **Entreprise (99 € / mois)** : **Clients illimités** et **Parcelles illimitées** (pour les grands domaines et grandes structures).
- **FAQ** : Accordéon dynamique pour les questions fréquentes.

### 4.2 Authentification & Profil (`login.html`, `dashboard.html`, `dashboard.js`, `supabase-config.js`)
- **Page d'Authentification Bivalente (`login.html`)** :
  - **Onglet Connexion** : Authentification par e-mail et mot de passe via Supabase Auth (`signInWithPassword`), mémorisation de session, accès direct démo en 1 clic.
  - **Onglet Inscription** : Création de compte exploitant avec nom du domaine, nom complet de l'exploitant, e-mail et mot de passe (`signUp`), initialisation des métadonnées de profil et redirection automatique vers le tableau de bord.
  - Alertes visuelles dynamiques d'erreur (format invalide, mot de passe trop court, compte existant) et de succès.
- **Gestion de Session Fullstack & Déconnexion** :
  - Détection automatique de la session active Supabase (`supabase.auth.getSession()`), persistance locale pour la fluidité hors-ligne.
  - Affichage dynamique du nom du domaine viticole et de l'exploitant dans la topbar et la sidebar.
  - Bouton « 🔄 Compte » dans la topbar pour basculer de profil et bouton « 🚪 Déconnexion » invalidant la session Supabase (`supabase.auth.signOut()`).

### 4.3 Tableau de Bord SaaS (`dashboard.html`, `dashboard.js`)

#### A. Vue 1 : Tableau de Bord & Interventions (Overview)
- **Compteurs Métriques Clés (KPIs)** :
  - Chiffre d'affaires total HT (calculé en direct).
  - Superficie totale travaillée en hectares (**précision à 4 décimales**).
  - Nombre total d'interventions réalisées.
  - Montant restant "À facturer" (badge d'alerte jaune/ambre).
  - Total d'heures machines / ouvriers.
- **Filtres de Recherche Avancés** :
  - Recherche plein texte (client, parcelle, salarié, tâche).
  - Filtre par statut (*Tous*, *À facturer*, *Facturée*).
  - Filtre par domaine client.
  - Filtre par type de prestation.
  - Filtre par plage de dates interactif (*Toutes les dates*, *Aujourd'hui*, *Cette semaine*, *Ce mois-ci*, *30 derniers jours*, *Année en cours*, ou sélecteurs personnalisés *Du ... Au ...*).
- **Création d'Intervention Ergonomique & Intelligente** :
  - **Formulaire épuré** : saisie directe de la date & heure, du client et des parcelles travaillées sans saisie superflue d'opérateur/salarié.
  - **Multi-sélection de parcelles** : Possibilité de cocher une ou plusieurs parcelles travaillées pour le client avec bouton « Tout cocher / Tout décocher ».
  - **Sommation et report automatique de la surface** : La somme exacte des surfaces parcellaires (à 4 décimales) est immédiatement calculée et pré-remplit le champ « Surface travaillée ».
  - **Calcul en direct du total HT** : Dès le choix de la prestation (ex: *Traitement anti-mildiou*, travail du sol...) ou de la surface, le montant total HT estimé est calculé et affiché en temps réel exclusivement en hors taxe (`Surface (ha) × Prix (€/ha)`), sans mention de TVA.
  - Possibilité pour l'utilisateur d'ajuster manuellement la surface travaillée si le chantier n'a couvert qu'une fraction de la parcelle.
- **Tableau Principal des Interventions (Journal des interventions)** :
  - Colonnes épurées : Date/Heure, Client, Parcelle, Prestation, Volume/Surface, Montant HT, Montant TTC, Statut, Actions (la colonne Salarié/Exploitant a été retirée pour simplifier la consultation).
  - Bascule de statut d'un clic (*Facturée* ✅ vs *À facturer* ⏳).
  - Actions rapides : Consulter la fiche complète du client, Éditer l'intervention, Dupliquer le chantier, Supprimer.
  - Export CSV / Excel des interventions filtrées.

#### B. Vue 2 : Répertoire Clients & Parcelles
- **Grille de cartes en 4 colonnes sur desktop** avec adaptation responsive fluide (3, 2, puis 1 colonne sur smartphone).
- **Cartes de Domaine Viticole** :
  - Nom du domaine, localisation/commune, bouton d'édition rapide.
  - **Badge de superficie globale en hectares avec 4 décimales obligatoires** (ex. `12.4500 ha`).
  - **Badge dynamique du nombre d'interventions** (ex. `🚜 8 interventions`).
  - Coordonnées : Contact, Téléphone cliquable (`tel:`), Email cliquable (`mailto:`), Notes techniques.
  - **Menu déroulant accordéon des parcelles associées** (`<details class="client-parcels-accordion">`) :
    - Liste des parcelles avec superficie (4 décimales), cépage, terroir, et bouton de suppression directe.
    - Bouton rapide "＋ Ajouter" ouvrant la modale parcellaire pré-sélectionnée pour ce client.
  - **Pied de carte aligné au même niveau (`.client-card-footer-btns`)** :
    - Bouton `📋 Voir toutes les données` (ouvre le dossier complet du client).
    - Bouton `🚜 Intervention` (ouvre la saisie d'intervention pré-remplie pour ce client).
    - Les deux boutons partagent rigoureusement la **même ligne, la même hauteur (32px) et la même grille 50/50**.
    - Bouton icône de suppression `🗑️` disposé proprement à droite.

#### C. Dossier Complet Client ("Voir toutes les données" - Modal 7)
- **En-tête enrichi** : Nom du domaine, badge de commune, contact référent.
- **Synthèse des Métriques du Client** : Superficie totale, Parcelles répertoriées, Nombre d'interventions, Total à facturer, Total déjà facturé.
- **Barre de Filtrage Temporel interactive ("À partir de quand")** :
  - Sélecteur de date interactif : `<input type="date" id="dossier-filter-date-from">`.
  - Bouton de réinitialisation rapide : `✕ Tout voir`.
  - Raccourcis de période en 1 clic : *Tout l'historique*, *Année en cours*, *Ce mois-ci*, *30 derniers jours*.
  - **Mise à jour dynamique instantanée** : recalcule automatiquement les indicateurs financiers du client et filtre la liste des chantiers en temps réel.
- **3 Sous-onglets de navigation** :
  1. *🌿 Parcelles du domaine* : liste détaillée cadastrale et bouton d'ajout de parcelle.
  2. *🚜 Toutes les interventions* : tableau filtré par la date choisie avec bascule de statut sans perte d'onglet.
  3. *👤 Coordonnées & Notes* : fiche contact complète.

#### D. Vue 3 : Prestations & Travaux à faire
- **Sous-onglet 1 : Catalogue des prestations viticoles** :
  - **Filtres sous forme de menus déroulants** : deux sélecteurs compacts pour filtrer instantanément par *Catégorie viticole* et par *Mode de facturation* (€/h, €/ha, forfait).
  - **Organisation en menus déroulants accordéons par catégorie** : affichage soigné regroupé par catégorie avec compteurs de prestations et chevrons repliables.
  - Unités de facturation : à l'hectare (`ha`), à l'heure (`h`), au forfait (`forfait`).
  - Tarifs indicatifs HT avec calcul automatique lors de la saisie d'une intervention.
  - Création, modification et suppression de prestations.
- **Sous-onglet 2 : Planning des travaux à faire (travaux prévisionnels)** :
  - Liste des chantiers prévus par client, parcelle, salarié et date butoir.
  - Statuts : *À planifier*, *En cours*, *Terminé*.
  - **Action de conversion en 1 clic** : transforme un travail planifié en intervention réelle réalisée.

#### E. Expérience Mobile / Smartphone
- **Barre de Navigation Inférieure Fixe (`.mobile-bottom-nav`)** :
  - Toujours accessible au pouce sur smartphone.
  - Icônes claires : *Tableau*, *Clients*, *Prestations*, *Menu*.
  - **Bouton d'Action Central `＋ Saisie`** : bouton circulaire vert émeraude surélevé pour saisir une intervention immédiatement dans les vignes.
- **Topbar compactée** sur mobile avec suppression des éléments superflus pour maximiser l'espace de lecture.
- **Prise en compte des contraintes iOS/Android** : taille de police minimale de 16px sur les champs pour éviter le zoom automatique de Safari Mobile.

---

## 5. Règles Métier Viticoles & Conventions de Design

Toute modification future doit respecter scrupuleusement ces règles :

### Règle 1 : Précision Cadastrale à 4 Décimales Obligatoire
Dans la gestion du vignoble, les surfaces cadastrales s'expriment en hectares, ares et centiares (ex: 1 ha 24 a 50 ca = `1.2450 ha`).
- **TOUJOURS** formater les surfaces avec la fonction utilitaire :
  ```javascript
  formatSurface(surfaceVal) // Renvoie "X.XXXX" avec exactement 4 décimales
  ```
- Ne jamais afficher de surface tronquée à 1 ou 2 décimales pour les parcelles et totaux ha.

### Règle 2 : Alignement des Boutons de Carte Client
Dans la vue *Clients et Parcelles*, les deux boutons principaux du footer :
- `📋 Voir toutes les données`
- `🚜 Intervention`
doivent **TOUJOURS** être sur le **même niveau horizontal** (même ligne, même hauteur) via le conteneur `.client-card-footer-btns` configuré en CSS Grid (`grid-template-columns: 1fr 1fr; gap: 0.45rem;`).

### Règle 3 : Filtrage par Date dans le Dossier Client
Lorsque l'utilisateur consulte la fiche complète d'un client via "Voir toutes les données", la barre de sélection de date "À partir de quand" doit filtrer les interventions (`item.datetime >= dateFrom`) et mettre à jour les KPIs financiers de la période correspondante sans altérer l'intégrité de la base de données globale.

### Règle 4 : Bivalence Graphique — Mode Nuit & Mode Jour (Viti-Light)
L'application propose deux thèmes haut de gamme avec bascule instantanée sans rechargement :
- **Mode Nuit (Par défaut - "Executive Viti-Dark")** :
  - Strictement conservé à 100% pour préserver l'identité d'origine.
  - Arrière-plans sombres profonds : `#0d1511`, `#111d17`, `#16241e`.
  - Verts émeraude viticoles : `#2d6a4f`, `#52b788`, `#74c69d`.
  - Accents financiers : Or/ambre pour "À facturer", vert menthe pour "Facturée", rouge corail `#ff6b6b`.
- **Mode Jour ("Viti-Light")** :
  - Conçu pour une lisibilité maximale en plein soleil sur smartphone dans les vignes.
  - Fond global clair et lumineux : `#f3f7f4`, cartes en blanc pur `#ffffff`.
  - Typographie à fort contraste vert forêt et fusain : `#14241d`, `#2d4a3e`.
  - Bordures nettes et badges viticoles pastel haut de gamme.
  - Switch accessible via la topbar (desktop/mobile), le menu latéral (tiroir) et la barre de navigation du site vitrine.

### Règle 5 : Isolation Multi-Utilisateurs & Tableau de Bord Initial Vierge (Nu)
- **Isolation stricte par compte (`user_id`)** : Chaque utilisateur (ou domaine exploitant) possède sa propre partition de base de données. Aucune donnée d'un compte ne doit fuiter ou être visible par un autre compte (`eq("user_id", getAuthUserId())` dans Supabase et clés localStorage partitionnées `_user_<id>`).
- **Nouveau compte = Tableau de bord vierge à 100% (Nu)** :
  Lorsqu'un nouvel utilisateur crée son compte, son tableau de bord démarre rigoureusement à zéro :
  - `clients = []` (0 client)
  - `parcelles = []` (0 parcelle)
  - `interventions = []` (0 chantier)
  - `services = []` (0 prestation dans le catalogue, avec option d'import rapide des 15 prestations types au besoin)
  - `plannedWorks = []` (0 travail planifié)
- **Seul le compte de démonstration** conserve les données de démonstration (Château Grand Chêne).

### Règle 6 : Alignement & Recentrage Mobile "de A à Z"
Sur les écrans de smartphone (< 650px et < 768px) :
- Tous les contrôles de filtrage (`.select-client-wrap`, `.select-task-wrap`, `.select-date-wrap`, `.search-input-wrap`) occupent rigoureusement **100% de la largeur** pour éviter tout décalage d'axe.
- La saisie de plage de dates (`.date-range-inputs`) s'organise en grille 50/50 équilibrée.
- Les grilles de métriques (dans le dossier client notamment) restent parfaitement symétriques (la 5ème carte s'étend sur 2 colonnes `grid-column: span 2`).
- Les boutons d'action des cartes clients partagent exactement la même ligne et hauteur.
- **Header / Topbar Mobile (< 768px)** : Tous les contrôles du bandeau supérieur adoptent une disposition compacte 100% icônes (`🌙/☀️` mode jour/nuit sans texte, `🌐` retour site, `📥` export CSV, `🍇` nouveau client, `👤` profil avec `🔄` changer de compte et `🚪` déconnexion en icônes seules, `＋` nouvelle intervention) afin de garantir qu'aucun élément ne soit tronqué ou débordant sur les écrans d'iPhone (375px à 430px).
- **Modales & Défilement iOS Safari** : Toutes les modales utilisent une hauteur dynamique `92dvh`, une chaîne flexbox complète (`.modal-dialog > .modal-content > form > .modal-body`), un scrolling natif WebKit fluide (`-webkit-overflow-scrolling: touch`) et un espacement de sécurité (`env(safe-area-inset-bottom)`) pour garantir un défilement complet sans blocage jusqu'au bouton de validation.

### Règle 7 : Fiscalité Viticole — TVA à 5% (Charrues) vs 20% (Autres Travaux)
- Pour tout ce qui relève de la **charrue mécanique** ou **charrue hydraulique** (labour, travail du cavaillon), le taux de TVA légal applicable est de **5%**.
- Pour **tous les autres travaux viticoles** (taille, palissage, rognage, effeuillage, traitements, vendanges...), le taux de TVA standard est de **20%**.
- L'application calcule et affiche dynamiquement les montants HT et TTC avec le taux adéquat via la fonction globale `getTvaRate()`.

### Règle 8 : Architecture Stripe & Abonnements Mensuels (Zéro Clé Secrète Frontend)
- **Sécurité absolue** : Aucune clé secrète Stripe (`sk_live_...`, `sk_test_...`) ni clé secrète de webhook (`whsec_...`) ne doit JAMAIS figurer dans le code frontend ou le dépôt Git.
- **Backend Serveur (Supabase Edge Functions)** :
  - `create-checkout-session` : génère la session Stripe Checkout sécurisée en mode abonnement (`mode: 'subscription'`).
  - `stripe-webhook` : écoute les webhooks Stripe (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`), valide la signature cryptographique et synchronise la table `subscriptions`.
  - `customer-portal` : génère la session du portail client Stripe pour la gestion de carte bancaire, téléchargement des factures avec TVA et résiliation en 1 clic.
- **Base de données relationnelle Supabase** :
  - Table `subscriptions` partitionnée par utilisateur avec RLS stricte (`auth.uid() = user_id`).
  - Table `payment_invoices` pour l'historique des quittances et factures acquittées.
- **Formules d'abonnements** :
  - **Basic (29 € HT / mois)** : jusqu'à 5 clients et 10 parcelles.
  - **Professionnel (49 € HT / mois)** : 5 à 15 clients et 10 à 20 parcelles.
  - **Entreprise (99 € HT / mois)** : Clients et parcelles illimités.
- **Module Frontend (`stripe-config.js`)** :
  - Expose `window.VitiTrackStripe` (`startCheckout`, `openPortal`, `getSubscription`, `handleReturn`).
  - Modal 8 intégrée dans `dashboard.html` (`#subscription-modal`) avec récapitulatif du forfait actif et accès portail.

---

## 6. Instructions pour les Futurs Modèles IA & Développeurs

Lorsqu'une demande de modification ou d'ajout est formulée sur ce projet :

1. **Vérifier ce fichier `GEMINI.md` en priorité** pour respecter les conventions existantes et l'architecture en place.
2. **Ne pas introduire de frameworks de build obligatoires** (comme Vite, Webpack, React ou Tailwind) sauf si l'utilisateur l'exige formellement. Le projet doit rester immédiatement exécutable via simple double-clic ou serveur statique.
3. **Conserver le code JavaScript modulaire et lisible** :
   - Fonctions pures et utilitaires à la fin de `dashboard.js`.
   - Fonctions globales exposées sur `window.` lorsqu'elles sont appelées par des attributs `onclick` HTML inline (ex: `window.openClientDossier`, `window.switchDossierTab`, etc.).
   - Utilisation systématique de `escapeHTML(str)` pour prévenir les failles XSS lors de l'injection de templates HTML.
4. **Maintenir la compatibilité bivalente Desktop / Mobile** :
   - Toute nouvelle modale ou tout nouveau composant doit s'adapter gracieusement aux écrans mobiles (< 768px).
   - Toujours conserver l'accès au menu mobile inférieur et au bouton central `＋ Saisie`.
5. **Préserver les clés de persistance `localStorage`** :
   - `vititrack_clients` : tableau des domaines et de leurs parcelles.
   - `vititrack_interventions` : tableau des chantiers saisis.
   - `vititrack_services` : catalogue des prestations.
   - `vititrack_planned_works` : travaux programmés.
   - `vititrack_auth_user` : profil utilisateur connecté.
   - `vititrack_theme` : thème actif de l'interface (`'dark'` ou `'light'`).

---
*Ce document est la référence maîtresse du projet Vititrack Pro. Tout changement architectural majeur doit y être consigné.*
