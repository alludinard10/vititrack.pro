-- ==============================================================================
-- VITITRACK PRESTATION — ÉTAPE B : MIGRATION 02
-- POLITIQUES ROW LEVEL SECURITY (RLS) MULTI-UTILISATEURS & ISOLATION ENTREPRISES
-- ==============================================================================
-- IMPORTANT : Ce script est PRÉPARÉ LOCALEMENT.
-- Il ne doit être exécuté sur Supabase qu'après validation explicite de l'utilisateur.
-- RLS reste activée à 100% sur toutes les tables (aucun contournement de sécurité).
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

-- Détermine si l'utilisateur est un collaborateur / salarié (non propriétaire)
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
    NOT public.is_current_user_worker() -- Le gérant a toujours accès
  );
$$;

REVOKE ALL ON FUNCTION public.can_current_user_view_dashboard() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_current_user_view_dashboard() TO authenticated;


-- ------------------------------------------------------------------------------
-- 2. POLITIQUES RLS SUR PUBLIC.CLIENTS
-- ------------------------------------------------------------------------------
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_select_policy" ON public.clients;
CREATE POLICY "clients_select_policy" ON public.clients
  FOR SELECT TO authenticated
  USING (user_id = public.get_current_owner_user_id());

DROP POLICY IF EXISTS "clients_insert_policy" ON public.clients;
CREATE POLICY "clients_insert_policy" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = public.get_current_owner_user_id()
    AND (NOT public.is_current_user_worker() OR public.can_current_user_view_dashboard())
  );

DROP POLICY IF EXISTS "clients_update_policy" ON public.clients;
CREATE POLICY "clients_update_policy" ON public.clients
  FOR UPDATE TO authenticated
  USING (user_id = public.get_current_owner_user_id())
  WITH CHECK (
    user_id = public.get_current_owner_user_id()
    AND (NOT public.is_current_user_worker() OR public.can_current_user_view_dashboard())
  );

DROP POLICY IF EXISTS "clients_delete_policy" ON public.clients;
CREATE POLICY "clients_delete_policy" ON public.clients
  FOR DELETE TO authenticated
  USING (
    user_id = public.get_current_owner_user_id() 
    AND NOT public.is_current_user_worker() -- Seul le gérant supprime des clients
  );


-- ------------------------------------------------------------------------------
-- 3. POLITIQUES RLS SUR PUBLIC.PARCELLES
-- ------------------------------------------------------------------------------
ALTER TABLE public.parcelles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parcelles_select_policy" ON public.parcelles;
CREATE POLICY "parcelles_select_policy" ON public.parcelles
  FOR SELECT TO authenticated
  USING (user_id = public.get_current_owner_user_id());

DROP POLICY IF EXISTS "parcelles_insert_policy" ON public.parcelles;
CREATE POLICY "parcelles_insert_policy" ON public.parcelles
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = public.get_current_owner_user_id()
    AND (NOT public.is_current_user_worker() OR public.can_current_user_view_dashboard())
  );

DROP POLICY IF EXISTS "parcelles_update_policy" ON public.parcelles;
CREATE POLICY "parcelles_update_policy" ON public.parcelles
  FOR UPDATE TO authenticated
  USING (user_id = public.get_current_owner_user_id())
  WITH CHECK (user_id = public.get_current_owner_user_id());

DROP POLICY IF EXISTS "parcelles_delete_policy" ON public.parcelles;
CREATE POLICY "parcelles_delete_policy" ON public.parcelles
  FOR DELETE TO authenticated
  USING (
    user_id = public.get_current_owner_user_id() 
    AND NOT public.is_current_user_worker() -- Seul le gérant supprime des parcelles
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
CREATE POLICY "interventions_insert_policy" ON public.interventions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_current_owner_user_id());

-- Modification des chantiers autorisée au sein du domaine
DROP POLICY IF EXISTS "interventions_update_policy" ON public.interventions;
CREATE POLICY "interventions_update_policy" ON public.interventions
  FOR UPDATE TO authenticated
  USING (user_id = public.get_current_owner_user_id())
  WITH CHECK (user_id = public.get_current_owner_user_id());

-- Suppression STRICTEMENT RÉSERVÉE au gérant propriétaire
DROP POLICY IF EXISTS "interventions_delete_policy" ON public.interventions;
CREATE POLICY "interventions_delete_policy" ON public.interventions
  FOR DELETE TO authenticated
  USING (
    user_id = public.get_current_owner_user_id() 
    AND NOT public.is_current_user_worker()
  );


-- ------------------------------------------------------------------------------
-- 5. POLITIQUES RLS SUR PUBLIC.SERVICES (CATALOGUE DES PRESTATIONS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Consultation du catalogue par tous les membres du domaine
DROP POLICY IF EXISTS "services_select_policy" ON public.services;
CREATE POLICY "services_select_policy" ON public.services
  FOR SELECT TO authenticated
  USING (user_id = public.get_current_owner_user_id());

-- Modification des prix et prestations STRICTEMENT RÉSERVÉE au gérant
DROP POLICY IF EXISTS "services_insert_policy" ON public.services;
CREATE POLICY "services_insert_policy" ON public.services
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_current_owner_user_id() AND NOT public.is_current_user_worker());

DROP POLICY IF EXISTS "services_update_policy" ON public.services;
CREATE POLICY "services_update_policy" ON public.services
  FOR UPDATE TO authenticated
  USING (user_id = public.get_current_owner_user_id() AND NOT public.is_current_user_worker())
  WITH CHECK (user_id = public.get_current_owner_user_id() AND NOT public.is_current_user_worker());

DROP POLICY IF EXISTS "services_delete_policy" ON public.services;
CREATE POLICY "services_delete_policy" ON public.services
  FOR DELETE TO authenticated
  USING (user_id = public.get_current_owner_user_id() AND NOT public.is_current_user_worker());


-- ------------------------------------------------------------------------------
-- 6. POLITIQUES RLS SUR PUBLIC.PLANNED_WORKS (TRAVAUX À FAIRE)
-- ------------------------------------------------------------------------------
ALTER TABLE public.planned_works ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planned_works_select_policy" ON public.planned_works;
CREATE POLICY "planned_works_select_policy" ON public.planned_works
  FOR SELECT TO authenticated
  USING (user_id = public.get_current_owner_user_id());

DROP POLICY IF EXISTS "planned_works_insert_policy" ON public.planned_works;
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

COMMIT;
