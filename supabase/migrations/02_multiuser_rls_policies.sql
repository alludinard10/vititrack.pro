-- ==============================================================================
-- VITITRACK PRESTATION — ÉTAPE B : MIGRATION 02 (VERSION SÉCURISÉE CIBLÉE)
-- POLITIQUES ROW LEVEL SECURITY (RLS) MULTI-UTILISATEURS & RESTRICTIONS SALARIÉS
-- ==============================================================================
-- IMPORTANT : Ce script est PRÉPARÉ LOCALEMENT.
-- Il ne doit être exécuté sur Supabase qu'après validation explicite de l'utilisateur.
-- RLS reste activée à 100% sur toutes les tables.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. FONCTIONS D'AUTORISATION ET DE RÉSOLUTION D'ENTREPRISE (SECURITY DEFINER)
-- ------------------------------------------------------------------------------

-- Résout l'identifiant propriétaire unique de l'entreprise pour l'utilisateur connecté
CREATE OR REPLACE FUNCTION public.get_current_owner_user_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    -- 1. Rattachement relationnel prioritaire par member_user_id dans team_memberships
    (SELECT owner_user_id FROM public.team_memberships 
     WHERE member_user_id = auth.uid() 
       AND status = 'accepted'
     LIMIT 1),
    -- 2. Rattachement relationnel de secours par invited_email
    (SELECT owner_user_id FROM public.team_memberships 
     WHERE lower(invited_email) = lower(auth.jwt() ->> 'email')
       AND status = 'accepted'
     LIMIT 1),
    -- 3. Métadonnées d'application serveur fiables
    NULLIF((auth.jwt() -> 'app_metadata' ->> 'owner_user_id'), ''),
    -- 4. Par défaut : l'utilisateur lui-même (Gérant titulaire du compte)
    auth.uid()::text
  );
$$;

REVOKE ALL ON FUNCTION public.get_current_owner_user_id() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_current_owner_user_id() TO authenticated;

-- Détermine si l'utilisateur est un collaborateur / salarié (non propriétaire de l'espace)
CREATE OR REPLACE FUNCTION public.is_current_user_worker()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_memberships 
    WHERE (member_user_id = auth.uid() OR lower(invited_email) = lower(auth.jwt() ->> 'email'))
      AND status = 'accepted'
      AND owner_user_id <> auth.uid()::text
  );
$$;

REVOKE ALL ON FUNCTION public.is_current_user_worker() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_current_user_worker() TO authenticated;

-- Détermine si le collaborateur a l'autorisation de consulter le tableau de bord financier
CREATE OR REPLACE FUNCTION public.can_current_user_view_dashboard()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT can_view_dashboard FROM public.team_memberships 
     WHERE (member_user_id = auth.uid() OR lower(invited_email) = lower(auth.jwt() ->> 'email'))
       AND status = 'accepted'
     LIMIT 1),
    NOT public.is_current_user_worker() -- Le gérant exploitant a toujours accès
  );
$$;

REVOKE ALL ON FUNCTION public.can_current_user_view_dashboard() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_current_user_view_dashboard() TO authenticated;


-- ------------------------------------------------------------------------------
-- 2. POLITIQUES RLS SUR PUBLIC.CLIENTS
-- ------------------------------------------------------------------------------
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Lecture partagée Domaine
DROP POLICY IF EXISTS "clients_select_policy" ON public.clients;
CREATE POLICY "clients_select_policy" ON public.clients
  FOR SELECT TO authenticated
  USING (user_id = public.get_current_owner_user_id());

-- Ajout client : Gérant ou Salarié avec accès dashboard
DROP POLICY IF EXISTS "clients_insert_policy" ON public.clients;
DROP POLICY IF EXISTS "clients_owner_all" ON public.clients;
CREATE POLICY "clients_insert_policy" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = public.get_current_owner_user_id()
    AND (NOT public.is_current_user_worker() OR public.can_current_user_view_dashboard())
  );

-- Modification client : Gérant ou Salarié avec accès dashboard
DROP POLICY IF EXISTS "clients_update_policy" ON public.clients;
CREATE POLICY "clients_update_policy" ON public.clients
  FOR UPDATE TO authenticated
  USING (user_id = public.get_current_owner_user_id())
  WITH CHECK (
    user_id = public.get_current_owner_user_id()
    AND (NOT public.is_current_user_worker() OR public.can_current_user_view_dashboard())
  );

-- Suppression STRICTEMENT RÉSERVÉE au gérant propriétaire
DROP POLICY IF EXISTS "clients_delete_policy" ON public.clients;
CREATE POLICY "clients_delete_policy" ON public.clients
  FOR DELETE TO authenticated
  USING (
    user_id = public.get_current_owner_user_id() 
    AND NOT public.is_current_user_worker()
  );


