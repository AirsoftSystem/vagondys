
Voici le **bilan final** et la **procédure complète, étape par étape**, pour mettre en place l'architecture définitive :

- **Stockage unique et complet** sur GitHub + Cloudflare R2
- **Supabase** réduit à l'Auth, la sécurité (RLS) et les classements mondiaux pré-calculés
- **Aucune limite d'historique** (depuis le premier jour jusqu'à aujourd'hui)
- **Coût mensuel < 1 $** pour 10 000 joueurs

---

# BILAN FINAL – ARCHITECTURE "GITHUB = BASE DE DONNÉES"

## Ce que vous gagnez

| Problème initial | Solution |
|------------------|----------|
| Limite de stockage Supabase (500 MB / 8 GB) | GitHub + R2 = illimité en pratique |
| Perte d'historique après archivage | Tout est disponible, tout le temps |
| Coût élevé pour 10 000 joueurs | < 1 $/mois |
| Requêtes SQL complexes | Supabase gère l'Auth et les classements (1 MB) |
| Rate limits GitHub | Cache côté serveur (Vercel / Redis) |

## Ce que vous perdez

| Fonction | Alternative |
|----------|-------------|
| Requêtes SQL sur l'historique complet | Lecture directe GitHub + cache |
| Realtime sur les parties anciennes | Pas nécessaire (données froides) |

---

# PROCÉDURE COMPLÈTE – ÉTAPE PAR ÉTAPE

## ÉTAPE 1 : PRÉPARER L'INFRASTRUCTURE GITHUB

### 1.1 Créer le repository unique

```bash
# Créer un nouveau repository privé
gh repo create VGD-Tech/VAGONDYS_DATA --private --description "Base de données complète VAGONDYS"
```

### 1.2 Structure des dossiers

```
VAGONDYS_DATA/
┣━ players/
┃  ┣━ {player_id}/
┃  ┃  ┣━ profile.json.gz
┃  ┃  ┣━ matches/
┃  ┃  ┃  ┣━ 2025/
┃  ┃  ┃  ┃  ┣━ 01.json.gz
┃  ┃  ┃  ┃  ┣━ 02.json.gz
┃  ┃  ┃  ┃  ┗━ ...
┃  ┃  ┃  ┗━ 2026/
┃  ┃  ┣━ messages.json.gz
┃  ┃  ┗━ documents/
┃  ┃     ┣━ PI_{uuid}.pdf
┃  ┃     ┣━ RIB_{uuid}.pdf
┃  ┃     ┗━ ...
┣━ tournaments/
┃  ┣━ 2025/
┃  ┃  ┣━ UMS_1.json.gz
┃  ┃  ┣━ MCS_3.json.gz
┃  ┃  ┗━ ...
┃  ┗━ 2026/
┣━ rankings/
┃  ┣━ 2025/
┃  ┃  ┣━ week_01.json.gz
┃  ┃  ┗━ ...
┃  ┗━ 2026/
┗━ global/
   ┣━ grades.json
   ┣━ config.json
   ┗━ calendar.json
```

### 1.3 Créer un token GitHub avec droits lecture/écriture

```bash
# Dans GitHub : Settings > Developer settings > Personal access tokens > Fine-grained tokens
# Permissions : Contents (read/write), Metadata (read)
# Repository : VGD-Tech/VAGONDYS_DATA
```

---

## ÉTAPE 2 : CONFIGURER CLOUDFLARE R2 (DOCUMENTS LOURDS)

### 2.1 Créer un bucket R2

```bash
# Via dashboard Cloudflare R2
# Nom du bucket : vagondys-documents
# Région : auto
```

### 2.2 Configurer les accès

```javascript
// R2 configuration
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = "vagondys-documents";
const R2_PUBLIC_URL = "https://pub-xxx.r2.dev";
```

### 2.3 Structure R2

```
vagondys-documents/
┣━ players/
┃  ┣━ {player_id}/
┃  ┃  ┣━ PI/
┃  ┃  ┃  ┗━ {uuid}.pdf
┃  ┃  ┣━ JUSTIFICATIF/
┃  ┃  ┃  ┗━ {uuid}.pdf
┃  ┃  ┣━ RIB/
┃  ┃  ┃  ┗━ {uuid}.pdf
┃  ┃  ┗━ AVATAR/
┃  ┃     ┗━ {uuid}.png
┗━ temp/
   ┗━ {session_id}_{filename}
```

---

## ÉTAPE 3 : CONFIGURER SUPABASE (MINIMAL)

### 3.1 Garder uniquement ces tables

