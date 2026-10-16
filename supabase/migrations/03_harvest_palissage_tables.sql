-- ==============================================================================
-- VITITRACK PRESTATION — ÉTAPE B : MIGRATION 03
-- TABLES VENDANGES, PALISSAGE & ACTIVATION SUPABASE REALTIME
-- ==============================================================================
-- IMPORTANT : Ce script est PRÉPARÉ LOCALEMENT.
-- Il ne doit être exécuté sur Supabase qu'après validation explicite de l'utilisateur.
-- Permet la synchronisation intégrale de tous les chantiers de vendanges et palissage.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. TABLE PUBLIC.HARVEST_WORKS (PILOTAGE DES VENDANGES & RÉCOLTES)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.harvest_works (
  id text PRIMARY KEY,
  user_id text NOT NULL, -- Identifiant propriétaire (get_current_owner_user_id)
  client_id text,
  client_name text NOT NULL,
  parcel_id text,
  parcel_name text NOT NULL,
  surface numeric(10, 4) NOT NULL DEFAULT 0.0000,
  grape_variety text DEFAULT 'Non spécifié',
  leaf_status text DEFAULT 'a_faire', -- 'a_faire', 'effeuillee', 'non_necessaire'
  leaf_service_name text DEFAULT 'Effeuillage manuel',
  leaf_price numeric(10, 2) DEFAULT 550.00,
  cut_status text DEFAULT 'a_faire', -- 'a_faire', 'coupee'
  yield_kg numeric(12, 2) DEFAULT 0.00,
  boxes_count integer DEFAULT 0,
  yield_price_per_kg numeric(10, 4) DEFAULT 0.3500,
  harvest_service_name text DEFAULT 'Coupe vendange (au kilo)',
  total_amount_ht numeric(12, 2) DEFAULT 0.00,
  haul_status text DEFAULT 'a_faire', -- 'a_faire', 'debardee'
  haul_service_name text DEFAULT 'Débardage vendange',
  haul_price numeric(10, 4) DEFAULT 0.1500,
  worker text DEFAULT '',
  harvest_date text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_harvest_works_user_id ON public.harvest_works(user_id);
CREATE INDEX IF NOT EXISTS idx_harvest_works_client ON public.harvest_works(client_id);
CREATE INDEX IF NOT EXISTS idx_harvest_works_parcel ON public.harvest_works(parcel_id);

ALTER TABLE public.harvest_works ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "harvest_works_select_policy" ON public.harvest_works;
CREATE POLICY "harvest_works_select_policy" ON public.harvest_works
  FOR SELECT TO authenticated
  USING (user_id = public.get_current_owner_user_id());

DROP POLICY IF EXISTS "harvest_works_insert_policy" ON public.harvest_works;
CREATE POLICY "harvest_works_insert_policy" ON public.harvest_works
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_current_owner_user_id());

DROP POLICY IF EXISTS "harvest_works_update_policy" ON public.harvest_works;
CREATE POLICY "harvest_works_update_policy" ON public.harvest_works
  FOR UPDATE TO authenticated
  USING (user_id = public.get_current_owner_user_id())
  WITH CHECK (user_id = public.get_current_owner_user_id());

DROP POLICY IF EXISTS "harvest_works_delete_policy" ON public.harvest_works;
CREATE POLICY "harvest_works_delete_policy" ON public.harvest_works
  FOR DELETE TO authenticated
  USING (user_id = public.get_current_owner_user_id() AND NOT public.is_current_user_worker());


-- ------------------------------------------------------------------------------
-- 2. TABLE PUBLIC.PALISSAGE_WORKS (PILOTAGE DU PALISSAGE & RELEVAGE)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.palissage_works (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  client_id text,
  client_name text NOT NULL,
  parcel_id text,
  parcel_name text NOT NULL,
  surface numeric(10, 4) NOT NULL DEFAULT 0.0000,
  grape_variety text DEFAULT 'Non spécifié',
  passage1_status text DEFAULT 'a_faire',
  passage2_status text DEFAULT 'a_faire',
  passage3_status text DEFAULT 'a_faire',
  maint_status text DEFAULT 'a_faire',
  lifting_status text DEFAULT 'a_faire',
  trellising_status text DEFAULT 'a_faire',
  service_name text DEFAULT 'Palissage & Relevage',
  price numeric(10, 2) DEFAULT 36.00,
  lifting_price numeric(10, 2) DEFAULT 36.00,
  trellising_price numeric(10, 2) DEFAULT 36.00,
  worker text DEFAULT '',
  intervention_date text DEFAULT '',
  billing_status text DEFAULT 'À facturer',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_palissage_works_user_id ON public.palissage_works(user_id);
CREATE INDEX IF NOT EXISTS idx_palissage_works_client ON public.palissage_works(client_id);
CREATE INDEX IF NOT EXISTS idx_palissage_works_parcel ON public.palissage_works(parcel_id);

ALTER TABLE public.palissage_works ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "palissage_works_select_policy" ON public.palissage_works;
CREATE POLICY "palissage_works_select_policy" ON public.palissage_works
  FOR SELECT TO authenticated
  USING (user_id = public.get_current_owner_user_id());

DROP POLICY IF EXISTS "palissage_works_insert_policy" ON public.palissage_works;
CREATE POLICY "palissage_works_insert_policy" ON public.palissage_works
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_current_owner_user_id());

DROP POLICY IF EXISTS "palissage_works_update_policy" ON public.palissage_works;
CREATE POLICY "palissage_works_update_policy" ON public.palissage_works
  FOR UPDATE TO authenticated
  USING (user_id = public.get_current_owner_user_id())
  WITH CHECK (user_id = public.get_current_owner_user_id());

DROP POLICY IF EXISTS "palissage_works_delete_policy" ON public.palissage_works;
CREATE POLICY "palissage_works_delete_policy" ON public.palissage_works
  FOR DELETE TO authenticated
  USING (user_id = public.get_current_owner_user_id() AND NOT public.is_current_user_worker());


-- ------------------------------------------------------------------------------
-- 3. ACTIVATION DE SUPABASE REALTIME & REPLICA IDENTITY FULL
-- ------------------------------------------------------------------------------
-- REPLICA IDENTITY FULL garantit que Realtime transmet l'intégralité du record lors des UPDATE et DELETE
ALTER TABLE public.clients REPLICA IDENTITY FULL;
ALTER TABLE public.parcelles REPLICA IDENTITY FULL;
ALTER TABLE public.interventions REPLICA IDENTITY FULL;
ALTER TABLE public.planned_works REPLICA IDENTITY FULL;
ALTER TABLE public.services REPLICA IDENTITY FULL;
ALTER TABLE public.team_memberships REPLICA IDENTITY FULL;
ALTER TABLE public.harvest_works REPLICA IDENTITY FULL;
ALTER TABLE public.palissage_works REPLICA IDENTITY FULL;

-- Ajout des tables Prestation à la publication Supabase Realtime
DO $$
BEGIN
  -- Ajout conditionnel pour éviter les erreurs si déjà présentes
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE 
    public.clients, 
    public.parcelles, 
    public.interventions, 
    public.planned_works, 
    public.services, 
    public.team_memberships, 
    public.harvest_works, 
    public.palissage_works';
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

COMMIT;
