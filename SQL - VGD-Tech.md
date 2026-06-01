
-- ==========================================================
-- SCRIPT UNIQUE POUR VGD-TECH
-- Architecture UNIFIÉE : 1 projet = TOUTES les tables
-- La colonne "city" permet de filtrer par ville
-- ==========================================================

-- ==========================================================
-- 1. TABLE athletes (joueurs)
-- ==========================================================

DROP TABLE IF EXISTS public.athletes CASCADE;
CREATE TABLE public.athletes (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    dossier_ref TEXT UNIQUE,
    full_name TEXT NOT NULL,
    pseudo TEXT,
    phone TEXT,
    city TEXT NOT NULL,
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

-- Index
CREATE UNIQUE INDEX IF NOT EXISTS idx_athletes_dossier_ref_unique ON athletes(dossier_ref);
CREATE INDEX IF NOT EXISTS idx_athletes_email ON athletes(email);
CREATE INDEX IF NOT EXISTS idx_athletes_city ON athletes(city);
CREATE INDEX IF NOT EXISTS idx_athletes_status ON athletes(status);
CREATE INDEX IF NOT EXISTS idx_athletes_pseudo ON athletes(pseudo);
CREATE INDEX IF NOT EXISTS idx_athletes_city_country ON athletes(city, country);

-- RLS
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

CREATE POLICY "Allow select for authenticated users" ON public.athletes
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert for signup" ON public.athletes
    FOR INSERT WITH CHECK (true);

-- ==========================================================
-- 2. TABLE match_history
-- ==========================================================

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
    city TEXT NOT NULL,
    country TEXT DEFAULT 'FR',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_match_history_player_id ON match_history(player_id);
CREATE INDEX IF NOT EXISTS idx_match_history_date ON match_history(date DESC);
CREATE INDEX IF NOT EXISTS idx_match_history_player_date ON match_history(player_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_match_history_score ON match_history(score DESC);
CREATE INDEX IF NOT EXISTS idx_match_history_city ON match_history(city);
CREATE INDEX IF NOT EXISTS idx_match_history_city_created ON match_history(city, created_at);

-- RLS
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

-- ==========================================================
-- 3. TABLE pending_signals
-- ==========================================================

DROP TABLE IF EXISTS public.pending_signals CASCADE;
CREATE TABLE public.pending_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dossier_ref TEXT,
    payload JSONB NOT NULL,
    confirmed BOOLEAN DEFAULT false,
    is_read BOOLEAN DEFAULT false,
    is_new_athlete BOOLEAN DEFAULT false,
    city TEXT NOT NULL,
    country TEXT DEFAULT 'FR',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_pending_signals_dossier_ref ON pending_signals(dossier_ref);
CREATE INDEX IF NOT EXISTS idx_pending_signals_is_read ON pending_signals(is_read);
CREATE INDEX IF NOT EXISTS idx_pending_signals_created_at ON pending_signals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_signals_confirmed ON pending_signals(confirmed);
CREATE INDEX IF NOT EXISTS idx_pending_signals_city ON pending_signals(city);

-- RLS
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

CREATE POLICY "anon read access" ON public.pending_signals
    FOR SELECT USING (true);

-- ==========================================================
-- 4. TABLE communication_replies
-- ==========================================================

DROP TABLE IF EXISTS public.communication_replies CASCADE;
CREATE TABLE public.communication_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    dossier_ref TEXT NOT NULL,
    agent_email TEXT NOT NULL,
    content TEXT NOT NULL,
    document_url TEXT,
    city TEXT NOT NULL,
    country TEXT DEFAULT 'FR'
);

-- Index
CREATE INDEX IF NOT EXISTS idx_communication_replies_dossier_ref ON communication_replies(dossier_ref);
CREATE INDEX IF NOT EXISTS idx_communication_replies_created_at ON communication_replies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_communication_replies_agent_email ON communication_replies(agent_email);
CREATE INDEX IF NOT EXISTS idx_communication_replies_city ON communication_replies(city);

-- RLS
ALTER TABLE public.communication_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff Replies Access" ON public.communication_replies 
    FOR ALL USING (true);

CREATE POLICY "Service role full access replies" ON public.communication_replies
    FOR ALL TO service_role USING (true);

CREATE POLICY "Staff authenticated access replies" ON public.communication_replies
    FOR ALL USING (
        auth.role() = 'authenticated' 
        AND auth.email() LIKE '%@vagondys.com'
    );

CREATE POLICY "anon read access replies" ON public.communication_replies
    FOR SELECT USING (true);

-- ==========================================================
-- 5. TABLE game_launches
-- ==========================================================

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

-- Index
CREATE INDEX IF NOT EXISTS idx_game_launches_agent ON game_launches(agent_email);
CREATE INDEX IF NOT EXISTS idx_game_launches_date ON game_launches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_launches_city ON game_launches(city);

-- RLS
ALTER TABLE public.game_launches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff full access" ON public.game_launches FOR ALL TO service_role USING (true);

CREATE POLICY "Staff authenticated manage game launches" ON public.game_launches
    FOR ALL USING (
        auth.role() = 'authenticated' 
        AND auth.email() LIKE '%@vagondys.com'
    );

CREATE POLICY "anon read access game launches" ON public.game_launches
    FOR SELECT USING (true);

-- ==========================================================
-- 6. TABLE athletes_registry (Annuaire central)
-- ==========================================================

DROP TABLE IF EXISTS public.athletes_registry CASCADE;
CREATE TABLE public.athletes_registry (
    user_id UUID UNIQUE,
    email TEXT PRIMARY KEY,
    dossier_ref TEXT UNIQUE,
    city TEXT NOT NULL,
    country TEXT DEFAULT 'FRANCE',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE UNIQUE INDEX IF NOT EXISTS idx_athletes_registry_dossier_ref_unique ON athletes_registry(dossier_ref);
CREATE INDEX IF NOT EXISTS idx_athletes_registry_city ON athletes_registry(city);

-- Contrainte
ALTER TABLE athletes_registry DROP CONSTRAINT IF EXISTS unique_registry_dossier_ref;
ALTER TABLE athletes_registry ADD CONSTRAINT unique_registry_dossier_ref UNIQUE USING INDEX idx_athletes_registry_dossier_ref_unique;

-- RLS
ALTER TABLE public.athletes_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture registre par email" ON public.athletes_registry
    FOR SELECT USING (auth.jwt() ->> 'email' = email);

-- ==========================================================
-- 7. TABLE email_confirmations
-- ==========================================================

DROP TABLE IF EXISTS public.email_confirmations CASCADE;
CREATE TABLE public.email_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.email_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin update confirmations" ON public.email_confirmations
    FOR UPDATE TO service_role
    USING (true)
    WITH CHECK (true);

-- ==========================================================
-- 8. TABLE staff_registry
-- ==========================================================

DROP TABLE IF EXISTS public.staff_registry CASCADE;
CREATE TABLE public.staff_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    city TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'agent',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_staff_registry_email ON staff_registry(email);
CREATE INDEX IF NOT EXISTS idx_staff_registry_city ON staff_registry(city);

-- RLS
ALTER TABLE public.staff_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role to read staff_registry" ON public.staff_registry
    FOR SELECT TO service_role
    USING (true);

-- ==========================================================
-- 9. TABLE tournament_results
-- ==========================================================

DROP TABLE IF EXISTS public.tournament_results CASCADE;
CREATE TABLE public.tournament_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    tournament_name TEXT NOT NULL,
    tournament_date DATE NOT NULL,
    position INTEGER NOT NULL,
    points_gained INTEGER NOT NULL,
    category TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT DEFAULT 'FR',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tournament_results_player_id ON tournament_results(player_id);
CREATE INDEX IF NOT EXISTS idx_tournament_results_city ON tournament_results(city);
CREATE INDEX IF NOT EXISTS idx_tournament_results_city_date ON tournament_results(city, tournament_date);

ALTER TABLE public.tournament_results ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- 10. TABLE rankings_history
-- ==========================================================

DROP TABLE IF EXISTS public.rankings_history CASCADE;
CREATE TABLE public.rankings_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    rank INTEGER NOT NULL,
    previous_rank INTEGER NOT NULL,
    points INTEGER NOT NULL,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    city TEXT NOT NULL,
    country TEXT DEFAULT 'FR',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rankings_history_player_id ON rankings_history(player_id);
CREATE INDEX IF NOT EXISTS idx_rankings_history_city ON rankings_history(city);
CREATE INDEX IF NOT EXISTS idx_rankings_history_city_week ON rankings_history(city, week_start);

ALTER TABLE public.rankings_history ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- 11. TABLE as_eg_sessions
-- ==========================================================

DROP TABLE IF EXISTS public.as_eg_sessions CASCADE;
CREATE TABLE public.as_eg_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    session_type TEXT NOT NULL,
    score INTEGER NOT NULL,
    max_score INTEGER NOT NULL,
    duration_seconds INTEGER NOT NULL,
    city TEXT NOT NULL,
    country TEXT DEFAULT 'FR',
    created_at TIMESTAMPTZ DEFAULT now(),
    archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_as_eg_sessions_player_id ON as_eg_sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_as_eg_sessions_city ON as_eg_sessions(city);
CREATE INDEX IF NOT EXISTS idx_as_eg_sessions_city_created ON as_eg_sessions(city, created_at);

ALTER TABLE public.as_eg_sessions ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- 12. TABLE player_archives
-- ==========================================================

DROP TABLE IF EXISTS public.player_archives CASCADE;
CREATE TABLE public.player_archives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    player_email TEXT NOT NULL,
    year INTEGER NOT NULL,
    archive_url TEXT NOT NULL,
    archive_size INTEGER,
    city TEXT NOT NULL,
    country TEXT DEFAULT 'FR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    access_count INTEGER DEFAULT 0,
    UNIQUE(player_id, year)
);

CREATE INDEX IF NOT EXISTS idx_player_archives_player_id ON player_archives(player_id);
CREATE INDEX IF NOT EXISTS idx_player_archives_year ON player_archives(year);
CREATE INDEX IF NOT EXISTS idx_player_archives_city ON player_archives(city);
CREATE INDEX IF NOT EXISTS idx_player_archives_player_year ON player_archives(player_id, year);

ALTER TABLE public.player_archives ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- 13. TABLE time_slots
-- ==========================================================

DROP TABLE IF EXISTS public.time_slots CASCADE;
CREATE TABLE public.time_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'booked', 'maintenance')),
    booked_by UUID,
    booked_by_name TEXT,
    price INTEGER NOT NULL DEFAULT 25,
    max_participants INTEGER NOT NULL DEFAULT 4,
    current_participants INTEGER NOT NULL DEFAULT 0,
    is_recurring BOOLEAN DEFAULT FALSE,
    city TEXT NOT NULL,
    country TEXT DEFAULT 'FR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_slots_date ON time_slots(date);