```sql
-- Table auth.users (gérée par Supabase, ne pas toucher)

-- Table profiles (uniquement les métadonnées essentielles)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT,
  full_name TEXT,
  pseudo TEXT,
  city TEXT,
  country TEXT,
  dossier_ref TEXT UNIQUE,
  current_rank TEXT,
  total_score INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table global_rankings (pré-calculée quotidiennement)
CREATE TABLE global_rankings (
  id SERIAL PRIMARY KEY,
  player_id UUID REFERENCES profiles(id),
  rank INT,
  score INT,
  pch INT,
  snapshot_date DATE DEFAULT CURRENT_DATE
);

-- Table rls_config (pour la sécurité)
CREATE TABLE rls_config (
  id SERIAL PRIMARY KEY,
  table_name TEXT,
  policy_name TEXT,
  definition TEXT
);

-- Table session_cache (temporaire, purgée toutes les heures)
CREATE TABLE session_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES profiles(id),
  cache_key TEXT,
  cache_value JSONB,
  expires_at TIMESTAMPTZ
);
```

### 3.2 Configurer Row Level Security (RLS)

```sql
-- Un joueur ne voit que son propre profil
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Un joueur ne voit que ses propres classements
CREATE POLICY "Users can view own rankings" ON global_rankings
  FOR SELECT USING (auth.uid() = player_id);

-- Personne ne peut écrire directement dans les classements (seulement le cron job)
CREATE POLICY "Only service role can insert rankings" ON global_rankings
  FOR INSERT WITH CHECK (false);
```

### 3.3 Créer la fonction de cache (optionnel, pour performance)

```sql
CREATE OR REPLACE FUNCTION get_player_cache(p_player_id UUID)
RETURNS JSONB AS $$
DECLARE
  cached JSONB;
BEGIN
  SELECT cache_value INTO cached FROM session_cache
  WHERE player_id = p_player_id AND expires_at > NOW();
  
  RETURN cached;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## ÉTAPE 4 : CRÉER LA COUCHE D'ACCÈS DONNÉES (LIB/GITHUB-DB)

### 4.1 Créer `lib/github-db/client.ts`

```typescript
import { Octokit } from '@octokit/rest';
import pako from 'pako';

const octokit = new Octokit({ auth: process.env.GITHUB_ARCHIVE_TOKEN });
const REPO = process.env.GITHUB_ARCHIVE_REPO || 'VGD-Tech/VAGONDYS_DATA';

// Cache en mémoire (5 minutes)
const memoryCache = new Map<string, { data: any; expires: number }>();

export class GitHubDB {
  
  // === LECTURE ===
  static async read<T>(path: string, options?: { noCache?: boolean }): Promise<T | null> {
    const cacheKey = `read:${path}`;
    
    // Vérifier le cache
    if (!options?.noCache && memoryCache.has(cacheKey)) {
      const cached = memoryCache.get(cacheKey)!;
      if (cached.expires > Date.now()) {
        return cached.data as T;
      }
      memoryCache.delete(cacheKey);
    }
    
    try {
      const response = await octokit.repos.getContent({
        owner: REPO.split('/')[0],
        repo: REPO.split('/')[1],
        path,
      });
      
      const content = Buffer.from((response.data as any).content, 'base64');
      
      // Détecter si c'est du GZIP
      let data: T;
      if (path.endsWith('.gz')) {
        const decompressed = pako.ungzip(content, { to: 'string' });
        data = JSON.parse(decompressed);
      } else {
        data = JSON.parse(content.toString());
      }
      
      // Mettre en cache (5 minutes)
      memoryCache.set(cacheKey, { data, expires: Date.now() + 5 * 60 * 1000 });
      
      return data;
    } catch (error) {
      console.error(`GitHubDB.read error: ${path}`, error);
      return null;
    }
  }
  
  // === ÉCRITURE ===
  static async write<T>(path: string, data: T, options?: { compress?: boolean }): Promise<boolean> {
    let content: string;
    
    if (options?.compress) {
      const json = JSON.stringify(data);
      const compressed = pako.gzip(json);
      content = Buffer.from(compressed).toString('base64');
    } else {
      content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    }
    
    try {
      // Vérifier si le fichier existe déjà
      let sha: string | undefined;
      try {
        const existing = await octokit.repos.getContent({
          owner: REPO.split('/')[0],
          repo: REPO.split('/')[1],
          path,
        });
        sha = (existing.data as any).sha;
      } catch { /* Fichier n'existe pas */ }
      
      await octokit.repos.createOrUpdateFileContents({
        owner: REPO.split('/')[0],
        repo: REPO.split('/')[1],
        path,
        message: `Update ${path}`,
        content,
        sha,
      });
      
      // Invalider le cache
      memoryCache.delete(`read:${path}`);
      
      return true;
    } catch (error) {
      console.error(`GitHubDB.write error: ${path}`, error);
      return false;
    }
  }
  
