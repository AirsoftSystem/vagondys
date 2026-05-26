
/*

-- ==========================================
-- SCRIPT D'INITIALISATION COMPLET - BASE STAFF
-- Version UNIQUE - Prête à exécuter
-- ==========================================

-- ==========================================
-- 1. TABLE PENDING_SIGNALS (Signaux miroir)
-- ==========================================

DROP TABLE IF EXISTS public.pending_signals CASCADE;
CREATE TABLE public.pending_signals (
    id UUID PRIMARY KEY, 
    created_at TIMESTAMPTZ DEFAULT now(),
    dossier_ref TEXT,
    payload JSONB NOT NULL,
    confirmed BOOLEAN DEFAULT false,
    is_read BOOLEAN DEFAULT false,
    is_new_athlete BOOLEAN DEFAULT false
);

-- ==========================================
-- 2. TABLE COMMUNICATION_REPLIES (Historique des réponses)
-- ==========================================

DROP TABLE IF EXISTS public.communication_replies CASCADE;
CREATE TABLE public.communication_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    dossier_ref TEXT NOT NULL,
    agent_email TEXT NOT NULL,
    content TEXT NOT NULL,
    document_url TEXT
);

-- ==========================================
-- 3. TABLE GAME_LAUNCHES (Historique des lancements de jeux par le staff)
-- ==========================================

DROP TABLE IF EXISTS public.game_launches CASCADE;
CREATE TABLE public.game_launches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_email TEXT NOT NULL,
    game_mode TEXT NOT NULL,
    lane_id INT NOT NULL,
    player_pseudos JSONB NOT NULL,
    city TEXT,
    country TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 4. INDEX POUR LES PERFORMANCES
-- ==========================================

-- Index pour pending_signals
CREATE INDEX IF NOT EXISTS idx_pending_signals_dossier_ref ON public.pending_signals(dossier_ref);
CREATE INDEX IF NOT EXISTS idx_pending_signals_is_read ON public.pending_signals(is_read);
CREATE INDEX IF NOT EXISTS idx_pending_signals_created_at ON public.pending_signals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_signals_confirmed ON public.pending_signals(confirmed);

-- Index pour communication_replies
CREATE INDEX IF NOT EXISTS idx_communication_replies_dossier_ref ON public.communication_replies(dossier_ref);
CREATE INDEX IF NOT EXISTS idx_communication_replies_created_at ON public.communication_replies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_communication_replies_agent_email ON public.communication_replies(agent_email);

-- Index pour game_launches
CREATE INDEX IF NOT EXISTS idx_game_launches_agent_email ON public.game_launches(agent_email);
CREATE INDEX IF NOT EXISTS idx_game_launches_created_at ON public.game_launches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_launches_city ON public.game_launches(city);
CREATE INDEX IF NOT EXISTS idx_game_launches_game_mode ON public.game_launches(game_mode);

-- ==========================================
-- 5. SÉCURITÉ RLS
-- ==========================================

-- Activation RLS sur toutes les tables
ALTER TABLE public.pending_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_launches ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 6. POLITIQUES RLS POUR PENDING_SIGNALS
-- ==========================================

-- Politique existante : accès complet pour le staff
CREATE POLICY "Staff Access" ON public.pending_signals 
    FOR ALL USING (true);

-- Politique pour service_role (admin)
CREATE POLICY "Service role full access signals" ON public.pending_signals
    FOR ALL TO service_role USING (true);

-- Politique pour les utilisateurs authentifiés STAFF
CREATE POLICY "Staff authenticated access signals" ON public.pending_signals
    FOR ALL USING (
        auth.role() = 'authenticated' 
        AND auth.email() LIKE '%@vagondys.com'
    );

-- Suppression de l'ancienne politique si elle existe
DROP POLICY IF EXISTS "Frontend read access signals" ON public.pending_signals;

-- ✅ NOUVELLE POLITIQUE : Accès lecture ANON simplifié
CREATE POLICY "anon read access" ON public.pending_signals
    FOR SELECT USING (true);

-- ==========================================
-- 7. POLITIQUES RLS POUR COMMUNICATION_REPLIES
-- ==========================================

-- Politique existante : accès complet pour le staff
CREATE POLICY "Staff Replies Access" ON public.communication_replies 
    FOR ALL USING (true);

-- Politique pour service_role (admin)
CREATE POLICY "Service role full access replies" ON public.communication_replies
    FOR ALL TO service_role USING (true);

-- Politique pour les utilisateurs authentifiés STAFF
CREATE POLICY "Staff authenticated access replies" ON public.communication_replies
    FOR ALL USING (
        auth.role() = 'authenticated' 
        AND auth.email() LIKE '%@vagondys.com'
    );

-- Suppression de l'ancienne politique si elle existe
DROP POLICY IF EXISTS "Frontend read access replies" ON public.communication_replies;

-- ✅ POLITIQUE : Accès lecture ANON pour replies
CREATE POLICY "anon read access replies" ON public.communication_replies
    FOR SELECT USING (true);

-- ==========================================
-- 8. POLITIQUES RLS POUR GAME_LAUNCHES
-- ==========================================

-- Politique pour service_role (admin)
CREATE POLICY "Service role full access game launches" ON public.game_launches
    FOR ALL TO service_role USING (true);

-- Politique pour les utilisateurs authentifiés STAFF
CREATE POLICY "Staff authenticated manage game launches" ON public.game_launches
    FOR ALL USING (
        auth.role() = 'authenticated' 
        AND auth.email() LIKE '%@vagondys.com'
    );

-- Suppression de l'ancienne politique si elle existe
DROP POLICY IF EXISTS "Frontend read access game launches" ON public.game_launches;

-- ✅ POLITIQUE : Accès lecture ANON pour game_launches
CREATE POLICY "anon read access game launches" ON public.game_launches
    FOR SELECT USING (true);

-- ==========================================
-- 9. TRIGGER DE MISE À JOUR AUTO (optionnel pour game_launches)
-- ==========================================

-- Fonction pour mettre à jour automatiquement updated_at (si la colonne existe)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'game_launches' AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_launches' AND column_name = 'updated_at'
    ) THEN
        NEW.updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 10. VÉRIFICATIONS ET TESTS
-- ==========================================

-- Vérification 1 : Compter tous les signaux
SELECT COUNT(*) as total_signals FROM pending_signals;

-- Vérification 2 : Voir les signaux non lus et confirmés
SELECT id, dossier_ref, confirmed, is_read, created_at, payload->>'email' as email
FROM pending_signals
WHERE is_read = false AND confirmed = true
ORDER BY created_at DESC;

-- Vérification 3 : Voir le signal spécifique VGD-HLU2EHX3
SELECT id, dossier_ref, confirmed, is_read, created_at, payload->>'email' as email
FROM pending_signals
WHERE dossier_ref = 'VGD-HLU2EHX3';

-- ==========================================
-- FIN DU SCRIPT
-- ==========================================
*/
