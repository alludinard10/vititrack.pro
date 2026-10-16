-- ==============================================================================
-- VITITRACK PRESTATION — ÉTAPE B : MIGRATION 01
-- RATTACHEMENT RELATIONNEL DES COLLABORATEURS DANS TEAM_MEMBERSHIPS
-- ==============================================================================
-- IMPORTANT : Ce script est PRÉPARÉ LOCALEMENT.
-- Il ne doit être exécuté sur Supabase qu'après validation explicite de l'utilisateur.
-- Aucune donnée existante n'est supprimée ou écrasée.
-- ==============================================================================

BEGIN;

-- 1. Structure renforcée de la table team_memberships
CREATE TABLE IF NOT EXISTS public.team_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id text NOT NULL,
  member_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'worker',
  can_view_dashboard boolean DEFAULT false,
  status text NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  invited_by text NOT NULL,
  invited_email text,
  invitation_token text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  accepted_at timestamptz DEFAULT now(),
  CONSTRAINT chk_no_self_membership CHECK (owner_user_id <> member_user_id::text)
);

-- Index pour des performances instantanées lors des contrôles RLS
CREATE INDEX IF NOT EXISTS idx_team_memberships_member_uid ON public.team_memberships(member_user_id);
CREATE INDEX IF NOT EXISTS idx_team_memberships_owner_uid ON public.team_memberships(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_team_memberships_email ON public.team_memberships(lower(invited_email));
CREATE UNIQUE INDEX IF NOT EXISTS uq_team_memberships_owner_member ON public.team_memberships(owner_user_id, member_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_team_memberships_owner_email ON public.team_memberships(owner_user_id, lower(invited_email));

-- 2. Insertion et rattachement des collaborateurs confirmés (Idempotent)

-- A. Équipe VISION VITICULTURE (Gérant: contact@vision-viticulture.fr / 5c878b2c-8fa7-465b-86c6-769f10f2fa07)
-- Collaborateur 1 : Victor De Muynck (Ouvrier viticole qualifié)
INSERT INTO public.team_memberships (
  owner_user_id,
  member_user_id,
  invited_email,
  role,
  can_view_dashboard,
  status,
  invited_by
)
VALUES (
  '5c878b2c-8fa7-465b-86c6-769f10f2fa07',
  '93ba8bee-a353-4b36-aa53-453290d13f63',
  'victordemuynck69@gmail.com',
  'Ouvrier viticole qualifié',
  false,
  'accepted',
  '5c878b2c-8fa7-465b-86c6-769f10f2fa07'
)
ON CONFLICT (owner_user_id, member_user_id) DO UPDATE SET
  role = EXCLUDED.role,
  can_view_dashboard = EXCLUDED.can_view_dashboard,
  status = 'accepted',
  updated_at = now();

-- Collaborateur 2 : Florian Celce (Chef de culture / Responsable)
INSERT INTO public.team_memberships (
  owner_user_id,
  member_user_id,
  invited_email,
  role,
  can_view_dashboard,
  status,
  invited_by
)
VALUES (
  '5c878b2c-8fa7-465b-86c6-769f10f2fa07',
  'bbb2a1e6-e48e-4d6b-8c5c-ed7ce87e4d84',
  'celcius_niv@hotmail.fr',
  'Chef de culture / Responsable',
  false,
  'accepted',
  '5c878b2c-8fa7-465b-86c6-769f10f2fa07'
)
ON CONFLICT (owner_user_id, member_user_id) DO UPDATE SET
  role = EXCLUDED.role,
  can_view_dashboard = EXCLUDED.can_view_dashboard,
  status = 'accepted',
  updated_at = now();

-- B. Équipe DOMAINE LUDINARD (Gérant: al.ludinard@gmail.com / c2d45d88-3214-4c93-9361-565d6ac24d1a)
-- Collaborateur : Paul Ludinard (Tractoriste / Chauffeur d'engins)
INSERT INTO public.team_memberships (
  owner_user_id,
  member_user_id,
  invited_email,
  role,
  can_view_dashboard,
  status,
  invited_by
)
VALUES (
  'c2d45d88-3214-4c93-9361-565d6ac24d1a',
  '605ca04a-7947-4b84-8bfb-2f167c80e010',
  'paul.ludinard2006@gmail.com',
  'Tractoriste / Chauffeur d''engins',
  true,
  'accepted',
  'c2d45d88-3214-4c93-9361-565d6ac24d1a'
)
ON CONFLICT (owner_user_id, member_user_id) DO UPDATE SET
  role = EXCLUDED.role,
  can_view_dashboard = EXCLUDED.can_view_dashboard,
  status = 'accepted',
  updated_at = now();

-- ==============================================================================
-- 3. CAS AMBIGUS EN ATTENTE DE VALIDATION MANUELLE DU CLIENT (NON INSÉRÉS) :
-- ==============================================================================
-- Cas A : SAA SERVICE (Steve Abodo Alinga : saa-service@outlook.fr / 4e698d5b-8988-47da-8898-ce1c14d037d2)
--         vs SAA Viti Solutions (saa.viticulture@outlook.fr / 047d20c6-c0d0-44b7-af87-daa126a5e625)
--         -> Confirmation requise avant rattachement.
-- Cas B : Comptes de tests techniques :
--         test-owner-carto@vititrack.local, alexandre.martin.viti@test.com, vititrack.test.checkout@gmail.com
--         -> Conservés isolés sans rattachement à des entreprises réelles.
-- ==============================================================================

COMMIT;
