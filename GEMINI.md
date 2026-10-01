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
  - **Équipe & Utilisateurs du Domaine** : Nombre total d'utilisateurs actifs, répartition gérant(s) vs salariés/tractoristes, et accès direct à la gestion d'équipe.
  - Total d'heures machines / ouvriers.
- **Filtres de Recherche Avancés** :
  - Recherche plein texte (client, parcelle, salarié, tâche).
  - Filtre par statut (*Tous*, *À facturer*, *Facturée*).
  - **Filtre multi-sélection Domaine / Client à encoches (cases à cocher)** : menu déroulant avec recherche en direct, boutons « Tout cocher » / « Tout décocher », sélection multiple simultanée et bouton d'ajout direct de nouveau client.
  - **Filtre multi-sélection Prestation viticole à encoches (cases à cocher)** : regroupé par catégories viticoles avec tarifs indicatifs, recherche intégrée et sélection multiple simultanée.
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
  - **Modes de facturation multiples** : Taux horaire (`€/h`), Forfait à l'hectare (`€/ha`), Forfait fixe global (`€`), et Facturation au kilo (`€/kg` pour vendanges et récoltes au poids).
  - **Filtres sous forme de menus déroulants** : deux sélecteurs compacts pour filtrer instantanément par *Catégorie viticole* et par *Mode de facturation* (€/h, €/ha, forfait, au kilo).
  - **Organisation en menus déroulants accordéons par catégorie** : affichage soigné regroupé par catégorie avec compteurs de prestations et chevrons repliables.
  - Unités de facturation : à l'hectare (`ha`), à l'heure (`h`), au forfait (`forfait`), au kilo (`kg`).
  - Tarifs indicatifs HT avec calcul automatique lors de la saisie d'une intervention.
  - Création, modification et suppression de prestations.
- **Sous-onglet 2 : Planning des travaux à faire (travaux prévisionnels)** :
  - **Planification multi-domaines & multi-parcelles en menus déroulants (Modal 6)** : Deux menus déroulants compacts et élégants (`.modal-dropdown-wrap`) côte à côte :
    - *Menu déroulant « Domaines / Clients »* : sélecteur avec recherche instantanée, boutons « Tout cocher / Tout décocher », pastilles de statut, et sélection simultanée de multiples domaines avec affichage dynamique des domaines choisis sur le bouton déclencheur.
    - *Menu déroulant « Parcelles associées »* : activé dès la sélection d'au moins un client, liste déroulante groupée par domaine avec cases à cocher, recherche de parcelles, boutons « Tout / Aucun », et calcul en direct du nombre de parcelles et de la surface cumulée totale (**précision à 4 décimales**).
    - *Bandeau récapitulatif en temps réel* : affiche instantanément le nombre de clients, le nombre de parcelles et la superficie globale sélectionnée.
  - Génération automatique des chantiers prévus par client avec report de la surface de leurs parcelles.
  - **Action de conversion en 1 clic & Sécurité d'annulation** : transforme un travail planifié en intervention réelle avec pré-remplissage complet (client, parcelles cochées, prestation, volume, dates).
    - **Annulation sécurisée** : Si l'utilisateur clique sur « Annuler » ou ferme la modale, le travail planifié **reste strictement intact dans la liste des travaux à réaliser**.
    - **Validation & Enregistrement** : Dès que l'utilisateur clique sur « Enregistrer l'intervention », l'intervention est immédiatement inscrite au Tableau de Bord (Journal des interventions), le travail planifié correspondant est supprimé de la liste et de Supabase, et l'application bascule automatiquement sur le Tableau de Bord pour visualiser l'intervention créée.

