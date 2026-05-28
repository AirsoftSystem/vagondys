
supabase/migrations/add_city_column.sql

>>>>

-- ==========================================================
-- MIGRATION: Ajout de la colonne city dans toutes les tables
-- Objectif: Permettre le multi-tenant par ville (Nantes, Lyon, Madrid, etc.)
-- Date: 2025-01-XX
-- ==========================================================

-- ==========================================================
-- 1. TABLE athletes (joueurs)
-- ==========================================================

-- Ajout de la colonne city si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'athletes' AND column_name = 'city'
    ) THEN
        ALTER TABLE athletes ADD COLUMN city TEXT;
    END IF;
END $$;

-- Ajout de la colonne country si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'athletes' AND column_name = 'country'
    ) THEN
        ALTER TABLE athletes ADD COLUMN country TEXT DEFAULT 'FR';
    END IF;
END $$;

-- Création d'un index sur city pour les performances
CREATE INDEX IF NOT EXISTS idx_athletes_city ON athletes(city);
CREATE INDEX IF NOT EXISTS idx_athletes_country ON athletes(country);

-- Index composite pour les recherches multi-ville
CREATE INDEX IF NOT EXISTS idx_athletes_city_country ON athletes(city, country);


-- ==========================================================
-- 2. TABLE match_history (historique des matchs)
-- ==========================================================

-- Ajout de la colonne city
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'match_history' AND column_name = 'city'
    ) THEN
        ALTER TABLE match_history ADD COLUMN city TEXT;
    END IF;
END $$;

-- Ajout de la colonne country
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'match_history' AND column_name = 'country'
    ) THEN
        ALTER TABLE match_history ADD COLUMN country TEXT DEFAULT 'FR';
    END IF;
END $$;

-- Index pour les requêtes de purge (WHERE city = X AND date < NOW() - INTERVAL '2 years')
CREATE INDEX IF NOT EXISTS idx_match_history_city_created ON match_history(city, created_at);
CREATE INDEX IF NOT EXISTS idx_match_history_country ON match_history(country);


-- ==========================================================
-- 3. TABLE pending_signals (signaux en attente)
-- ==========================================================

-- Ajout de la colonne city
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pending_signals' AND column_name = 'city'
    ) THEN
        ALTER TABLE pending_signals ADD COLUMN city TEXT;
    END IF;
END $$;

-- Ajout de la colonne country
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pending_signals' AND column_name = 'country'
    ) THEN
        ALTER TABLE pending_signals ADD COLUMN country TEXT DEFAULT 'FR';
    END IF;
END $$;

-- Index pour les requêtes staff par ville
CREATE INDEX IF NOT EXISTS idx_pending_signals_city ON pending_signals(city);
CREATE INDEX IF NOT EXISTS idx_pending_signals_country ON pending_signals(country);


-- ==========================================================
-- 4. TABLE tournament_results (résultats de tournois)
-- ==========================================================

-- Ajout de la colonne city
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tournament_results' AND column_name = 'city'
    ) THEN
        ALTER TABLE tournament_results ADD COLUMN city TEXT;
    END IF;
END $$;

-- Ajout de la colonne country
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tournament_results' AND column_name = 'country'
    ) THEN
        ALTER TABLE tournament_results ADD COLUMN country TEXT DEFAULT 'FR';
    END IF;
END $$;

-- Index pour les purges et les classements par ville
CREATE INDEX IF NOT EXISTS idx_tournament_results_city_date ON tournament_results(city, tournament_date);
CREATE INDEX IF NOT EXISTS idx_tournament_results_country ON tournament_results(country);


-- ==========================================================
-- 5. TABLE rankings_history (historique des classements)
-- ==========================================================

-- Ajout de la colonne city
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rankings_history' AND column_name = 'city'
    ) THEN
        ALTER TABLE rankings_history ADD COLUMN city TEXT;
    END IF;
END $$;

-- Ajout de la colonne country
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rankings_history' AND column_name = 'country'
    ) THEN
        ALTER TABLE rankings_history ADD COLUMN country TEXT DEFAULT 'FR';
    END IF;
END $$;

-- Index pour les requêtes de classement par ville
CREATE INDEX IF NOT EXISTS idx_rankings_history_city_week ON rankings_history(city, week_start);
CREATE INDEX IF NOT EXISTS idx_rankings_history_country ON rankings_history(country);