  // === LISTER LES FICHIERS D'UN DOSSIER ===
  static async list(path: string): Promise<string[]> {
    try {
      const response = await octokit.repos.getContent({
        owner: REPO.split('/')[0],
        repo: REPO.split('/')[1],
        path,
      });
      
      const files = (response.data as any[]).map((file: any) => file.name);
      return files;
    } catch (error) {
      return [];
    }
  }
  
  // === LIRE TOUTES LES DONNÉES D'UN JOUEUR (pour export) ===
  static async readAllPlayerData(playerId: string): Promise<any> {
    const profile = await this.read(`players/${playerId}/profile.json.gz`);
    const matches = await this.read(`players/${playerId}/matches.json.gz`);
    const messages = await this.read(`players/${playerId}/messages.json.gz`);
    
    return { profile, matches, messages };
  }
}
```

### 4.2 Créer `lib/github-db/player.ts`

```typescript
import { GitHubDB } from './client';

export interface PlayerProfile {
  id: string;
  email: string;
  full_name: string;
  pseudo: string;
  city: string;
  country: string;
  dossier_ref: string;
  created_at: string;
  total_matches: number;
  total_score: number;
  total_shots: number;
  current_rank: string;
  current_grade_id: number;
}

export interface Match {
  id: string;
  date: string;
  duration: number;
  score: number;
  kills: number;
  deaths: number;
  assists: number;
  shots: Shot[];  // Tableau des 20 tirs avec coordonnées
  win: boolean;
  game_group: string;
}

export interface Shot {
  tir_number: number;
  target_id: number;
  points: number;
  bonus: number;
  x: number;      // Coordonnée relative X (-1 à 1)
  y: number;      // Coordonnée relative Y
  zone: number;   // Sous-zone (0-5 pour centrale, 0-6 pour périph)
  timestamp: number; // Temps dans la partie (ms)
}

export class PlayerDB {
  
  static async getProfile(playerId: string): Promise<PlayerProfile | null> {
    return GitHubDB.read<PlayerProfile>(`players/${playerId}/profile.json.gz`);
  }
  
  static async updateProfile(playerId: string, profile: Partial<PlayerProfile>): Promise<boolean> {
    const existing = await this.getProfile(playerId);
    const updated = { ...existing, ...profile, updated_at: new Date().toISOString() };
    return GitHubDB.write(`players/${playerId}/profile.json.gz`, updated, { compress: true });
  }
  
  static async getMatches(playerId: string, year?: number, month?: number): Promise<Match[]> {
    let path = `players/${playerId}/matches/`;
    
    if (year && month) {
      path += `${year}/${String(month).padStart(2, '0')}.json.gz`;
      const data = await GitHubDB.read<Match[]>(path);
      return data || [];
    }
    
    // Sinon, lire toutes les années/mois
    const years = await GitHubDB.list(`players/${playerId}/matches/`);
    let allMatches: Match[] = [];
    
    for (const yearDir of years) {
      const months = await GitHubDB.list(`players/${playerId}/matches/${yearDir}`);
      for (const monthFile of months) {
        const matches = await GitHubDB.read<Match[]>(
          `players/${playerId}/matches/${yearDir}/${monthFile}`
        );
        if (matches) allMatches.push(...matches);
      }
    }
    
    return allMatches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
  
  static async addMatch(playerId: string, match: Match): Promise<boolean> {
    // 1. Lire les matches du mois
    const date = new Date(match.date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const path = `players/${playerId}/matches/${year}/${String(month).padStart(2, '0')}.json.gz`;
    
    const existingMatches = await GitHubDB.read<Match[]>(path) || [];
    existingMatches.push(match);
    
    // 2. Écrire
    const success = await GitHubDB.write(path, existingMatches, { compress: true });
    
    // 3. Mettre à jour le profil (stats cumulées)
    if (success) {
      const profile = await this.getProfile(playerId);
      if (profile) {
        profile.total_matches += 1;
        profile.total_score += match.score;
        profile.total_shots += match.shots.length;
        await this.updateProfile(playerId, profile);
      }
    }
    
    return success;
  }
  
  static async getMessages(playerId: string): Promise<any[]> {
    return GitHubDB.read(`players/${playerId}/messages.json.gz`) || [];
  }
  
  static async addMessage(playerId: string, message: any): Promise<boolean> {
    const existing = await this.getMessages(playerId);
    existing.push({ ...message, created_at: new Date().toISOString() });
    return GitHubDB.write(`players/${playerId}/messages.json.gz`, existing, { compress: true });
  }
}
```

---

## ÉTAPE 5 : CRÉER LES API ROUTES

### 5.1 API de lecture des matches (`app/api/player/matches/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { PlayerDB } from '@/lib/github-db/player';

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const searchParams = req.nextUrl.searchParams;
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined;
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined;
  
  // Lecture DIRECTE depuis GitHub
  const matches = await PlayerDB.getMatches(user.id, year, month);
  
  return NextResponse.json({ matches });
}
```

### 5.2 API d'écriture d'une partie (`app/api/player/matches/route.ts` - POST)

```typescript
export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const match = await req.json();
  