#### E. Gestion de l'Équipe & des Utilisateurs (Modales 9 & 10)
- **Compteur & Carte KPI dédiée sur le Tableau de bord** : Affiche en temps réel le nombre total d'utilisateurs, la décomposition (gérant vs salariés/tractoristes) et les membres actifs.
- **Raccourcis d'accès** : Accès direct depuis la carte KPI, le menu latéral (section *Pilotage* et bouton *＋ Nouvel Utilisateur* dans *Outils & Base*) et le bouton dédié dans la topbar.
- **Dossier Équipe (Modal 9)** :
  - Synthèse en 4 indicateurs : Utilisateurs au total, Gérant(s), Salariés & Tractoristes, Membres actifs sur le terrain.
  - Recherche instantanée et filtrage par rôle (Gérants, Tractoristes, Ouvriers viticoles, Saisonniers).
  - Cartes profil complètes : avatar avec initiales colorées, rôle avec pastille de couleur, statut (Actif, En mission, En congé), coordonnées (email et téléphone cliquables), habilitations (Certiphyto, CACES) et notes internes.
- **Formulaire Utilisateur (Modal 10)** : Ajout et édition rapide d'un membre avec assignation du rôle viticole et compétences terrain.
- **Alimentation dynamique du planning des travaux** : Les travaux prévisionnels proposent automatiquement la liste des membres réels de l'équipe dans le champ « Salarié pressenti ».

#### F. Pilotage des Vendanges & Récoltes (Vue 4, Modales 11 & 12)
- **Accès depuis la section Pilotage** : Entrée dédiée dans la barre latérale sous *Pilotage* avec badge dynamique affichant le nombre de parcelles au suivi des vendanges, et raccourci dans *Outils & Base* (*＋ Nouvelle Vendange*).
- **Tableau de Bord & 5 KPIs Clés avec Prestations Liées** :
  1. *Parcelles au suivi* : Total de parcelles et superficie cumulée (**précision à 4 décimales obligatoire**).
  2. *Effeuillage* : Pourcentage d'avancement et décompte (effeuillée(s) vs à faire), avec badge dynamique affichant la prestation liée (*« Prestation liée : Effeuillage manuel »*).
  3. *Coupe / Récolte* : Pourcentage récolté et décompte (coupée(s) vs à couper).
  4. *Volume Récolté* : Total des kilos (kg) récoltés et nombre de caisses pesées, avec badge dynamique affichant la prestation liée (*« Prestation liée : Coupe vendange (0,35 €/kg) »*).
  5. *Débardage* : Pourcentage acheminé hors des rangs et décompte (débardée(s) vs à sortir).
- **Lien Prestation Coupe Vendange & Rendement au Kilo** :
  - La pesée récoltée (kilos) est directement adossée à la prestation « Coupe vendange (au kilo) » du catalogue de services.
  - Le calcul du montant HT (`kg × €/kg = Total HT`) et TTC est calculé en direct à la pesée et synchronisé avec le Journal des interventions.
  - Affichage direct dans le tableau de bord vendanges de la formule de calcul, du prix au kg et de la prestation liée.
- **Lien Prestation Effeuillage & Suivi dans le Pilotage** :
  - **Affichage du tarif à toutes les étapes nécessaires** : Que l'étape soit sur « 🍃 À effeuiller » ou « ✅ Effeuillée », le bloc de prestation s'affiche avec la prestation catalogue liée, le champ de prix unitaire HT (ex: 550 €/ha configuré dans le catalogue des Prestations) et le rappel textuel clair du tarif préenregistré. Le bloc est masqué uniquement si l'option « 🚫 Non nécessaire » est choisie.
  - **Ajout automatique au Tableau de Bord lors du passage à « Effeuillée »** :
    - Dès qu'une parcelle est enregistrée comme « Effeuillée » dans la modale (Modal 11) ou basculée via le menu déroulant/toggle du tableau, l'intervention d'effeuillage est **automatiquement créée dans le Journal des interventions du Tableau de bord au statut « À facturer »** avec le tarif configuré dans Prestations (550 €/ha).
    - Une case à cocher « *Ajouter automatiquement l'effeuillage au Tableau de Bord (À facturer)* » permet de contrôler cet envoi dans la modale.
    - Dans le tableau des vendanges, la colonne Effeuillage affiche le statut visuel avec badge de la prestation, le tarif (ex: 550.00 €/ha), ainsi qu'un badge cliquable vers l'intervention créée (`⏳ À facturer` / `✅ Facturée`).