-- ------------------------------------------------------------------------------
-- 3. POLITIQUES RLS SUR PUBLIC.PARCELLES
-- ------------------------------------------------------------------------------
ALTER TABLE public.parcelles ENABLE ROW LEVEL SECURITY;

-- Lecture partagée Domaine
DROP POLICY IF EXISTS "parcelles_select_policy" ON public.parcelles;
CREATE POLICY "parcelles_select_policy" ON public.parcelles
  FOR SELECT TO authenticated
  USING (user_id = public.get_current_owner_user_id());

-- Ajout parcelle : Gérant ou Salarié avec accès dashboard
DROP POLICY IF EXISTS "parcelles_insert_policy" ON public.parcelles;
DROP POLICY IF EXISTS "parcelles_owner_all" ON public.parcelles;
CREATE POLICY "parcelles_insert_policy" ON public.parcelles
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = public.get_current_owner_user_id()
    AND (NOT public.is_current_user_worker() OR public.can_current_user_view_dashboard())
  );

-- Modification parcelle : Gérant ou Salarié avec accès dashboard
DROP POLICY IF EXISTS "parcelles_update_policy" ON public.parcelles;
CREATE POLICY "parcelles_update_policy" ON public.parcelles
  FOR UPDATE TO authenticated
  USING (user_id = public.get_current_owner_user_id())
  WITH CHECK (user_id = public.get_current_owner_user_id());

-- Suppression STRICTEMENT RÉSERVÉE au gérant propriétaire
DROP POLICY IF EXISTS "parcelles_delete_policy" ON public.parcelles;
CREATE POLICY "parcelles_delete_policy" ON public.parcelles
  FOR DELETE TO authenticated
  USING (
    user_id = public.get_current_owner_user_id() 
    AND NOT public.is_current_user_worker()
  );


-- ------------------------------------------------------------------------------
-- 4. POLITIQUES RLS SUR PUBLIC.INTERVENTIONS
-- ------------------------------------------------------------------------------
ALTER TABLE public.interventions ENABLE ROW LEVEL SECURITY;

-- Lecture partagée pour toute l'entreprise
DROP POLICY IF EXISTS "interventions_select_policy" ON public.interventions;
CREATE POLICY "interventions_select_policy" ON public.interventions
  FOR SELECT TO authenticated
  USING (user_id = public.get_current_owner_user_id());

-- Saisie d'intervention autorisée pour le gérant et tous les salariés du domaine
DROP POLICY IF EXISTS "interventions_insert_policy" ON public.interventions;
DROP POLICY IF EXISTS "interventions_owner_all" ON public.interventions;
CREATE POLICY "interventions_insert_policy" ON public.interventions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_current_owner_user_id());

-- Modification des chantiers autorisée au sein du domaine
DROP POLICY IF EXISTS "interventions_update_policy" ON public.interventions;
CREATE POLICY "interventions_update_policy" ON public.interventions
  FOR UPDATE TO authenticated
  USING (user_id = public.get_current_owner_user_id())
  WITH CHECK (user_id = public.get_current_owner_user_id());

-- Suppression STRICTEMENT RÉSERVÉE au gérant propriétaire (interdite aux salariés)
DROP POLICY IF EXISTS "interventions_delete_policy" ON public.interventions;
CREATE POLICY "interventions_delete_policy" ON public.interventions
  FOR DELETE TO authenticated
  USING (
    user_id = public.get_current_owner_user_id() 
    AND NOT public.is_current_user_worker()
  );


-- ------------------------------------------------------------------------------
-- 5. POLITIQUES RLS SUR PUBLIC.SERVICES (CATALOGUE DES PRESTATIONS & TARIFS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Consultation du catalogue par tous les membres du domaine
DROP POLICY IF EXISTS "services_select_policy" ON public.services;
CREATE POLICY "services_select_policy" ON public.services
  FOR SELECT TO authenticated
  USING (user_id = public.get_current_owner_user_id());

-- Modification des prix et prestations STRICTEMENT RÉSERVÉE au gérant (interdite aux salariés)
DROP POLICY IF EXISTS "services_insert_policy" ON public.services;
DROP POLICY IF EXISTS "services_owner_all" ON public.services;
CREATE POLICY "services_insert_policy" ON public.services
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = public.get_current_owner_user_id() 
    AND NOT public.is_current_user_worker()
  );

DROP POLICY IF EXISTS "services_update_policy" ON public.services;
CREATE POLICY "services_update_policy" ON public.services
  FOR UPDATE TO authenticated
  USING (
    user_id = public.get_current_owner_user_id() 
    AND NOT public.is_current_user_worker()
  )
  WITH CHECK (
    user_id = public.get_current_owner_user_id() 
    AND NOT public.is_current_user_worker()
  );