  // Ajouter la partie directement dans GitHub
  const success = await PlayerDB.addMatch(user.id, match);
  
  if (!success) {
    return NextResponse.json({ error: 'Failed to save match' }, { status: 500 });
  }
  
  // Déclencher le recalcul des classements (async)
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/cron/recalculate-rankings`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` }
  }).catch(console.error);
  
  return NextResponse.json({ success: true });
}
```

### 5.3 API des classements (`app/api/rankings/global/route.ts`)

```typescript
export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  
  // Lire depuis Supabase (table pré-calculée)
  const { data: rankings } = await supabase
    .from('global_rankings')
    .select('*')
    .order('rank', { ascending: true })
    .limit(100);
  
  return NextResponse.json({ rankings });
}
```

### 5.4 Cron job pour recalculer les classements (`app/api/cron/recalculate-rankings/route.ts`)

```typescript
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const supabase = createRouteHandlerClient({ cookies });
  
  // 1. Lire TOUS les joueurs depuis GitHub
  const players = await GitHubDB.list('players/');
  const allProfiles: PlayerProfile[] = [];
  
  for (const playerId of players) {
    const profile = await PlayerDB.getProfile(playerId);
    if (profile) allProfiles.push(profile);
  }
  
  // 2. Calculer les classements
  const rankings = allProfiles
    .sort((a, b) => b.total_score - a.total_score)
    .map((player, index) => ({
      player_id: player.id,
      rank: index + 1,
      score: player.total_score,
      pch: 0, // à calculer selon AS-EG
      snapshot_date: new Date().toISOString().split('T')[0]
    }));
  
  // 3. Supprimer l'ancien classement
  await supabase.from('global_rankings').delete().neq('id', 0);
  
  // 4. Insérer le nouveau
  await supabase.from('global_rankings').insert(rankings);
  
  return NextResponse.json({ success: true, count: rankings.length });
}
```

---

## ÉTAPE 6 : MODIFIER LE FLUX DE JEU (FRNANTES1.PY)

### 6.1 Envoyer chaque tir avec coordonnées

```python
# Dans FrNantes1.py, modifier la fonction de hit
def _send_hit(self, tid: str, points: int, rx: float, ry: float, zone: int):
    """Envoie la notification de hit avec coordonnées"""
    message = f"HIT:C:{tid}|Z:{points}|X:{rx}|Y:{ry}|ZN:{zone}"
    
    # Envoyer au WebSocket (TV)
    self.logger.info(f"🎯 {message}")
    self.serial.send(message)
    
    # Stocker dans le buffer de la partie en cours
    if hasattr(self, 'current_match_shots'):
        self.current_match_shots.append({
            "tir_number": len(self.current_match_shots) + 1,
            "target_id": int(tid),
            "points": points,
            "bonus": 0,  # à calculer
            "x": rx,
            "y": ry,
            "zone": zone,
            "timestamp": time.time() - self.match_start_time
        })
```

### 6.2 À la fin de la partie, envoyer à l'API

```python
# Dans executer_une_manche(), à la fin
def executer_une_manche(nom_joueur):
    # ... code existant ...
    
    # Construire l'objet match
    match_data = {
        "id": str(uuid.uuid4()),
        "date": datetime.now().isoformat(),
        "duration": temps_total_impacts,
        "score": score_total,
        "kills": 0,  # à calculer
        "deaths": 0,
        "assists": 0,
        "shots": current_match_shots,  # Tableau des 20 tirs
        "win": False,
        "game_group": "COMPETITION"
    }
    
    # Envoyer à l'API Next.js
    requests.post(
        f"{API_URL}/api/player/matches",
        json=match_data,
        headers={"Authorization": f"Bearer {API_TOKEN}"}
    )
    
    return {"score": score_total, "temps": temps_total_impacts}
