-- ==============================================================================
-- VITITRACK PRESTATION — SCRIPT DE RETOUR ARRIÈRE SÉCURISÉ (ROLLBACK MIGRATION 02)
-- ==============================================================================
-- Restaure rigoureusement l'état exact des politiques présentes AVANT la migration 02.
-- CONSERVATION CRITIQUE : Les fonctions get_current_owner_user_id() et
-- is_current_user_worker() sont STRICTEMENT CONSERVÉES afin de préserver
-- le partage des données en lecture acquis lors de la Phase 1.
-- ==============================================================================

BEGIN;

-- 1. Restauration de public.clients à l'état pré-migration 02
DROP POLICY IF EXISTS "clients_insert_policy" ON public.clients;
DROP POLICY IF EXISTS "clients_update_policy" ON public.clients;
DROP POLICY IF EXISTS "clients_delete_policy" ON public.clients;
DROP POLICY IF EXISTS "clients_select_policy" ON public.clients;

-- Maintien de la lecture partagée
CREATE POLICY "clients_select_policy" ON public.clients
  FOR SELECT TO authenticated
  USING (user_id = public.get_current_owner_user_id());

-- Rétablissement de la politique d'écriture individuelle initiale
CREATE POLICY "clients_owner_all" ON public.clients
  FOR ALL TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);


-- 2. Restauration de public.parcelles à l'état pré-migration 02
DROP POLICY IF EXISTS "parcelles_insert_policy" ON public.parcelles;
DROP POLICY IF EXISTS "parcelles_update_policy" ON public.parcelles;
DROP POLICY IF EXISTS "parcelles_delete_policy" ON public.parcelles;
DROP POLICY IF EXISTS "parcelles_select_policy" ON public.parcelles;

CREATE POLICY "parcelles_select_policy" ON public.parcelles
  FOR SELECT TO authenticated
  USING (user_id = public.get_current_owner_user_id());

CREATE POLICY "parcelles_owner_all" ON public.parcelles
  FOR ALL TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);


-- 3. Restauration de public.interventions à l'état pré-migration 02
DROP POLICY IF EXISTS "interventions_delete_policy" ON public.interventions;
DROP POLICY IF EXISTS "interventions_select_policy" ON public.interventions;
DROP POLICY IF EXISTS "interventions_insert_policy" ON public.interventions;
DROP POLICY IF EXISTS "interventions_update_policy" ON public.interventions;

CREATE POLICY "interventions_select_policy" ON public.interventions
  FOR SELECT TO authenticated
  USING (user_id = public.get_current_owner_user_id());

CREATE POLICY "interventions_insert_policy" ON public.interventions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_current_owner_user_id());

CREATE POLICY "interventions_update_policy" ON public.interventions
  FOR UPDATE TO authenticated
  USING (user_id = public.get_current_owner_user_id())
  WITH CHECK (user_id = public.get_current_owner_user_id());


-- 4. Restauration de public.services à l'état pré-migration 02
DROP POLICY IF EXISTS "services_insert_policy" ON public.services;
DROP POLICY IF EXISTS "services_update_policy" ON public.services;
DROP POLICY IF EXISTS "services_delete_policy" ON public.services;
DROP POLICY IF EXISTS "services_select_policy" ON public.services;

CREATE POLICY "services_select_policy" ON public.services
  FOR SELECT TO authenticated
  USING (user_id = public.get_current_owner_user_id());

CREATE POLICY "services_owner_all" ON public.services
  FOR ALL TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);


-- 5. Restauration de public.planned_works à l'état pré-migration 02
DROP POLICY IF EXISTS "planned_works_insert_policy" ON public.planned_works;
DROP POLICY IF EXISTS "planned_works_update_policy" ON public.planned_works;
DROP POLICY IF EXISTS "planned_works_delete_policy" ON public.planned_works;
DROP POLICY IF EXISTS "planned_works_select_policy" ON public.planned_works;

CREATE POLICY "planned_works_select_policy" ON public.planned_works
  FOR SELECT TO authenticated
  USING (user_id = public.get_current_owner_user_id());

CREATE POLICY "planned_works_owner_all" ON public.planned_works
  FOR ALL TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);


-- 6. Restauration de public.subscriptions à l'état pré-migration 02
DROP POLICY IF EXISTS "subscriptions_select_policy" ON public.subscriptions;

CREATE POLICY "subscriptions_owner_all" ON public.subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- 7. Restauration de public.team_memberships à l'état pré-migration 02
DROP POLICY IF EXISTS "team_memberships_select_policy" ON public.team_memberships;
DROP POLICY IF EXISTS "team_memberships_insert_policy" ON public.team_memberships;
DROP POLICY IF EXISTS "team_memberships_update_policy" ON public.team_memberships;
DROP POLICY IF EXISTS "team_memberships_delete_policy" ON public.team_memberships;

CREATE POLICY "team_memberships_owner_all" ON public.team_memberships
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid()::text OR member_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid()::text);


-- 8. Nettoyage ciblé de la seule fonction introduite par la migration 02
-- (get_current_owner_user_id et is_current_user_worker sont préservées intactes)
DROP FUNCTION IF EXISTS public.can_current_user_view_dashboard();

COMMIT;
