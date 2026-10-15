-- ==============================================================================
-- VITITRACK PRO — SCRIPT D'ACCÈS MULTI-UTILISATEURS & DONNÉES DU DOMAINE (PRESTATION)
-- ==============================================================================
-- Ce script garantit que tous les salariés et tractoristes accèdent immédiatement
-- à l'intégralité des clients, parcelles et interventions créées pour leur domaine,
-- quel que soit le canal de rattachement (JWT metadata, team_memberships ou email).

-- 1. Table team_memberships si non existante
CREATE TABLE IF NOT EXISTS public.team_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id text NOT NULL,
  member_user_id uuid,
  role text DEFAULT 'worker',
  can_view_dashboard boolean DEFAULT false,
  status text NOT NULL DEFAULT 'accepted',
  invited_by text NOT NULL,
  invited_email text,
  invitation_token text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  accepted_at timestamptz DEFAULT now()
);

-- Index pour des recherches instantanées
CREATE INDEX IF NOT EXISTS idx_team_memberships_member_uid ON public.team_memberships(member_user_id);
CREATE INDEX IF NOT EXISTS idx_team_memberships_owner_uid ON public.team_memberships(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_team_memberships_email ON public.team_memberships(lower(invited_email));

-- 2. Fonction get_current_owner_user_id() renforcée
CREATE OR REPLACE FUNCTION public.get_current_owner_user_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    -- A. App metadata (défini par Edge Function côté serveur)
    NULLIF((auth.jwt() -> 'app_metadata' ->> 'owner_user_id'), ''),
    -- B. Table relationnelle team_memberships (accepté en priorité, ou rattaché)
    (SELECT owner_user_id FROM public.team_memberships 
     WHERE (member_user_id = auth.uid() OR lower(invited_email) = lower(auth.jwt() ->> 'email'))
       AND status = 'accepted'
     LIMIT 1),
    (SELECT owner_user_id FROM public.team_memberships 
     WHERE (member_user_id = auth.uid() OR lower(invited_email) = lower(auth.jwt() ->> 'email'))
     LIMIT 1),
    -- C. User metadata (métadonnées Supabase Auth du collaborateur)
    NULLIF((auth.jwt() -> 'user_metadata' ->> 'owner_user_id'), ''),
    -- D. Utilisateur gérant exploitant lui-même
    auth.uid()::text
  );
$$;

REVOKE ALL ON FUNCTION public.get_current_owner_user_id() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_current_owner_user_id() TO authenticated;

-- 3. Fonction is_current_user_worker() renforcée
CREATE OR REPLACE FUNCTION public.is_current_user_worker()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (
    (auth.jwt() -> 'app_metadata' ->> 'is_team_member') = 'true'
    OR (auth.jwt() -> 'user_metadata' ->> 'is_team_member') = 'true'
    OR (auth.jwt() -> 'app_metadata' ->> 'owner_user_id') IS NOT NULL
    OR (auth.jwt() -> 'user_metadata' ->> 'owner_user_id') IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM public.team_memberships 
      WHERE (member_user_id = auth.uid() OR lower(invited_email) = lower(auth.jwt() ->> 'email'))
    )
  );
$$;

REVOKE ALL ON FUNCTION public.is_current_user_worker() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_current_user_worker() TO authenticated;

-- 4. Rechargement des politiques RLS sur les tables Prestation
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcelles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planned_works ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_select_policy" ON public.clients;
CREATE POLICY "clients_select_policy" ON public.clients
  FOR SELECT TO authenticated
  USING (user_id = public.get_current_owner_user_id());

DROP POLICY IF EXISTS "parcelles_select_policy" ON public.parcelles;
CREATE POLICY "parcelles_select_policy" ON public.parcelles
  FOR SELECT TO authenticated
  USING (user_id = public.get_current_owner_user_id());

DROP POLICY IF EXISTS "interventions_select_policy" ON public.interventions;
CREATE POLICY "interventions_select_policy" ON public.interventions
  FOR SELECT TO authenticated
  USING (user_id = public.get_current_owner_user_id());

DROP POLICY IF EXISTS "interventions_insert_policy" ON public.interventions;
CREATE POLICY "interventions_insert_policy" ON public.interventions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_current_owner_user_id());

DROP POLICY IF EXISTS "interventions_update_policy" ON public.interventions;
CREATE POLICY "interventions_update_policy" ON public.interventions
  FOR UPDATE TO authenticated
  USING (user_id = public.get_current_owner_user_id())
  WITH CHECK (user_id = public.get_current_owner_user_id());

DROP POLICY IF EXISTS "services_select_policy" ON public.services;
CREATE POLICY "services_select_policy" ON public.services
  FOR SELECT TO authenticated
  USING (user_id = public.get_current_owner_user_id());

DROP POLICY IF EXISTS "planned_works_select_policy" ON public.planned_works;
CREATE POLICY "planned_works_select_policy" ON public.planned_works
  FOR SELECT TO authenticated
  USING (user_id = public.get_current_owner_user_id());