- **Lien Prestation Coupe Vendange & Rendement au Kilo** :
  - **Affichage du tarif dès « À couper » et « Coupée »** : Dès la programmation de la vendange (« ⏳ À couper »), la prestation vendange liée (ex: *Coupe vendange au kilo* à 0,35 €/kg) et son tarif unitaire s'affichent clairement avec rappel du tarif préenregistré.
  - Dès le passage à « 🍇 Coupée », la section de pesée (kilos récoltés, nombre de caisses) et la valorisation financière en direct s'activent.
  - Case à cocher « *Ajouter automatiquement la coupe au Tableau de Bord pour la Facturation* » créant immédiatement l'intervention dans le Journal des interventions au statut « À facturer ».

- **Lien Prestation Débardage & Tarif préenregistré dans le Pilotage** :
  - Prestation dédiée préenregistrée dans le catalogue *Prestations Travaux* : **« Débardage vendange (tracteur / porteur) »** à **0,15 €/kg** (facturée au kilo récolté ou prestations associées).
  - **Affichage du tarif à toutes les étapes nécessaires** : Que l'étape soit sur « 🚜 À débarder » ou « ✅ Débardée », le bloc de prestation s'affiche avec le sélecteur dynamique, le prix unitaire modifiable et l'indication claire du tarif catalogue (0,15 €/kg). Le bloc se replie uniquement si l'option « ⚪ Non nécessaire » est cochée.
  - **Ajout automatique au Tableau de Bord lors du passage à « Débardée »** :
    - Dès qu'une parcelle est marquée « Débardée » (dans Modal 11 ou via les menus déroulants/toggles du tableau), le chantier de débardage est **automatiquement transféré dans le Journal des interventions du Tableau de bord au statut « À facturer »** avec le tarif configuré (0,15 €/kg).
    - Case à cocher « *Ajouter automatiquement le débardage au Tableau de Bord (À facturer)* » intégrée dans la modale.
  - Dans le tableau des vendanges (Colonne *Débardage*) : affichage du badge de statut, rappel du tarif (0.15 €/kg) et badge interactif reliant directement au chantier dans le Tableau de Bord.

- **Filtre Multi-Sélection des Domaines Viticoles** :
  - Menu déroulant multi-sélection à encoches (cases à cocher) identique au tableau de bord principal.
  - Champ de recherche textuelle en direct, boutons rapides « Tout cocher » et « Tout décocher ».
  - Badge dynamique du nombre de domaines sélectionnés.
  - Permet de filtrer et afficher les parcelles vendangées de plusieurs domaines viticoles simultanément.

- **Filtre Multi-Sélection des Parcelles Cadastrales (Menu Déroulant à Encoches)** :
  - Disposé stratégiquement entre le filtre *Domaine Viticole* et le filtre *Étape Vendange*.
  - Menu déroulant avec cases à cocher (`#wrap-vendanges-filter-parcel`) permettant de sélectionner simultanément une ou plusieurs parcelles spécifiques.
  - Adaptation dynamique en direct selon le ou les domaines sélectionnés (regroupement élégant par domaine viticole avec boutons « Tout » / « Aucun » par domaine si plusieurs clients sont actifs).
  - Champ de recherche instantanée par nom de parcelle, domaine et cépage.
  - Commandes rapides « Tout cocher » et « Tout décocher » avec affichage dynamique du nombre de parcelles sélectionnées sur le bouton déclencheur.