```

---

## ÉTAPE 7 : MODIFIER L'ESPACE JOUEUR (PAGE.TSX)

### 7.1 Charger l'historique depuis GitHub

```typescript
// Dans page.tsx (espace-joueur)
const loadMatchHistory = useCallback(async (userId: string, year?: number, month?: number) => {
  setLoading(true);
  
  let url = `/api/player/matches?`;
  if (year) url += `year=${year}&`;
  if (month) url += `month=${month}&`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.matches) {
    setMatchHistory(data.matches);
  }
  
  setLoading(false);
}, []);

// Pour l'historique complet (toutes années)
const loadFullHistory = useCallback(async (userId: string) => {
  setLoading(true);
  
  // Récupérer la liste des années disponibles
  const yearsResponse = await fetch(`/api/player/matches/years?playerId=${userId}`);
  const { years } = await yearsResponse.json();
  
  let allMatches: MatchRecord[] = [];
  
  for (const year of years) {
    const response = await fetch(`/api/player/matches?playerId=${userId}&year=${year}`);
    const data = await response.json();
    allMatches.push(...data.matches);
  }
  
  setMatchHistory(allMatches);
  setLoading(false);
}, []);
```

### 7.2 Ajouter un sélecteur d'année

```tsx
// Dans l'UI
<div className="flex gap-2 mb-4">
  <button 
    onClick={() => loadFullHistory(playerId)}
    className="text-[9px] font-black uppercase px-3 py-1 bg-red-600 rounded"
  >
    TOUT L'HISTORIQUE
  </button>
  <select 
    onChange={(e) => loadMatchHistory(playerId, parseInt(e.target.value))}
    className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[9px]"
  >
    <option value="">2025</option>
    <option value="">2026</option>
  </select>
</div>
```

---

## ÉTAPE 8 : AUTOMATISER LES TÂCHES (CRON JOBS)

### 8.1 Via Vercel Cron Jobs (recommandé)

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/recalculate-rankings",
      "schedule": "0 3 * * *"
    },
    {
      "path": "/api/cron/cleanup-session-cache",
      "schedule": "0 * * * *"
    }
  ]
}
```

### 8.2 Ou via GitHub Actions

```yaml
# .github/workflows/daily-rankings.yml
name: Daily Rankings
on:
  schedule:
    - cron: '0 3 * * *'
  workflow_dispatch:

jobs:
  compute:
    runs-on: ubuntu-latest
    steps:
      - run: curl -X POST https://vagondys.com/api/cron/recalculate-rankings
```

---

## ÉTAPE 9 : SURVEILLANCE ET MAINTENANCE

### 9.1 Ajouter des logs

```typescript
// lib/logger.ts
export const logger = {
  info: (message: string, meta?: any) => {
    console.log(`[INFO] ${message}`, meta);
    // Optionnel : envoyer vers un service comme BetterStack
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error);
    // Alerter sur Slack / Discord
  }
};
```

### 9.2 Métriques à surveiller

| Métrique | Où | Seuil d'alerte |
|----------|-----|----------------|
| Taux de succès des écritures GitHub | Logs | < 99% |
| Temps de réponse API | Vercel | > 500 ms |
| Taux de rate limit GitHub | GitHub API | > 80% |
| Taille du repository GitHub | GitHub | > 500 MB |

---

## RÉCAPITULATIF DES FICHIERS À CRÉER/MODIFIER

| Fichier | Action |
|---------|--------|
| `lib/github-db/client.ts` | CRÉER |
| `lib/github-db/player.ts` | CRÉER |
| `lib/github-db/tournament.ts` | CRÉER |
| `lib/github-db/ranking.ts` | CRÉER |
| `app/api/player/matches/route.ts` | CRÉER |
| `app/api/player/profile/route.ts` | CRÉER |
| `app/api/rankings/global/route.ts` | CRÉER |
| `app/api/cron/recalculate-rankings/route.ts` | CRÉER |
| `app/api/cron/cleanup-cache/route.ts` | CRÉER |
| `app/(auth)/espace-joueur/page.tsx` | MODIFIER |
| `FrNantes1.py` | MODIFIER |
| `vercel.json` | MODIFIER |

---

## CONCLUSION

| Étape | À faire |
|-------|---------|
| 1 | Créer le repository GitHub et le token |
| 2 | Configurer Cloudflare R2 |
| 3 | Réduire Supabase (auth + classements) |
| 4 | Créer la lib `github-db` |
| 5 | Créer les API routes |
| 6 | Modifier `FrNantes1.py` |
| 7 | Modifier l'espace joueur |
| 8 | Configurer les cron jobs |
| 9 | Mettre en place la surveillance |

**Vous êtes prêt. Lancez-vous.**