CREATE INDEX IF NOT EXISTS idx_time_slots_city ON time_slots(city);
CREATE INDEX IF NOT EXISTS idx_time_slots_status ON time_slots(status);
CREATE INDEX IF NOT EXISTS idx_time_slots_date_city ON time_slots(date, city);

ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- 14. FONCTIONS UTILES
-- ==========================================================

-- Mise à jour automatique de updated_at
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

DROP TRIGGER IF EXISTS trigger_time_slots_updated_at ON time_slots;
CREATE TRIGGER trigger_time_slots_updated_at
    BEFORE UPDATE ON time_slots
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Purge des données de plus de 2 ans
CREATE OR REPLACE FUNCTION purge_old_data()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    WITH deleted AS (
        DELETE FROM match_history
        WHERE created_at < NOW() - INTERVAL '2 years'
        RETURNING *
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;
    
    WITH deleted AS (
        DELETE FROM tournament_results
        WHERE tournament_date < NOW() - INTERVAL '2 years'
        RETURNING *
    )
    SELECT deleted_count + COUNT(*) INTO deleted_count FROM deleted;
    
    WITH deleted AS (
        DELETE FROM rankings_history
        WHERE week_start < NOW() - INTERVAL '2 years'
        RETURNING *
    )
    SELECT deleted_count + COUNT(*) INTO deleted_count FROM deleted;
    
    RETURN deleted_count;
END;
$$;

-- ==========================================================
-- 15. INSERTION DES MEMBRES DU STAFF
-- ==========================================================

INSERT INTO public.staff_registry (email, city, role) VALUES
    ('admin@vagondys.com', 'MASTER', 'admin'),
    ('vagondys@gmail.com', 'MASTER', 'superadmin'),
    ('nantes@vagondys.com', 'NANTES', 'agent'),
    ('lyon@vagondys.com', 'LYON', 'agent'),
    ('madrid@vagondys.com', 'MADRID', 'agent')
ON CONFLICT (email) DO NOTHING;

-- ==========================================================
-- 16. VUES UTILES
-- ==========================================================

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

-- ==========================================================
-- 17. TABLE pending_messagerie_requests (Demandes d'inscription à la messagerie privée)
-- ==========================================================

DROP TABLE IF EXISTS public.pending_messagerie_requests CASCADE;
CREATE TABLE public.pending_messagerie_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    company TEXT,
    phone TEXT,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    reference TEXT,                                       -- ✅ AJOUT : Référence unique VGD-XXXXXXXX
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_pending_messagerie_requests_email ON pending_messagerie_requests(email);
CREATE INDEX IF NOT EXISTS idx_pending_messagerie_requests_status ON pending_messagerie_requests(status);
CREATE INDEX IF NOT EXISTS idx_pending_messagerie_requests_created_at ON pending_messagerie_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_messagerie_requests_reference ON pending_messagerie_requests(reference);  -- ✅ AJOUT

-- RLS
ALTER TABLE public.pending_messagerie_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Insertion libre pour les demandes" ON public.pending_messagerie_requests
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.pending_messagerie_requests
    FOR ALL TO service_role USING (true);

CREATE POLICY "Staff authenticated read requests" ON public.pending_messagerie_requests
    FOR SELECT USING (
        auth.role() = 'authenticated' 
        AND auth.email() LIKE '%@vagondys.com'
    );

CREATE POLICY "Staff authenticated update requests" ON public.pending_messagerie_requests
    FOR UPDATE USING (
        auth.role() = 'authenticated' 
        AND auth.email() LIKE '%@vagondys.com'
    );

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS trigger_pending_messagerie_requests_updated_at ON pending_messagerie_requests;
CREATE TRIGGER trigger_pending_messagerie_requests_updated_at
    BEFORE UPDATE ON pending_messagerie_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==========================================================
-- 18. TABLE messagerie_accounts (Comptes validés pour la messagerie privée)
-- ==========================================================

DROP TABLE IF EXISTS public.messagerie_accounts CASCADE;
CREATE TABLE public.messagerie_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    company TEXT,
    phone TEXT,
    dossier_ref TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'partner' CHECK (role IN ('partner', 'supplier', 'provider', 'admin')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_login_at TIMESTAMPTZ,
    created_by TEXT
);

-- Index
CREATE UNIQUE INDEX IF NOT EXISTS idx_messagerie_accounts_user_id ON messagerie_accounts(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_messagerie_accounts_dossier_ref_unique ON messagerie_accounts(dossier_ref);
CREATE INDEX IF NOT EXISTS idx_messagerie_accounts_email ON messagerie_accounts(email);
CREATE INDEX IF NOT EXISTS idx_messagerie_accounts_status ON messagerie_accounts(status);
CREATE INDEX IF NOT EXISTS idx_messagerie_accounts_role ON messagerie_accounts(role);

-- RLS
ALTER TABLE public.messagerie_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.messagerie_accounts
    FOR ALL TO service_role USING (true);

CREATE POLICY "User can read own account" ON public.messagerie_accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Staff authenticated read all accounts" ON public.messagerie_accounts
    FOR SELECT USING (
        auth.role() = 'authenticated' 
        AND auth.email() LIKE '%@vagondys.com'
    );

CREATE POLICY "Staff authenticated update accounts" ON public.messagerie_accounts
    FOR UPDATE USING (
        auth.role() = 'authenticated' 
        AND auth.email() LIKE '%@vagondys.com'
    );

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS trigger_messagerie_accounts_updated_at ON messagerie_accounts;
CREATE TRIGGER trigger_messagerie_accounts_updated_at
    BEFORE UPDATE ON messagerie_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==========================================================
-- 19. INSERTION DE L'ADMIN DANS MESSAGERIE_ACCOUNTS
-- ==========================================================

INSERT INTO public.messagerie_accounts (user_id, email, full_name, role, dossier_ref, created_by)
SELECT 
    '00000000-0000-0000-0000-000000000001'::UUID,
    'admin@vagondys.com',
    'Administrateur VAGONDYS',
    'admin',
    'VGD-ADMIN001',
    'system'
WHERE NOT EXISTS (
    SELECT 1 FROM public.messagerie_accounts WHERE email = 'admin@vagondys.com'
);

-- ==========================================================
-- 20. TABLE admin_config (Configuration administration)
-- ==========================================================

DROP TABLE IF EXISTS public.admin_config CASCADE;
CREATE TABLE public.admin_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_admin_config_key ON admin_config(key);

-- RLS
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs authentifiés (staff) peuvent lire la config
CREATE POLICY "Authenticated users can read admin_config"
    ON public.admin_config
    FOR SELECT
    TO authenticated
    USING (true);

-- Seul le service role peut modifier la config
CREATE POLICY "Service role full access admin_config"
    ON public.admin_config
    FOR ALL
    TO service_role
    USING (true);

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS trigger_admin_config_updated_at ON admin_config;
CREATE TRIGGER trigger_admin_config_updated_at
    BEFORE UPDATE ON admin_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insertion du mot de passe admin par défaut
INSERT INTO public.admin_config (key, value)
VALUES ('admin_password', 'AdminVGD2026!')
ON CONFLICT (key) DO NOTHING;

-- ==========================================================
-- FIN DU SCRIPT
-- ==========================================================
