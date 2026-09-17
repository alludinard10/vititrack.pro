-- ==============================================================================
-- VitiTrack Pro — Schéma PostgreSQL Supabase pour Stripe & Abonnements
-- À exécuter dans l'éditeur SQL de votre tableau de bord Supabase
-- ==============================================================================

-- 1. Table des abonnements (subscriptions)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT UNIQUE,
    plan_id TEXT NOT NULL DEFAULT 'basic', -- 'basic' (29€), 'pro' (49€), 'enterprise' (99€)
    plan_name TEXT NOT NULL DEFAULT 'Basic',
    plan_price_ht NUMERIC(10, 2) NOT NULL DEFAULT 29.00,
    status TEXT NOT NULL DEFAULT 'incomplete', -- 'active', 'trialing', 'past_due', 'canceled', 'incomplete'
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    canceled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_subscription UNIQUE (user_id)
);

-- 2. Index pour des requêtes ultra-rapides
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON public.subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

-- 3. Activation de Row Level Security (RLS)
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- 4. Politiques de sécurité (RLS)
-- Les utilisateurs connectés peuvent LIRE uniquement leur propre abonnement
DROP POLICY IF EXISTS "Les utilisateurs peuvent consulter leur propre abonnement" ON public.subscriptions;
CREATE POLICY "Les utilisateurs peuvent consulter leur propre abonnement"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Seul le rôle de service (Edge Functions / Webhook Stripe) peut créer ou modifier
DROP POLICY IF EXISTS "Seul le service_role peut modifier les abonnements" ON public.subscriptions;
CREATE POLICY "Seul le service_role peut modifier les abonnements"
ON public.subscriptions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 5. Trigger automatique pour mettre à jour 'updated_at'
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER set_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 6. Table d'historique des factures / transactions (optionnel mais recommandé)
CREATE TABLE IF NOT EXISTS public.payment_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_invoice_id TEXT UNIQUE,
    stripe_customer_id TEXT,
    amount_paid_ht NUMERIC(10, 2),
    amount_paid_ttc NUMERIC(10, 2),
    currency TEXT DEFAULT 'eur',
    status TEXT, -- 'paid', 'open', 'void', 'uncollectible'
    invoice_pdf_url TEXT,
    hosted_invoice_url TEXT,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payment_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Les utilisateurs consultent leurs factures" ON public.payment_invoices;
CREATE POLICY "Les utilisateurs consultent leurs factures"
ON public.payment_invoices
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role gère les factures" ON public.payment_invoices;
CREATE POLICY "Service role gère les factures"
ON public.payment_invoices
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