-- ==========================================================
-- 6. TABLE as_eg_sessions (sessions de notoriété)
-- ==========================================================

-- Ajout de la colonne city
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'as_eg_sessions' AND column_name = 'city'
    ) THEN
        ALTER TABLE as_eg_sessions ADD COLUMN city TEXT;
    END IF;
END $$;

-- Ajout de la colonne country
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'as_eg_sessions' AND column_name = 'country'
    ) THEN
        ALTER TABLE as_eg_sessions ADD COLUMN country TEXT DEFAULT 'FR';
    END IF;
END $$;

-- Index pour l'archivage (WHERE city = X AND created_at < NOW() - INTERVAL '1 year')
CREATE INDEX IF NOT EXISTS idx_as_eg_sessions_city_created ON as_eg_sessions(city, created_at);
CREATE INDEX IF NOT EXISTS idx_as_eg_sessions_country ON as_eg_sessions(country);


-- ==========================================================
-- 7. TABLE player_archives (archives annuelles)
-- ==========================================================

-- Création de la table si elle n'existe pas
CREATE TABLE IF NOT EXISTS player_archives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL,
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

-- Index sur player_id pour les requêtes rapides
CREATE INDEX IF NOT EXISTS idx_player_archives_player_id ON player_archives(player_id);

-- Index sur l'année pour les purges
CREATE INDEX IF NOT EXISTS idx_player_archives_year ON player_archives(year);

-- Index sur city pour le multi-tenant
CREATE INDEX IF NOT EXISTS idx_player_archives_city ON player_archives(city);

-- Index composite pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_player_archives_player_year ON player_archives(player_id, year);


-- ==========================================================
-- 8. MISE À JOUR DES POLITIQUES RLS (Row Level Security)
-- ==========================================================

-- Activer RLS sur toutes les tables si ce n'est pas déjà fait
ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE rankings_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE as_eg_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_archives ENABLE ROW LEVEL SECURITY;

-- Politique: Les joueurs ne voient que leur propre ville
DROP POLICY IF EXISTS "Users can view only their city" ON athletes;
CREATE POLICY "Users can view only their city" ON athletes
    FOR SELECT
    USING (city = current_setting('app.current_city', true)::TEXT);

DROP POLICY IF EXISTS "Users can view only their city" ON match_history;
CREATE POLICY "Users can view only their city" ON match_history
    FOR SELECT
    USING (city = current_setting('app.current_city', true)::TEXT);

DROP POLICY IF EXISTS "Users can view only their city" ON tournament_results;
CREATE POLICY "Users can view only their city" ON tournament_results
    FOR SELECT
    USING (city = current_setting('app.current_city', true)::TEXT);

-- Politique: Le staff peut tout voir (sera géré par le code, pas par RLS)
-- On laisse passer avec une condition qui sera vraie uniquement pour les staffs authentifiés
DROP POLICY IF EXISTS "Staff can view all" ON athletes;
CREATE POLICY "Staff can view all" ON athletes
    FOR ALL
    USING (current_setting('app.is_staff', true)::boolean = true);


-- ==========================================================
-- 9. FONCTION DE NETTOYAGE AUTOMATIQUE
-- ==========================================================