DROP POLICY IF EXISTS "services_delete_policy" ON public.services;
CREATE POLICY "services_delete_policy" ON public.services
  FOR DELETE TO authenticated
  USING (
    user_id = public.get_current_owner_user_id() 
    AND NOT public.is_current_user_worker()
  );


-- ------------------------------------------------------------------------------
-- 6. POLITIQUES RLS SUR PUBLIC.PLANNED_WORKS (TRAVAUX À FAIRE)
-- ------------------------------------------------------------------------------
ALTER TABLE public.planned_works ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planned_works_select_policy" ON public.planned_works;
CREATE POLICY "planned_works_select_policy" ON public.planned_works
  FOR SELECT TO authenticated
  USING (user_id = public.get_current_owner_user_id());

DROP POLICY IF EXISTS "planned_works_insert_policy" ON public.planned_works;
DROP POLICY IF EXISTS "planned_works_owner_all" ON public.planned_works;
CREATE POLICY "planned_works_insert_policy" ON public.planned_works
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_current_owner_user_id());

DROP POLICY IF EXISTS "planned_works_update_policy" ON public.planned_works;
CREATE POLICY "planned_works_update_policy" ON public.planned_works
  FOR UPDATE TO authenticated
  USING (user_id = public.get_current_owner_user_id())
  WITH CHECK (user_id = public.get_current_owner_user_id());

DROP POLICY IF EXISTS "planned_works_delete_policy" ON public.planned_works;
CREATE POLICY "planned_works_delete_policy" ON public.planned_works
  FOR DELETE TO authenticated
  USING (user_id = public.get_current_owner_user_id());


-- ------------------------------------------------------------------------------
-- 7. POLITIQUES RLS SUR PUBLIC.SUBSCRIPTIONS (ABONNEMENT ET FACTURATION SAAS)
-- ------------------------------------------------------------------------------
-- SÉCURITÉ CRITIQUE STRIPE :
-- La table subscriptions est en LECTURE SEULE pour les utilisateurs authentifiés.
-- Aucune politique INSERT, UPDATE ou DELETE n'est accordée à authenticated :
-- Seul le serveur Supabase (Edge Functions / Webhooks Stripe avec clé service_role)
-- peut modifier les abonnements, les statuts et les clés Stripe.
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_select_policy" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_modify_policy" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_owner_all" ON public.subscriptions;
DROP POLICY IF EXISTS "Les utilisateurs peuvent consulter leur propre abonnement" ON public.subscriptions;
DROP POLICY IF EXISTS "Seul le service_role peut modifier les abonnements" ON public.subscriptions;

CREATE POLICY "subscriptions_select_policy" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (
    user_id = public.get_current_owner_user_id()::uuid 
    AND (NOT public.is_current_user_worker() OR public.can_current_user_view_dashboard())
  );


-- ------------------------------------------------------------------------------
-- 8. POLITIQUES RLS SUR PUBLIC.TEAM_MEMBERSHIPS (GESTION DES RATTACHEMENTS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.team_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_memberships_select_policy" ON public.team_memberships;
DROP POLICY IF EXISTS "team_memberships_owner_all" ON public.team_memberships;
CREATE POLICY "team_memberships_select_policy" ON public.team_memberships
  FOR SELECT TO authenticated
  USING (
    owner_user_id = auth.uid()::text 
    OR member_user_id = auth.uid() 
    OR lower(invited_email) = lower(auth.jwt() ->> 'email')
  );

-- Seul le gérant propriétaire peut ajouter des membres
DROP POLICY IF EXISTS "team_memberships_insert_policy" ON public.team_memberships;
CREATE POLICY "team_memberships_insert_policy" ON public.team_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()::text 
    AND invited_by = auth.uid()::text
    AND NOT public.is_current_user_worker()
  );

-- Seul le gérant propriétaire peut modifier les rôles ou les permissions
DROP POLICY IF EXISTS "team_memberships_update_policy" ON public.team_memberships;
CREATE POLICY "team_memberships_update_policy" ON public.team_memberships
  FOR UPDATE TO authenticated
  USING (
    owner_user_id = auth.uid()::text 
    AND NOT public.is_current_user_worker()
  )
  WITH CHECK (
    owner_user_id = auth.uid()::text 
    AND NOT public.is_current_user_worker()
  );

-- Le gérant peut retirer un collaborateur ; un membre peut quitter l'équipe
DROP POLICY IF EXISTS "team_memberships_delete_policy" ON public.team_memberships;
CREATE POLICY "team_memberships_delete_policy" ON public.team_memberships
  FOR DELETE TO authenticated
  USING (
    owner_user_id = auth.uid()::text 
    OR member_user_id = auth.uid()
  );

COMMIT;