- **Création & Planification Multi-Domaines & Multi-Parcelles (Modal 11)** :
  - Identique à l'ergonomie de Modal 6 (Travaux prévisionnels), le formulaire de nouvelle vendange propose deux menus déroulants élégants à encoches :
    - *Menu déroulant « Domaine(s) / Client(s) »* : recherche instantanée, boutons « Tout cocher / Tout décocher », et sélection multi-domaines simultanée avec affichage dynamique sur le déclencheur.
    - *Menu déroulant « Parcelle(s) à vendanger »* : activé dès qu'au moins un client est coché, liste regroupée par domaine viticole avec bouton « Tout cocher » par domaine, superficie précise à 4 décimales, cépage et badges clairs.
    - *Bandeau récapitulatif en direct* : affiche instantanément le nombre de domaines, le nombre de parcelles et la superficie globale cumulée (en ha à 4 décimales).
    - *Création par lot* : la validation du formulaire crée automatiquement un chantier de suivi de vendange pour chaque parcelle cochée avec automatisation de facturation associée (effeuillage, pesée coupe, débardage).

- **Feuille de Route des Vendanges & Robustesse du Filtrage** :
  - Filtrage sécurisé par domaine, parcelle et étape (`leaf_todo`, `leaf_done`, `cut_todo`, `cut_done`, `haul_todo`, `haul_done`) garantissant la visibilité permanente des parcelles suivies sans masquage intempestif.
  - Bouton de réinitialisation rapide des filtres en 1 clic intégré directement dans l'état vide si des parcelles existent au suivi.

- **Cloisonnement Strict des Prestations par Étape dans Modal 11** :
  - **Étape 1 (Effeuillage)** : Liste déroulante et tarif réservés **exclusivement aux prestations d'effeuillage** (ex: *Effeuillage manuel face levante* à 550 €/ha), excluant toute autre prestation de relevage, rognage ou palissage.
  - **Étape 2 (Coupe / Récolte)** : Liste déroulante et tarif réservés **exclusivement à la coupe vendange / récolte** (ex: *Coupe vendange (au kilo)* à 0,35 €/kg), excluant strictement le débardage.
  - **Étape 3 (Débardage)** : Liste déroulante et tarif réservés **exclusivement au débardage** (ex: *Débardage vendange (tracteur / porteur)* à 0,15 €/kg), excluant strictement la coupe ou la récolte.

- **Épuration Visuelle & Facturation Automatique Directe du Tableau des Vendanges** :
  - **Colonnes épurées sans encombrement sous les boutons** : Les colonnes *Effeuillage*, *Coupe / Récolte* et *Débardage* affichent exclusivement leur bouton menu déroulant respectif (`🍃 À effeuiller / 🚫 Non nécessaire / ✅ Effeuillée`, `⏳ À couper / 🍇 Coupée`, `🚜 À débarder / ⚪ Non nécessaire / ✅ Débardée`). Tous les encadrés, mentions superflues de prestation ou de tarif sous les sélecteurs ont été retirés.
  - **Envoi automatique direct à « À facturer » (zéro action manuelle requise)** :
    - Dès le passage à **« ✅ Effeuillée »**, l'intervention d'effeuillage est créée immédiatement dans le Journal du Tableau de bord au statut « À facturer » avec le tarif catalogue (550 €/ha).
    - Dès la validation de **« 🍇 Coupée »** (dans le tableau ou lors de la saisie de pesée), l'intervention de coupe est créée immédiatement au statut « À facturer » avec le prix au kilo configuré.
    - Dès le passage à **« ✅ Débardée »**, l'intervention de débardage est créée immédiatement au statut « À facturer » avec le tarif préenregistré (0,15 €/kg).

- **Export CSV enrichi** : Le fichier CSV exporté intègre les colonnes *Prix au Kilo (€ HT/kg)*, *Montant Total HT (€)*, *Statut Facturation*, *Prestation Débardage* et *Tarif Débardage (€ HT)*.