-- Fonction pour purger les données de plus de 2 ans (sauf city spécifique)
CREATE OR REPLACE FUNCTION purge_old_data()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Purge match_history (plus de 2 ans)
    WITH deleted AS (
        DELETE FROM match_history
        WHERE created_at < NOW() - INTERVAL '2 years'
        RETURNING *
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;
    
    -- Purge tournament_results (plus de 2 ans)
    WITH deleted AS (
        DELETE FROM tournament_results
        WHERE tournament_date < NOW() - INTERVAL '2 years'
        RETURNING *
    )
    SELECT deleted_count + COUNT(*) INTO deleted_count FROM deleted;
    
    -- Purge rankings_history (plus de 2 ans)
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
-- 10. FONCTION D'ARCHIVAGE ANNUEL
-- ==========================================================

-- Fonction pour marquer les sessions AS-EG à archiver (plus de 1 an)
CREATE OR REPLACE FUNCTION mark_as_eg_for_archive()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    to_archive_count INTEGER := 0;
BEGIN
    -- Compter les sessions à archiver
    SELECT COUNT(*) INTO to_archive_count
    FROM as_eg_sessions
    WHERE created_at < NOW() - INTERVAL '1 year'
      AND (archived_at IS NULL OR archived = false);
    
    -- Mise à jour du flag archived
    UPDATE as_eg_sessions
    SET 
        archived = true,
        archived_at = NOW()
    WHERE created_at < NOW() - INTERVAL '1 year'
      AND (archived IS NULL OR archived = false);
    
    RETURN to_archive_count;
END;
$$;


-- ==========================================================
-- 11. FONCTION POUR DÉFINIR LA VILLE COURANTE
-- ==========================================================

-- Cette fonction est appelée par le middleware pour chaque requête
CREATE OR REPLACE FUNCTION set_current_city(city_text TEXT, country_text TEXT DEFAULT 'FR')
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('app.current_city', city_text, false);
    PERFORM set_config('app.current_country', country_text, false);
END;
$$;

-- Fonction pour définir le mode staff
CREATE OR REPLACE FUNCTION set_staff_mode(is_staff BOOLEAN DEFAULT false)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('app.is_staff', is_staff::TEXT, false);
END;
$$;


-- ==========================================================
-- 12. MISE À JOUR DES DONNÉES EXISTANTES
-- ==========================================================

-- Note: Cette partie doit être exécutée APRES la migration des données
-- Les valeurs par défaut sont définies en fonction de la base source

-- Exemple pour Nantes (à adapter selon vos données existantes)
-- UPDATE athletes SET city = 'NANTES', country = 'FR' WHERE city IS NULL;
-- UPDATE match_history SET city = 'NANTES', country = 'FR' WHERE city IS NULL;
-- UPDATE pending_signals SET city = 'NANTES', country = 'FR' WHERE city IS NULL;
-- UPDATE tournament_results SET city = 'NANTES', country = 'FR' WHERE city IS NULL;
-- UPDATE rankings_history SET city = 'NANTES', country = 'FR' WHERE city IS NULL;
-- UPDATE as_eg_sessions SET city = 'NANTES', country = 'FR' WHERE city IS NULL;

-- ==========================================================
-- FIN DE LA MIGRATION
-- ==========================================================











SQL > time_slots :

-- Table des créneaux horaires
CREATE TABLE IF NOT EXISTS time_slots (
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

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_time_slots_date ON time_slots(date);
CREATE INDEX IF NOT EXISTS idx_time_slots_city ON time_slots(city);
CREATE INDEX IF NOT EXISTS idx_time_slots_status ON time_slots(status);
CREATE INDEX IF NOT EXISTS idx_time_slots_date_city ON time_slots(date, city);
























Option B → PASSER à l'architecture UNIFIÉE (1 GitHub + 1 Supabase)
Ce que vous devez changer :

1. GitHub : un seul repo avec arborescence par ville
bash
# Créer un seul repo: vagondys/archives
mkdir -p archives/FR/NANTES/discussions
mkdir -p archives/FR/NANTES/profils
mkdir -p archives/FR/NANTES/documents
mkdir -p archives/FR/LYON/discussions
mkdir -p archives/ES/MADRID/discussions
2. Supabase : un seul projet avec schémas
sql
-- Exécuter dans UN SEUL projet Supabase
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS staff;
CREATE SCHEMA IF NOT EXISTS registry;

-- Table public.athletes (avec city)
CREATE TABLE public.athletes (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL,
    city TEXT NOT NULL,  -- NANTES, LYON, MADRID
    country TEXT DEFAULT 'FR',
    ...
);

-- Table staff.pending_signals (avec city)
CREATE TABLE staff.pending_signals (
    id UUID PRIMARY KEY,
    city TEXT NOT NULL,
    ...
);

-- Table registry.athletes_registry
CREATE TABLE registry.athletes_registry (
    email TEXT PRIMARY KEY,
    city TEXT NOT NULL,
    country TEXT DEFAULT 'FR',
    ...
);
3. Modifier le code pour utiliser UN SEUL client
Vos fichiers unified-client.ts est déjà prêt pour ça ! Il suffit de :

Supprimer toutes les variables d'environnement spécifiques aux villes dans .env.local

Garder uniquement :

bash
# UNIQUEMENT ces variables
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet-unique.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY= votre_clé_anon
SUPABASE_SERVICE_ROLE_KEY=votre_clé_service
Utiliser createUnifiedServerClient et createUnifiedBrowserClient partout
