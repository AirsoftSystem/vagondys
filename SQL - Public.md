
/*

-- ==========================================
-- SCRIPT D'INITIALISATION COMPLET - VAGONDYS
-- Version UNIQUE - Prête à exécuter
-- ==========================================

-- ==========================================
-- 1. TABLE ATHLETES (Profil Local + Stats cumulées)
-- ==========================================

DROP TABLE IF EXISTS public.athletes CASCADE;
CREATE TABLE public.athletes (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    dossier_ref TEXT UNIQUE,
    full_name TEXT NOT NULL,
    pseudo TEXT,
    phone TEXT,
    city TEXT,
    country TEXT DEFAULT 'FR',
    status TEXT DEFAULT 'INACTIF',
    rank TEXT DEFAULT 'RECRUE',
    points INTEGER DEFAULT 0,
    avatar_url TEXT,
    
    -- Stats cumulées
    total_matches INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    total_shots INTEGER DEFAULT 0,
    total_kills INTEGER DEFAULT 0,
    total_deaths INTEGER DEFAULT 0,
    total_assists INTEGER DEFAULT 0,
    total_hits_head INTEGER DEFAULT 0,
    total_hits_body INTEGER DEFAULT 0,
    total_hits_legs INTEGER DEFAULT 0,
    total_connected_microseconds BIGINT DEFAULT 0,
    
    -- Grade et progression
    current_grade_id INTEGER DEFAULT 1,
    precision_progress FLOAT DEFAULT 0,
    current_cycle_shot_count INTEGER DEFAULT 0,
    current_cycle_precision FLOAT DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 2. INDEX SUR ATHLETES
-- ==========================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_athletes_dossier_ref_unique ON athletes(dossier_ref);
CREATE INDEX IF NOT EXISTS idx_athletes_email ON athletes(email);
CREATE INDEX IF NOT EXISTS idx_athletes_city ON athletes(city);
CREATE INDEX IF NOT EXISTS idx_athletes_status ON athletes(status);
CREATE INDEX IF NOT EXISTS idx_athletes_pseudo ON athletes(pseudo);

-- ==========================================
-- 3. RLS ATHLETES
-- ==========================================

ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Joueurs voient leur profil" ON public.athletes 
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Mise à jour par le joueur" ON public.athletes 
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Staff full access" ON public.athletes 
    FOR ALL TO service_role USING (true);

CREATE POLICY "Staff authenticated can read all athletes" ON public.athletes
    FOR SELECT USING (
        auth.role() = 'authenticated' 
        AND auth.email() LIKE '%@vagondys.com'
    );

-- ✅ AJOUT : Politique pour permettre la lecture publique (nécessaire pour l'espace joueur)
CREATE POLICY "Allow select for authenticated users" ON public.athletes
    FOR SELECT USING (auth.role() = 'authenticated');

-- ✅ AJOUT : Politique pour permettre l'insertion lors de l'inscription
CREATE POLICY "Allow insert for signup" ON public.athletes
    FOR INSERT WITH CHECK (true);

-- ==========================================
-- 4. TABLE PENDING_SIGNALS
-- ==========================================

DROP TABLE IF EXISTS public.pending_signals CASCADE;
CREATE TABLE public.pending_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dossier_ref TEXT,
    payload JSONB NOT NULL,
    confirmed BOOLEAN DEFAULT false,
    is_read BOOLEAN DEFAULT false,
    is_new_athlete BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pending_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Insertion libre" ON public.pending_signals 
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Staff full access" ON public.pending_signals 
    FOR ALL TO service_role USING (true);

CREATE POLICY "Staff authenticated read signals" ON public.pending_signals
    FOR SELECT USING (
        auth.role() = 'authenticated' 
        AND auth.email() LIKE '%@vagondys.com'
    );

-- ==========================================
-- 5. TABLE MATCH_HISTORY
-- ==========================================

DROP TABLE IF EXISTS public.match_history CASCADE;
CREATE TABLE public.match_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    date TIMESTAMP NOT NULL DEFAULT NOW(),
    duration FLOAT NOT NULL CHECK (duration >= 0),
    score INT NOT NULL CHECK (score >= 0),
    kills INT NOT NULL DEFAULT 0 CHECK (kills >= 0),
    deaths INT NOT NULL DEFAULT 0 CHECK (deaths >= 0),
    assists INT NOT NULL DEFAULT 0 CHECK (assists >= 0),
    shots INT NOT NULL DEFAULT 0 CHECK (shots >= 0 AND shots <= 20),
    hits_head INT NOT NULL DEFAULT 0 CHECK (hits_head >= 0),
    hits_body INT NOT NULL DEFAULT 0 CHECK (hits_body >= 0),
    hits_legs INT NOT NULL DEFAULT 0 CHECK (hits_legs >= 0),
    win BOOLEAN NOT NULL DEFAULT true,
    game_group TEXT NOT NULL DEFAULT 'CPT1',
    shot_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- 6. INDEX SUR MATCH_HISTORY
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_match_history_player_id ON match_history(player_id);
CREATE INDEX IF NOT EXISTS idx_match_history_date ON match_history(date DESC);
CREATE INDEX IF NOT EXISTS idx_match_history_player_date ON match_history(player_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_match_history_score ON match_history(score DESC);

-- ==========================================
-- 7. RLS MATCH_HISTORY
-- ==========================================

ALTER TABLE public.match_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Les joueurs voient leurs matchs" ON public.match_history
    FOR SELECT USING (auth.uid() = player_id);

CREATE POLICY "Les joueurs ajoutent leurs matchs" ON public.match_history
    FOR INSERT WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Les joueurs modifient leurs matchs" ON public.match_history
    FOR UPDATE USING (auth.uid() = player_id);

CREATE POLICY "Les joueurs suppriment leurs matchs" ON public.match_history
    FOR DELETE USING (auth.uid() = player_id);

CREATE POLICY "Staff full access" ON public.match_history
    FOR ALL TO service_role USING (true);

CREATE POLICY "Staff authenticated read all matches" ON public.match_history
    FOR SELECT USING (
        auth.role() = 'authenticated' 
        AND auth.email() LIKE '%@vagondys.com'
    );

-- ==========================================
-- 8. TABLE GAME_LAUNCHES
-- ==========================================

DROP TABLE IF EXISTS public.game_launches CASCADE;
CREATE TABLE public.game_launches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_email TEXT NOT NULL,
    game_mode TEXT NOT NULL,
    lane_id INT NOT NULL,
    player_pseudos JSONB NOT NULL,
    city TEXT NOT NULL,
    country TEXT DEFAULT 'FR',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_launches_agent ON game_launches(agent_email);
CREATE INDEX IF NOT EXISTS idx_game_launches_date ON game_launches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_launches_city ON game_launches(city);

ALTER TABLE public.game_launches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff full access" ON public.game_launches FOR ALL TO service_role USING (true);

CREATE POLICY "Staff authenticated manage game launches" ON public.game_launches
    FOR ALL USING (
        auth.role() = 'authenticated' 
        AND auth.email() LIKE '%@vagondys.com'
    );

-- ==========================================
-- 9. VUES UTILES (avec security_invoker)
-- ==========================================

DROP VIEW IF EXISTS public.leaderboard CASCADE;
CREATE VIEW public.leaderboard
WITH (security_invoker = on)
AS
SELECT 
    a.id,
    a.pseudo,
    a.full_name,
    a.city,
    COALESCE(a.total_score, 0) AS total_score,
    COALESCE(a.total_matches, 0) AS total_matches,
    CASE 
        WHEN COALESCE(a.total_matches, 0) > 0 
        THEN a.total_score / a.total_matches 
        ELSE 0 
    END AS avg_score,
    RANK() OVER (ORDER BY COALESCE(a.total_score, 0) DESC) AS rank_position
FROM athletes a
WHERE a.status = 'ACTIF';

DROP VIEW IF EXISTS public.player_stats CASCADE;
CREATE VIEW public.player_stats
WITH (security_invoker = on)
AS
SELECT 
    a.id,
    a.pseudo,
    a.full_name,
    a.city,
    a.status,
    a.rank,
    a.current_grade_id,
    a.precision_progress,
    a.current_cycle_shot_count,
    a.current_cycle_precision,
    COALESCE(a.total_matches, 0) AS total_matches,
    COALESCE(a.total_score, 0) AS total_score,
    COALESCE(a.total_shots, 0) AS total_shots,
    COALESCE(a.total_kills, 0) AS total_kills,
    COALESCE(a.total_deaths, 0) AS total_deaths,
    COALESCE(a.total_assists, 0) AS total_assists,
    COALESCE(a.total_hits_head, 0) AS total_headshots,
    COALESCE(a.total_hits_body, 0) AS total_bodyhits,
    COALESCE(a.total_hits_legs, 0) AS total_leghits
FROM athletes a;

-- ==========================================
-- 10. FONCTION DE MISE À JOUR AUTO (updated_at)
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_athletes_updated_at ON athletes;
CREATE TRIGGER trigger_athletes_updated_at
    BEFORE UPDATE ON athletes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- 11. VÉRIFICATION FINALE
-- ==========================================

-- Vérifier que la table athletes existe
SELECT COUNT(*) as table_exists FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'athletes';

-- Vérifier le nombre d'athlètes
SELECT COUNT(*) as total_athletes FROM athletes;

-- ==========================================
-- FIN DU SCRIPT
-- ==========================================
*/