#### G. Vue 5 : Historique & Suivi par Client (Onglet Client dans Pilotage)
- **Accès dédié depuis la section Pilotage** : Onglet `📋 Historique Client` (`#nav-btn-client-history`) situé dans la sidebar sous *PILOTAGE*, permettant un accès direct au suivi complet par client.
- **Sélecteur Biparti Multi-Domaines & Parcelles en Menus Déroulants** :
  - *Étape 1 : Choix Multi-Domaines / Clients à encoches (cases à cocher)* : Menu déroulant élégant avec recherche instantanée, boutons « Tout cocher » / « Tout décocher », pastilles de statut, et sélection simultanée de multiples domaines avec affichage dynamique sur le bouton déclencheur.
  - *Étape 2 : Menu Déroulant Multi-Sélection des Parcelles associées* :
    - Menu déroulant avec cases à cocher (`#wrap-ch-filter-parcel`) affichant la superficie cadastrale exacte (4 décimales), le cépage, un champ de recherche instantanée, et les commandes rapides « Tout cocher » / « Tout décocher ».
    - Si plusieurs domaines sélectionnés : regroupement automatique par domaine viticole dans la liste déroulante avec en-têtes dédiés et commandes « Tout » / « Aucun » spécifiques à chaque domaine.
  - *Bandeau récapitulatif en direct* : Compteur de parcelles cochées, superficie cadastrale cumulée en hectares (précision à 4 décimales), et nombre de chantiers correspondants.
- **Synthèse & 4 KPIs Financiers & Travaux en Direct** :
  1. *Interventions réalisées* : Nombre total de chantiers trouvés, superficie totale travaillée (ha à 4 décimales) et total d'heures machines.
  2. *Montant total HT* : Chiffre d'affaires HT cumulé et conversion TTC estimée.
  3. *À Facturer (En attente)* : Montant restant en attente de facturation avec décompte des chantiers (badge ambre).
  4. *Déjà Facturé* : Montant encaissé/clôturé avec décompte des chantiers (badge vert émeraude).
- **Journal Complet des Travaux du/des Client(s)** :
  - Tableau pleine largeur (`.interventions-table`) filtrable par statut (*Tous*, *À facturer*, *Facturée*), par période (*Tout l'historique*, *Année en cours*, *Ce mois-ci*, *30 derniers jours*) et par recherche textuelle.
  - Badge de domaine viticole affiché dans la colonne parcellaire lors de consultations multi-domaines pour une lisibilité parfaite.
  - Bascule directe de statut de facturation en 1 clic.
  - Export CSV dédié de l'historique filtré (monoclient ou multi-domaines) avec téléchargement instantané compatible Excel.
  - Bouton rapide d'ajout d'intervention pré-assigné.

#### H. Expérience Mobile / Smartphone
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
- **Boutons Export CSV & Équipe** :
  - **Mode Nuit** : Texte et icônes obligatoirement en **blanc pur (`#ffffff`)** pour une lisibilité optimale sur fond sombre (#0c1210).
  - **Mode Jour** : Style sombre d'origine conservé à l'identique (`#13241b` / vert fusain) pour éviter tout texte blanc illisible sur fond clair.

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

### Règle 9 : Connexion Autonome des Salariés & Saisie Directe dans les Parcelles
- **Attribution des identifiants par le Gérant (Modal 10)** : L'administrateur/gérant peut attribuer à chaque salarié ou tractoriste un e-mail de connexion et un mot de passe ou code PIN à 6 chiffres (avec bouton générateur rapide ⚡). Un bouton « 📲 Accès terrain » permet de copier en un clic un message de bienvenue prêt pour SMS / WhatsApp avec lien direct.
- **Connexion autonome sur mobile (`login.html`)** : Les tractoristes et ouvriers viticoles se connectent directement avec leur e-mail et leur code PIN / mot de passe sur leur smartphone.
- **Routage automatique vers le domaine du Gérant (`ownerUserId`)** : Le compte est authentifié en tant que `isTeamMember: true` avec liaison `ownerUserId` et `ownerDomain`. Toutes les requêtes et écritures (`getAuthUserId()`) pointent directement vers la partition de données du gérant. Le collaborateur accède immédiatement aux domaines clients, parcelles cadastrales et catalogue de prestations de son gérant, sans partition séparée.
- **Traçabilité terrain & Bandeau Opérateur** : Dans le formulaire de saisie d'intervention (`#create-modal`), un bandeau distinctif affiche l'opérateur connecté et le domaine rattaché. Chaque intervention enregistrée dans la parcelle est automatiquement attribuée au nom du salarié (`worker: "Thomas Mercier"`).

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
