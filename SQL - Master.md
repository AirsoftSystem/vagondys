
/*
-- 1. REGISTRE CENTRAL (Annuaire)
CREATE TABLE IF NOT EXISTS public.athletes_registry (
    user_id UUID UNIQUE, -- Lien technique vers l'Auth
    email TEXT PRIMARY KEY,
    dossier_ref TEXT UNIQUE,
    city TEXT NOT NULL,
    country TEXT DEFAULT 'FRANCE',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.athletes_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture registre par email"
ON public.athletes_registry FOR SELECT
USING (auth.jwt() ->> 'email' = email);

-- 3. CONFIRMATIONS D'EMAILS
CREATE TABLE IF NOT EXISTS public.email_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Autoriser le service_role (ton serveur) à modifier les confirmations
CREATE POLICY "Admin update confirmations"
ON public.email_confirmations FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);
*/

/*
-- Ciblage de la table correcte : athletes_registry
CREATE UNIQUE INDEX IF NOT EXISTS idx_athletes_registry_dossier_ref_unique 
ON public.athletes_registry (dossier_ref);

-- Ajout de la contrainte formelle sur le registre central
ALTER TABLE public.athletes_registry 
ADD CONSTRAINT unique_registry_dossier_ref 
UNIQUE USING INDEX idx_athletes_registry_dossier_ref_unique;
*/

/*
-- Table des agents (staff)
CREATE TABLE IF NOT EXISTS public.staff_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    city TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'agent',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Activer la sécurité niveau ligne (RLS)
ALTER TABLE public.staff_registry ENABLE ROW LEVEL SECURITY;

-- Politique : seuls les appels avec service_role peuvent lire (c'est notre Server Action)
CREATE POLICY "Allow service role to read staff_registry"
    ON public.staff_registry
    FOR SELECT
    TO service_role
    USING (true);
*/

/*
INSERT INTO public.staff_registry (email, city, role) VALUES
    ('admin@vagondys.com', 'MASTER', 'admin'),
    ('vagondys@gmail.com', 'MASTER', 'superadmin'),
    ('nantes@vagondys.com', 'NANTES', 'agent'),
    ('lyon@vagondys.com', 'LYON', 'agent'),
    ('paris@vagondys.com', 'PARIS', 'agent');"
*/

/*
SELECT * FROM public.staff_registry;
*/

/*
SELECT * FROM staff_registry WHERE email = 'nantes@vagondys.com';
*/

/*
SELECT email, city, country, dossier_ref, created_at
FROM athletes_registry
ORDER BY created_at DESC
LIMIT 10;
*/
