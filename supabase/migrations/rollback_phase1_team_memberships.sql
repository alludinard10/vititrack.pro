-- ==============================================================================
-- VITITRACK PRESTATION — SCRIPT DE RETOUR ARRIÈRE SPÉCIFIQUE À LA PHASE 1
-- ==============================================================================
-- Annule exclusivement le rattachement de Paul Ludinard créé lors de la Phase 1
-- ==============================================================================

BEGIN;

-- 1. Suppression stricte et ciblée du rattachement de Paul Ludinard au Domaine Ludinard
DELETE FROM public.team_memberships
WHERE member_user_id = '605ca04a-7947-4b84-8bfb-2f167c80e010'
  AND owner_user_id = 'c2d45d88-3214-4c93-9361-565d6ac24d1a';

COMMIT;
