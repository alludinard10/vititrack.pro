-- ==============================================================================
-- VITITRACK PRESTATION — PHASE 1 : MIGRATION 01 (DOMAINE LUDINARD EXCLUSIF)
-- RATTACHEMENT RELATIONNEL DE PAUL LUDINARD À ALEXIS LUDINARD
-- ==============================================================================
-- IMPORTANT : Ce script est PRÉPARÉ LOCALEMENT.
-- Il ne doit être exécuté sur Supabase qu'après validation explicite de l'utilisateur.
-- Concerne EXCLUSIVEMENT le Domaine Ludinard.
-- Aucune autre entreprise ni aucun autre utilisateur n'est modifié.
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
CREATE UNIQUE INDEX IF NOT EXISTS uq_team_memberships_member_uid ON public.team_memberships(member_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_team_memberships_owner_member ON public.team_memberships(owner_user_id, member_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_team_memberships_owner_email ON public.team_memberships(owner_user_id, lower(invited_email));

-- 2. Insertion et rattachement exclusif : Domaine Ludinard
-- Gérant titulaire : Alexis Ludinard (al.ludinard@gmail.com / c2d45d88-3214-4c93-9361-565d6ac24d1a)
-- Collaborateur    : Paul Ludinard (paul.ludinard2006@gmail.com / 605ca04a-7947-4b84-8bfb-2f167c80e010)
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

COMMIT;
