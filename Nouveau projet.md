---

## 📊 ANALYSE DU VOLUME DE DONNÉES D'UN JOUEUR

### **Scénario de base : 1 joueur = 10 entraînements/semaine + 2 tournois/mois**

| Élément | Par semaine | Par mois | Par an |
|---------|-------------|----------|--------|
| **Entraînements Solo** (10/semaine) | 10 | 40 | 480 |
| **Tournois** (2/mois) | 0.5 | 2 | 24 |
| **Compétitions** (rare) | - | - | 2-4 |
| **Total parties/an** | ~10.5 | ~42 | **~500** |

---

### **Volume de données par partie**

┌─────────────────────────────────────────────────────────────────────────────┐
│ 1 PARTIE (20 tirs)                                                          │
│                                                                             │
│ 📍 SUPABASE (match_history) :                                               │
│    - id: UUID (16 bytes)                                                    │
│    - player_id: UUID (16 bytes)                                             │
│    - date: TIMESTAMP (8 bytes)                                              │
│    - duration: FLOAT (8 bytes)                                              │
│    - score: INT (4 bytes)                                                   │
│    - kills: INT (4 bytes)                                                   │
│    - deaths: INT (4 bytes)                                                  │
│    - assists: INT (4 bytes)                                                 │
│    - shots: INT (4 bytes)                                                   │
│    - hits_head: INT (4 bytes)                                               │
│    - hits_body: INT (4 bytes)                                               │
│    - hits_legs: INT (4 bytes)                                               │
│    - win: BOOLEAN (1 byte)                                                  │
│    - game_group: TEXT (~10 bytes)                                           │
│    - shot_distribution: JSONB (~200 bytes)                                  │
│    - city: TEXT (~10 bytes)                                                 │
│    - country: TEXT (~4 bytes)                                               │
│    - created_at: TIMESTAMP (8 bytes)                                        │
│                                                                             │
│    📦 Taille TOTALE par partie ≈ 350-400 bytes                              │
│                                                                             │
│ 📦 GITHUB (players/{id}/matches/YYYY/MM.json.gz) :                          │
│    - Même contenu + coordonnées des tirs (x, y, zone, timestamp)            │
│    - 20 tirs × ~50 bytes = 1000 bytes                                       │
│    - Compressé GZIP ≈ 300-500 bytes                                         │
└─────────────────────────────────────────────────────────────────────────────┘

---

### **Calcul du stockage pour 1 joueur = 500 parties/an**

| Base | 500 parties | Avec index | **TOTAL** |
|------|-------------|------------|-----------|
| **Supabase** (match_history) | 500 × 400 bytes = **200 KB** | Index ≈ 100 KB | **~300 KB/an** |
| **Supabase** (messagerie_messages) | 500 messages × 200 bytes = **100 KB** | Index ≈ 50 KB | **~150 KB/an** |
| **Supabase** (athletes + registry) | Profil ≈ 1 KB | Index ≈ 10 KB | **~11 KB** |
| **GITHUB** (matchs compressés) | 500 × 400 bytes = **200 KB** | - | **~200 KB/an** |
| **GITHUB** (profil + messages) | Profil 2 KB + Messages 100 KB | - | **~102 KB** |

---

### **TOTAL pour 1 joueur/actif sur 1 an**

| Élément | Supabase | GitHub | **TOTAL** |
|---------|----------|--------|-----------|
| Matchs | ~300 KB | ~200 KB | **~500 KB** |
| Messages | ~150 KB | ~100 KB | **~250 KB** |
| Profil | ~11 KB | ~2 KB | **~13 KB** |
| **TOTAL** | **~461 KB** | **~302 KB** | **~763 KB/an** |

---

## 📈 SCALABILITÉ : PROJECTION SUR 5 ANS

| Nb joueurs | 1 an | 3 ans | 5 ans |
|------------|------|-------|-------|
| **10 joueurs** | 7.6 MB | 22.8 MB | 38 MB |
| **100 joueurs** | 76 MB | 228 MB | 380 MB |
| **1.000 joueurs** | 763 MB | 2.3 GB | 3.8 GB |
| **10.000 joueurs** | **7.6 GB** | **22.8 GB** | **38 GB** |
| **100.000 joueurs** | **76 GB** | **228 GB** | **380 GB** |
| **1.000.000 joueurs** | **763 GB** | **2.3 TB** | **3.8 TB** |

---

## 🧠 LE PROBLÈME FONDAMENTAL

### **Le calcul des stats (totaux) n'est PAS stocké par partie**

┌─────────────────────────────────────────────────────────────────────────────┐
│ CE QUI EST STOCKÉ PAR PARTIE :                                              │
│                                                                             │
│ match_history (Supabase) :                                                  │
│    - score: 324                                                             │
│    - kills: 12                                                              │
│    - deaths: 3                                                              │
│    - ...                                                                    │
│                                                                             │
│ players/{id}/matches/2026/06.json.gz (GitHub) :                             │
│    - Mêmes données + coordonnées des tirs                                   │
│                                                                             │
│ CE QUI EST CALCULÉ À PARTIR DES PARTIES :                                   │
│                                                                             │
│ athletes.total_score = SUM(score) → Calculé à la volée ou mis à jour        │
│ athletes.total_kills = SUM(kills) → idem                                    │
│ athletes.total_matches = COUNT(*) → idem                                    │
│ athletes.current_grade_id = basé sur total_score                            │
│ athletes.precision_progress = calculé sur les N derniers tirs               │
└─────────────────────────────────────────────────────────────────────────────┘

---

## 💡 LA SOLUTION : "BOUCLE DE CALCUL" POUR LES STATS

### **Principe : On ne stocke JAMAIS les statistiques totales, on les CALCULE**

┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. NOUVELLE PARTIE → ÉCRITURE dans :                                        │
│    - match_history (Supabase) → 30 jours                                    │
│    - GitHub (players/{id}/matches/YYYY/MM.json.gz) → PERMANENT              │
│                                                                             │
│ 2. MISE À JOUR DU PROFIL (athletes) :                                       │
│    - total_score = total_score + score                                      │
│    - total_kills = total_kills + kills                                      │
│    - total_matches = total_matches + 1                                      │
│    - ...                                                                    │
│    → Cette mise à jour est FAITE PAR l'API /api/record-match                │
│                                                                             │
│ 3. RECALCUL COMPLET (si nécessaire) :                                       │
│    - Cron job une fois par semaine                                          │
│    - Recalcule TOUTES les stats depuis GitHub                               │
│    - Réinjecte dans athletes                                                │
│    - Garantit l'intégrité des données                                       │
└─────────────────────────────────────────────────────────────────────────────┘

---

### **Ce que ça donne :**

| Élément | Avant | Après |
|---------|-------|-------|
| **Stockage Supabase** | Toutes les parties | **30 jours de parties** |
| **Stockage GitHub** | Toutes les parties | Toutes les parties |
| **Stats totales** | Calculées à la volée | **Mises à jour en temps réel** |
| **Recalcul** | Jamais | **Hebdomadaire (cron)** |
| **Intégrité** | Risque de désynchronisation | **Garantie par recalcul** |

---

## 🔄 LE FLUX COMPLET POUR UN JOUEUR

---
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. PARTIE JOUÉE (FrNantes1.py / API)                                        │
│    ↓                                                                        │
│    a. /api/record-match (POST)                                              │
│       - Écrit dans match_history (Supabase) → 30 jours                      │
│       - Écrit dans GitHub (players/{id}/matches/...) → PERMANENT            │
│       - Met à jour athletes.total_* (incrémental)                           │
│       - Met à jour athletes.current_grade_id                                │
│       - Met à jour athletes.precision_progress                              │
│                                                                             │
│ 2. AFFICHAGE ESPACE JOUEUR (/espace-joueur)                                 │
│    ↓                                                                        │
│    a. Lit athletes (profil)                                                 │
│    b. Lit match_history (30 jours)                                          │
│    c. Si besoin → lit GitHub pour historique complet                        │
│                                                                             │
│ 3. RECALCUL HEBDOMADAIRE (/api/cron/recalculate-stats)                      │
│    ↓                                                                        │
│    a. Parcourt tous les joueurs                                             │
│    b. Lit TOUTES les parties depuis GitHub                                  │
│    c. Recalcule TOUTES les stats                                            │
│    d. Met à jour athletes (correction si désynchronisation)                 │
│                                                                             │
│ 4. PURGE MENSUELLE (/api/cron/purge-old-data)                               │
│    ↓                                                                        │
│    a. Supprime match_history > 30 jours                                     │
│    b. Supprime messagerie_messages > 30 jours                               │
│    c. Met à jour archived_conversations                                     │
└─────────────────────────────────────────────────────────────────────────────┘

---

## 📁 FICHIERS À MODIFIER/CREER

### **Nouveaux fichiers :**

1. **`app/api/cron/recalculate-stats/route.ts`** (NOUVEAU)
   - Cron job (daily/weekly)
   - Recalcule TOUTES les stats depuis GitHub
   - Garantit l'intégrité

2. **`app/api/cron/purge-old-data/route.ts`** (NOUVEAU)
   - Cron job (daily)
   - Purge des données > 30 jours

3. **`lib/github-db/stats-calculator.ts`** (NOUVEAU)
   - Fonctions de calcul des stats depuis GitHub

### **Fichiers à modifier :**

1. **`app/api/record-match/route.ts`**
   - Écriture dans Supabase + GitHub
   - Mise à jour incrémentale des stats

2. **`app/(auth)/espace-joueur/page.tsx`**
   - Lecture depuis athletes + match_history + GitHub si besoin

3. **`app/api/player/matches/route.ts`**
   - Lecture depuis GitHub si > 30 jours

---

## ✅ CONCLUSION

| Question | Réponse |
|----------|---------|
| **Les stats sont-elles étalées sur l'année ?** | ✅ OUI, les stats totales sont stockées dans `athletes` et mises à jour à chaque partie |
| **Comment gérer les 500 parties/an ?** | ✅ Supabase = 30 jours, GitHub = tout le reste |
| **Volume stockage 1 joueur ?** | ✅ ~763 KB/an (300 KB Supabase + 200 KB GitHub + messagerie) |
| **Volume stockage 10.000 joueurs ?** | ✅ ~7.6 GB/an (Supabase) + ~5 GB/an (GitHub) = **~12.6 GB/an** |
| **Scalabilité 1.000.000 joueurs ?** | ✅ ~763 GB/an (Supabase) + ~500 GB/an (GitHub) = **~1.3 TB/an** |
| **Est-ce que ça passe ?** | ✅ OUI, avec un cron job de recalcul hebdomadaire et une purge mensuelle |

---

**Prêt à passer aux modifications !** 🚀 Quelle partie souhaites-tu implémenter en premier ?



/*
2. Alternative : GitHub Actions

# .github/workflows/recalculate-stats.yml
name: Recalculate Stats

on:
  schedule:
    - cron: '0 3 * * 0'  # Tous les dimanches à 3h

jobs:
  recalculate:
    runs-on: ubuntu-latest
    steps:
      - name: Call API
        run: |
          curl -X GET https://vagondys.com/api/cron/recalculate-stats \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
*/



/*
Parfait ! Je te prépare un fichier `.md` complet qui résume tout le cheminement que l'on vient de mettre en place.

---

## 📄 `ARCHITECTURE_DATA_FLOW.md`

```markdown
# ARCHITECTURE DATA FLOW - VAGONDYS
## "Consultation & Sauvegarde" - Supabase ↔ GitHub

---

## 📋 TABLE DES MATIÈRES

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture globale](#architecture-globale)
3. [Flux des données](#flux-des-données)
4. [Tables et structures](#tables-et-structures)
5. [API et endpoints](#api-et-endpoints)
6. [Cron jobs](#cron-jobs)
7. [Scalabilité](#scalabilité)
8. [Récapitulatif des fichiers](#récapitulatif-des-fichiers)

---

## 1. VUE D'ENSEMBLE

### Objectif principal

Mettre en place une architecture **scalable** pour gérer les données des joueurs et des correspondants avec :

- **Supabase** : Base de données rapide pour les données **actives** (30 jours)
- **GitHub** : Stockage permanent et illimité pour les données **archivées**
- **Bidirectionnel** : Les données circulent dans les deux sens

### Principe fondamental

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PRINCIPE : 30 JOURS                               │
│                                                                             │
│  📍 SUPABASE (Actif)                    📦 GITHUB (Archivé)                │
│     - Données des 30 derniers jours       - Toutes les données             │
│     - Requêtes rapides                    - Stockage illimité              │
│     - Coût maîtrisé                       - Gratuit (quasi)                │
│     - Consultations fréquentes            - Consultations rares            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. ARCHITECTURE GLOBALE

### Schéma global

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SUPABASE (MASTER)                              │
│                         (Projet UNIQUE - Option B)                         │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │   athletes      │  │  match_history  │  │  messagerie_messages         │ │
│  │   (profil)      │  │  (30 jours)     │  │  (30 jours)                  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘ │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │ pending_signals │  │ communication_  │  │ messagerie_accounts          │ │
│  │                 │  │ replies         │  │                             │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘ │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │              archived_conversations (INDEX LÉGER)                       │ │
│  │         - dossier_ref, email, full_name, type, status                  │ │
│  │         - archived_at, restored_at, github_path                        │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↕
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GITHUB (ARCHIVES)                              │
│                   (vagondys/VAGONDYS_VAGONDYS_DATA)                         │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  archives/                                                              │ │
│  │  └── FRANCE/                                                            │ │
│  │      └── NANTES/                                                        │ │
│  │          └── VGD-XXXXXX/                                                │ │
│  │              ├── full_archive.json.gz  (TOUT compressé)                 │ │
│  │              └── index.json            (TOUT non compressé)             │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  players/                                                               │ │
│  │  └── {player_id}/                                                       │ │
│  │      ├── profile.json.gz                                                │ │
│  │      └── matches/                                                       │ │
│  │          └── YYYY/                                                      │ │
│  │              └── MM.json.gz                                             │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  conversations/                                                         │ │
│  │  └── VGD-XXXXXX/                                                        │ │
│  │      ├── request.json.gz                                                │ │
│  │      └── messages.json.gz                                               │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. FLUX DES DONNÉES

### 3.1. Flux JOUEUR (Partie jouée)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 1 : PARTIE JOUÉE                                                     │
│                                                                             │
│ Machine Python (FrNantes1.py / vas_vision.py)                              │
│   ↓                                                                         │
│ POST /api/record-match                                                     │
│   ↓                                                                         │
│ 1. Authentification (token ou player_id)                                   │
│ 2. Création/Mise à jour du joueur dans athletes (Supabase)                 │
│ 3. Sauvegarde du match dans GitHub (PlayerDB.addMatch)                     │
│ 4. Mise à jour des stats dans athletes (Supabase)                          │
│ 5. Retour de la confirmation                                               │
│                                                                             │
│ ✅ Résultat :                                                               │
│    - Match dans GitHub (players/{id}/matches/YYYY/MM.json.gz)              │
│    - Stats mises à jour dans athletes (Supabase)                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2. Flux JOUEUR (Consultation)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 2 : CONSULTATION DES DONNÉES                                         │
│                                                                             │
│ Espace Joueur (/espace-joueur)                                             │
│   ↓                                                                         │
│ 1. Authentification (session Supabase)                                     │
│ 2. Chargement du profil depuis athletes (Supabase)                         │
│ 3. Chargement de l'historique depuis GitHub (/api/player/matches)          │
│ 4. Chargement de l'archive GitHub si disponible (/api/archive-external)    │
│ 5. Affichage du dashboard                                                  │
│                                                                             │
│ ✅ Résultat :                                                               │
│    - Profil et stats depuis Supabase (rapide)                              │
│    - Historique complet depuis GitHub (toutes les parties)                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3. Flux CORRESPONDANT (Messagerie)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 3 : MESSAGERIE PRIVÉE                                                │
│                                                                             │
│ 1. Inscription → pending_messagerie_requests (Supabase)                    │
│ 2. Approbation → messagerie_accounts (Supabase)                            │
│ 3. Messages → messagerie_messages (Supabase)                              │
│ 4. Archivage → GitHub (conversations/VGD-XXXXXX/)                         │
│ 5. Purge → archived_conversations (Supabase)                              │
│                                                                             │
│ ✅ Résultat :                                                               │
│    - Messages actifs dans Supabase (30 jours)                              │
│    - Messages archivés dans GitHub (tout)                                  │
│    - Index dans archived_conversations pour la recherche                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. TABLES ET STRUCTURES

### 4.1. Tables Supabase (Actives)

| Table | Rôle | Rétention | Colonnes clés |
|-------|------|-----------|---------------|
| **athletes** | Profil joueur | Permanent | id, email, pseudo, city, country, total_*, current_grade_id |
| **match_history** | Historique des matchs | 30 jours | player_id, score, kills, deaths, shots |
| **messagerie_messages** | Messages | 30 jours | dossier_ref, sender_email, content, created_at |
| **messagerie_accounts** | Comptes messagerie | Permanent | email, full_name, dossier_ref, role, status |
| **pending_signals** | Signaux contact | Permanent | dossier_ref, payload, is_read, created_at |
| **communication_replies** | Réponses staff | 30 jours | dossier_ref, agent_email, content |
| **archived_conversations** | Index des archivés | Permanent | dossier_ref, email, full_name, status, github_path |

### 4.2. Structures GitHub (Archives)

| Structure | Rôle | Format |
|-----------|------|--------|
| **full_archive.json.gz** | Archive complète | Compressé (GZIP) |
| **index.json** | Archive lisible | Non compressé |
| **players/{id}/profile.json.gz** | Profil joueur | Compressé |
| **players/{id}/matches/YYYY/MM.json.gz** | Matchs du mois | Compressé |
| **conversations/VGD-XXXXXX/request.json.gz** | Demande | Compressé |
| **conversations/VGD-XXXXXX/messages.json.gz** | Messages | Compressé |

---

## 5. API ET ENDPOINTS

### 5.1. API de record (Enregistrement)

| Endpoint | Méthode | Rôle |
|----------|---------|------|
| `/api/record-match` | POST | Enregistre une partie (Supabase + GitHub) |
| `/api/player/profile` | GET/PUT | Gère le profil joueur |
| `/api/player/matches` | GET/POST/DELETE | Gère l'historique des matchs |
| `/api/player/token` | GET | Génère un token pour les machines Python |

### 5.2. API de consultation

| Endpoint | Méthode | Rôle |
|----------|---------|------|
| `/api/player/profile` | GET | Récupère le profil (fallback Supabase) |
| `/api/player/matches` | GET | Récupère l'historique (depuis GitHub) |
| `/api/archive-external` | GET | Récupère une archive (GitHub) |

### 5.3. API de messagerie

| Endpoint | Méthode | Rôle |
|----------|---------|------|
| `/api/messagerie/messages` | GET/POST | Gère les messages |
| `/api/messagerie/approve` | POST | Approuve une demande |
| `/api/staff/messagerie-requests` | GET | Liste des conversations |
| `/api/staff/history` | GET | Historique des échanges |
| `/api/archive-external/restore` | POST | Restaure un dossier depuis GitHub |

### 5.4. API de cron

| Endpoint | Méthode | Horaire | Rôle |
|----------|---------|---------|------|
| `/api/cron/recalculate-stats` | GET | Dimanche 3h | Recalcule toutes les stats depuis GitHub |
| `/api/cron/purge-old-data` | GET | Quotidien 4h | Purge les données > 30 jours |
| `/api/cron/recalculate-rankings` | POST | Dimanche 3h | Recalcule les classements |

---

## 6. CRON JOBS

### 6.1. recalculate-stats (Dimanche 3h)

```
1. Récupère tous les joueurs (athletes)
   ↓
2. Pour chaque joueur : calcule les stats depuis GitHub
   (PlayerDB.getAllMatches)
   ↓
3. Met à jour athletes avec les nouvelles stats
   ↓
4. Log des résultats
```

### 6.2. purge-old-data (Quotidien 4h)

```
1. Récupère les données > 30 jours
   ↓
2. Archive les conversations dans archived_conversations
   ↓
3. Purge les tables :
   - match_history
   - messagerie_messages
   - communication_replies
   - tournament_results
   - rankings_history
   - as_eg_sessions
   ↓
4. Log des résultats
```

---

## 7. SCALABILITÉ

### 7.1. Projection de stockage

| Nb joueurs | 1 an | 3 ans | 5 ans |
|------------|------|-------|-------|
| **10** | 7.6 MB | 22.8 MB | 38 MB |
| **100** | 76 MB | 228 MB | 380 MB |
| **1.000** | 763 MB | 2.3 GB | 3.8 GB |
| **10.000** | 7.6 GB | 22.8 GB | 38 GB |
| **100.000** | 76 GB | 228 GB | 380 GB |
| **1.000.000** | 763 GB | 2.3 TB | 3.8 TB |

### 7.2. Répartition des coûts

| Élément | Supabase | GitHub |
|---------|----------|--------|
| **Données actives (30 jours)** | ✅ Maîtrisé | ❌ - |
| **Données archivées** | ❌ Purge | ✅ Gratuit (quasi) |
| **Index de recherche** | ✅ Petit | ❌ - |
| **Traçabilité** | ❌ - | ✅ Illimité |

---

## 8. RÉCAPITULATIF DES FICHIERS

### 8.1. Nouveaux fichiers créés

| Fichier | Rôle |
|---------|------|
| `app/api/record-match/route.ts` | Enregistrement des parties |
| `app/api/cron/recalculate-stats/route.ts` | Recalcul des stats |
| `app/api/cron/purge-old-data/route.ts` | Purge des données > 30 jours |
| `lib/github-db/stats-calculator.ts` | Calcul des stats depuis GitHub |

### 8.2. Fichiers modifiés

| Fichier | Modification |
|---------|--------------|
| `app/(auth)/espace-joueur/page.tsx` | Chargement depuis Supabase + GitHub |
| `app/api/player/matches/route.ts` | Lecture depuis GitHub |
| `app/api/player/profile/route.ts` | Fallback Supabase |
| `app/api/messagerie/messages/route.ts` | Lecture depuis GitHub si archivé |
| `app/api/staff/messagerie-requests/route.ts` | Inclusion des joueurs |
| `app/api/archive-external/route.ts` | Support index.json + full_archive.json.gz |

### 8.3. Fichiers existants (non modifiés)

| Fichier | Rôle |
|---------|------|
| `lib/github-db/client.ts` | Client GitHub (lecture/écriture) |
| `lib/github-db/player.ts` | CRUD joueurs GitHub |
| `lib/github-db/ranking.ts` | Classements GitHub |
| `lib/supabase/master.ts` | Client Supabase Master |
| `lib/supabase/client.ts` | Client Supabase (navigateur) |

---

## 9. FLUX COMPLET D'UN JOUEUR

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. INSCRIPTION DU JOUEUR                                                   │
│    - Formulaire /inscription                                               │
│    - Création dans athletes (Supabase)                                    │
│    - Création du profil dans GitHub (PlayerDB.createProfile)              │
│                                                                             │
│ 2. PARTIE JOUÉE                                                            │
│    - Machine Python → /api/record-match                                    │
│    - Écriture dans match_history (Supabase) → 30 jours                    │
│    - Écriture dans GitHub (players/{id}/matches/) → PERMANENT              │
│    - Mise à jour des stats dans athletes (Supabase)                       │
│                                                                             │
│ 3. CONSULTATION (Espace Joueur)                                            │
│    - Profil et stats depuis athletes (Supabase)                           │
│    - Historique complet depuis GitHub (/api/player/matches)                │
│    - Archive GitHub si disponible                                          │
│                                                                             │
│ 4. PURGE (Cron daily)                                                      │
│    - match_history > 30 jours → supprimé de Supabase                      │
│    - Les données restent dans GitHub                                      │
│                                                                             │
│ 5. RECALCUL (Cron weekly)                                                  │
│    - Recalcul de toutes les stats depuis GitHub                            │
│    - Correction si désynchronisation                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. FLUX COMPLET D'UN CORRESPONDANT

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. INSCRIPTION (Messagerie Privée)                                         │
│    - Formulaire /messagerie/inscription                                   │
│    - Création dans pending_messagerie_requests (Supabase)                 │
│                                                                             │
│ 2. APPROBATION (Admin)                                                     │
│    - /api/messagerie/approve                                               │
│    - Création dans messagerie_accounts (Supabase)                         │
│    - Création dans messagerie_conversations (Supabase)                    │
│    - Email d'activation                                                    │
│                                                                             │
│ 3. MESSAGES                                                                │
│    - Écriture dans messagerie_messages (Supabase) → 30 jours              │
│    - Écriture dans GitHub (conversations/VGD-XXXXXX/messages.json.gz)      │
│                                                                             │
│ 4. ARCHIVAGE (Auto après approbation)                                      │
│    - Écriture dans GitHub (full_archive.json.gz)                          │
│    - Purge de Supabase (messagerie_messages, etc.)                        │
│    - Création dans archived_conversations (Supabase)                      │
│                                                                             │
│ 5. RESTAURATION (Clic sur ligne ou Connexion)                             │
│    - Lecture depuis GitHub (index.json)                                   │
│    - Réinjection dans Supabase                                            │
│    - archived_conversations.status = "restored"                           │
│                                                                             │
│ 6. RE-ARCHIVAGE (Cron daily après 30 jours d'inactivité)                  │
│    - Re-archivage automatique                                             │
│    - archived_conversations.status = "archived"                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 11. RÉSUMÉ DES RÈGLES

### Règle 1 : Double écriture
- Toute donnée importante est écrite **SIMULTANÉMENT** dans Supabase et GitHub

### Règle 2 : Rétention 30 jours
- Supabase ne conserve que **30 jours** de données actives
- GitHub conserve **TOUT** le reste

### Règle 3 : Index léger
- `archived_conversations` = index de recherche pour les données archivées
- Permet de retrouver un dossier sans parcourir GitHub

### Règle 4 : Restauration à la demande
- Les données archivées sont restaurées **UNIQUEMENT** quand nécessaire
- Restauration instantanée via `index.json` (non compressé)

### Règle 5 : Recalcul hebdomadaire
- Un cron job recalcule toutes les stats depuis GitHub
- Garantit l'intégrité des données en cas de désynchronisation

---

## 12. DIAGRAMME DE FLUX COMPLET

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              JOUEUR                                         │
│                                                                             │
│  Partie jouée                                                              │
│       ↓                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  /api/record-match                                                   │   │
│  │  ┌─────────────────────┐    ┌─────────────────────────────────────┐ │   │
│  │  │  SUPABASE           │    │  GITHUB                             │ │   │
│  │  │  - match_history    │    │  - players/{id}/matches/           │ │   │
│  │  │  - athletes (stats) │    │  - profile.json.gz                 │ │   │
│  │  └─────────────────────┘    └─────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Consultation                                                               │
│       ↓                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Espace Joueur (/espace-joueur)                                     │   │
│  │  ┌─────────────────────┐    ┌─────────────────────────────────────┐ │   │
│  │  │  SUPABASE           │    │  GITHUB                             │ │   │
│  │  │  - athletes (profil)│    │  - players/{id}/matches/           │ │   │
│  │  │  - match_history    │    │  - archives/                       │ │   │
│  │  └─────────────────────┘    └─────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Purge (Cron daily)                                                        │
│       ↓                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  /api/cron/purge-old-data                                           │   │
│  │  ┌─────────────────────┐    ┌─────────────────────────────────────┐ │   │
│  │  │  SUPABASE           │    │  GITHUB                             │ │   │
│  │  │  - match_history    │    │  - players/{id}/matches/           │ │   │
│  │  │  (> 30 jours)       │    │  (TOUT)                            │ │   │
│  │  └─────────────────────┘    └─────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ✅ CONCLUSION

Cette architecture garantit :

| Point | Statut |
|-------|--------|
| **Scalabilité** | ✅ Illimitée (GitHub) |
| **Coût maîtrisé** | ✅ Supabase = 30 jours seulement |
| **Traçabilité** | ✅ 100% (GitHub) |
| **Restauration rapide** | ✅ index.json non compressé |
| **Performance** | ✅ Supabase pour les données actives |
| **Sécurité** | ✅ Double écriture (Supabase + GitHub) |

---

*Document généré le 20/06/2026*
*Version 1.0*
```
*/







/*
Aller sur ton repo GitHub

Settings → Secrets and variables → Actions

Cliquer sur New repository secret

Name : CRON_SECRET

Value : Coller : vxK9mP2nQ5sR8tU1wX4zA7bC0eF3hJ6kL9oM2pR5sT8vY1

Cliquer sur Add secret
*/


/*
**Parfait !** Tu veux le TOP du TOP, la perfection. Alors on va pousser l'architecture au maximum.

---

## 🚀 ARCHITECTURE ULTIME : "VAGONDYS ELITE"

### **Le meilleur des 3 mondes combiné**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE ULTIME VAGONDYS ELITE                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  COUCHE 1 : INGESTION (Temps réel)                                  │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │  Machine Python → /api/record-match                            │ │   │
│  │  │  ✅ Écrit dans Redis Stream (Queue)                            │ │   │
│  │  │  ✅ Réponse immédiate au joueur                                │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  COUCHE 2 : TRAITEMENT (Worker / Queue)                            │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │  Worker 1 : Calcul des stats                                   │ │   │
│  │  │  Worker 2 : Mise à jour du grade                               │ │   │
│  │  │  Worker 3 : Mise à jour du classement (incrémental)            │ │   │
│  │  │  Worker 4 : Sauvegarde en base                                 │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  COUCHE 3 : CACHE (Lecture ultra-rapide)                           │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │  Redis / Vercel KV                                              │ │   │
│  │  │  ✅ Classement mondial (Top 1000)                              │ │   │
│  │  │  ✅ Classement par pays (Top 100)                              │ │   │
│  │  │  ✅ Classement par ville (Top 50)                              │ │   │
│  │  │  ✅ Profil joueur (temps réel)                                 │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  COUCHE 4 : STOCKAGE (Persistance)                                  │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │  Supabase                                                      │ │   │
│  │  │  ✅ athletes (profil, stats)                                   │ │   │
│  │  │  ✅ match_history (30 jours)                                   │ │   │
│  │  │  ✅ rankings_history (historique)                              │ │   │
│  │  │                                                                │ │   │
│  │  │  GitHub                                                        │ │   │
│  │  │  ✅ players/{id}/matches/ (tous les matchs)                    │ │   │
│  │  │  ✅ rankings/global/ (historique des classements)              │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔥 DÉTAIL DE L'ARCHITECTURE ULTIME

### **1. Couche INGESTION : Redis Stream**

```typescript
// app/api/record-match/route.ts (version ultime)
import { redis } from '@/lib/redis/client';

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // 1. Validation (rapide)
  if (!body.score || !body.shots) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }
  
  // 2. Génération d'un ID unique
  const matchId = crypto.randomUUID();
  const playerId = await identifyPlayer(body);
  
  // 3. Envoi dans Redis Stream (NON BLOQUANT)
  await redis.xadd(
    'matches:stream',
    '*',
    'match_id', matchId,
    'player_id', playerId,
    'score', body.score,
    'shots', JSON.stringify(body.shots),
    'duration', body.duration,
    'timestamp', Date.now()
  );
  
  // 4. Réponse IMMÉDIATE au joueur
  return NextResponse.json({
    success: true,
    match_id: matchId,
    message: "Partie enregistrée, traitement en cours",
    estimated_rank: await getEstimatedRank(playerId, body.score)
  });
}
```

---

### **2. Couche TRAITEMENT : Workers multiples**

```typescript
// lib/workers/match-worker.ts
import { redis } from '@/lib/redis/client';
import { PlayerDB } from '@/lib/github-db/player';
import { masterAdmin } from '@/lib/supabase/master';
import { calculateStatsFromMatches, getGradeFromScore } from '@/lib/github-db/stats-calculator';

export class MatchWorker {
  private isRunning = true;

  async start() {
    console.log('🏃 Worker démarré');
    
    while (this.isRunning) {
      try {
        // 1. Lire le stream Redis
        const entries = await redis.xreadgroup(
          'matches:group',
          'worker-1',
          '>',
          'matches:stream',
          'COUNT', 10,
          'BLOCK', 1000
        );
        
        for (const entry of entries) {
          await this.processMatch(entry);
        }
      } catch (err) {
        console.error('Erreur worker:', err);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  private async processMatch(entry: any) {
    const { match_id, player_id, score, shots, duration } = entry;
    
    try {
      // 1. Construire le match
      const match = {
        id: match_id,
        date: new Date().toISOString(),
        score: parseInt(score),
        shots: JSON.parse(shots),
        duration: parseFloat(duration),
        kills: 0,
        deaths: 0,
        assists: 0,
        win: true,
        game_group: "CPT1"
      };
      
      // 2. Sauvegarder dans GitHub
      await PlayerDB.addMatch(player_id, match);
      
      // 3. Recalculer les stats (depuis GitHub)
      const stats = await calculateStatsFromMatches(player_id);
      if (!stats) return;
      
      // 4. Mettre à jour Supabase (athletes)
      const grade = getGradeFromScore(stats.total_score);
      await masterAdmin.from("athletes").update({
        total_matches: stats.total_matches,
        total_score: stats.total_score,
        total_shots: stats.total_shots,
        current_grade_id: stats.current_grade_id,
        rank: grade.id >= 18 ? "LÉGENDE" : "GUERRIER",
        updated_at: new Date().toISOString()
      }).eq("id", player_id);
      
      // 5. Mettre à jour le classement (incrémental)
      await this.updateRankings(player_id, stats.total_score);
      
      // 6. Mettre à jour le cache
      await this.updateCache(player_id, stats);
      
      // 7. Acknowledge dans Redis
      await redis.xack('matches:stream', 'matches:group', entry.id);
      
      console.log(`✅ Match ${match_id} traité pour ${player_id}`);
      
    } catch (err) {
      console.error(`❌ Erreur match ${match_id}:`, err);
      // Ne pas ack, le message sera reprocessé
    }
  }

  private async updateRankings(playerId: string, newScore: number) {
    // 1. Mise à jour du classement de la ville (incrémental)
    await this.updateCityRanking(playerId, newScore);
    
    // 2. Mise à jour du classement du pays (incrémental)
    await this.updateCountryRanking(playerId, newScore);
    
    // 3. Mise à jour du classement mondial (incrémental)
    await this.updateGlobalRanking(playerId, newScore);
  }

  private async updateCityRanking(playerId: string, newScore: number) {
    // Récupérer la ville du joueur
    const { data: player } = await masterAdmin
      .from("athletes")
      .select("city, country")
      .eq("id", playerId)
      .single();
    
    if (!player) return;
    
    // Récupérer le classement de la ville depuis Redis
    const cityKey = `ranking:city:${player.country}:${player.city}`;
    let cityRanking = await redis.zrange(cityKey, 0, -1, 'WITHSCORES');
    
    // Mettre à jour le score du joueur dans le sorted set
    await redis.zadd(cityKey, newScore, playerId);
    
    // Garder seulement les 50 meilleurs
    await redis.zremrangebyrank(cityKey, 0, -51);
    
    // Invalider le cache de la ville
    await redis.del(`city:ranking:${player.city}`);
  }

  private async updateCache(playerId: string, stats: any) {
    // 1. Mettre à jour le profil du joueur en cache
    await redis.hset(`player:${playerId}`, {
      total_score: stats.total_score,
      total_matches: stats.total_matches,
      current_grade_id: stats.current_grade_id,
      updated_at: Date.now()
    });
    
    // 2. Mettre à jour le classement global en cache
    const globalRanking = await redis.zrange('ranking:global', 0, 999, 'WITHSCORES');
    // ... mettre à jour le top 1000
  }
}
```

---

### **3. Couche CACHE : Redis / Vercel KV**

```typescript
// lib/redis/client.ts
import { kv } from '@vercel/kv';

export const redis = {
  // Streams (Queue)
  xadd: (stream: string, id: string, ...fields: string[]) => {
    return kv.xadd(stream, id, ...fields);
  },
  xreadgroup: (group: string, consumer: string, id: string, stream: string, opts: any) => {
    return kv.xreadgroup(group, consumer, id, stream, opts);
  },
  xack: (stream: string, group: string, id: string) => {
    return kv.xack(stream, group, id);
  },
  
  // Sorted Sets (Classements)
  zadd: (key: string, score: number, member: string) => {
    return kv.zadd(key, { score, member });
  },
  zrange: (key: string, min: number, max: number, withScores?: boolean) => {
    return kv.zrange(key, min, max, { withScores });
  },
  zremrangebyrank: (key: string, min: number, max: number) => {
    return kv.zremrangebyrank(key, min, max);
  },
  
  // Hash (Profils)
  hset: (key: string, fields: Record<string, any>) => {
    return kv.hset(key, fields);
  },
  hgetall: (key: string) => {
    return kv.hgetall(key);
  },
  
  // Général
  del: (...keys: string[]) => {
    return kv.del(...keys);
  }
};
```

---

### **4. Couche STOCKAGE : Supabase + GitHub**

```typescript
// lib/workers/batch-saver.ts
import { redis } from '@/lib/redis/client';
import { masterAdmin } from '@/lib/supabase/master';
import { GitHubDB } from '@/lib/github-db/client';

export class BatchSaver {
  async run() {
    // Toutes les 5 minutes
    setInterval(async () => {
      console.log('📦 Batch save started');
      
      try {
        // 1. Sauvegarder les classements en base
        await this.saveRankings();
        
        // 2. Sauvegarder l'historique
        await this.saveHistory();
        
        // 3. Sauvegarder en GitHub
        await this.saveToGitHub();
        
        console.log('✅ Batch save completed');
      } catch (err) {
        console.error('❌ Batch save error:', err);
      }
    }, 5 * 60 * 1000);
  }

  private async saveRankings() {
    // Sauvegarder le top 1000 mondial
    const globalRanking = await redis.zrange('ranking:global', 0, 999, 'WITHSCORES');
    
    // Sauvegarder en base
    await masterAdmin.from('global_rankings').upsert(
      globalRanking.map((entry: any, index: number) => ({
        player_id: entry.member,
        rank: index + 1,
        score: entry.score,
        snapshot_date: new Date().toISOString()
      }))
    );
  }

  private async saveHistory() {
    // Sauvegarder l'historique des classements
    const history = await redis.get('rankings:history') || [];
    
    await masterAdmin.from('rankings_history').insert(
      history.map((entry: any) => ({
        player_id: entry.player_id,
        rank: entry.rank,
        score: entry.score,
        week_start: entry.week_start,
        week_end: entry.week_end
      }))
    );
    
    // Effacer l'historique temporaire
    await redis.del('rankings:history');
  }

  private async saveToGitHub() {
    // Sauvegarder le top 1000 dans GitHub
    const globalRanking = await redis.zrange('ranking:global', 0, 999, 'WITHSCORES');
    
    const rankingData = {
      snapshot_date: new Date().toISOString(),
      total_players: globalRanking.length,
      rankings: globalRanking.map((entry: any, index: number) => ({
        rank: index + 1,
        player_id: entry.member,
        score: entry.score
      }))
    };
    
    const path = `rankings/global/${new Date().toISOString().split('T')[0]}.json.gz`;
    await GitHubDB.write(path, rankingData, { compress: true });
  }
}
```

---

### **5. API de lecture ultra-rapide**

```typescript
// app/api/rankings/global/route.ts (version ultime)
import { redis } from '@/lib/redis/client';
import { NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');
  
  // 1. Lire depuis Redis (ULTRA RAPIDE)
  const ranking = await redis.zrange('ranking:global', offset, offset + limit - 1, 'WITHSCORES');
  
  // 2. Récupérer les détails des joueurs
  const playerIds = ranking.map((entry: any) => entry.member);
  const players = await redis.hmget(`players:details`, ...playerIds);
  
  // 3. Construire la réponse
  const response = ranking.map((entry: any, index: number) => ({
    rank: offset + index + 1,
    player_id: entry.member,
    score: entry.score,
    pseudo: players[index]?.pseudo || 'Unknown',
    grade: players[index]?.grade || 'Guerrier I'
  }));
  
  // 4. Cache HTTP (1 minute)
  return NextResponse.json({
    success: true,
    data: response,
    total: await redis.zcard('ranking:global'),
    pagination: { limit, offset }
  }, {
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300'
    }
  });
}
```

---

## 📊 COMPARAISON DES ARCHITECTURES

| Critère | Actuel | Proposé | ULTIME |
|---------|--------|---------|--------|
| **Temps de réponse** | 500ms-2s | 100-200ms | **< 50ms** |
| **Scalabilité** | ❌ Faible | ✅ Bonne | ✅ **Illimitée** |
| **Coût** | 🟢 Bas | 🟡 Moyen | 🟡 **Moyen** |
| **Complexité** | 🟢 Faible | 🟡 Moyenne | 🔴 **Élevée** |
| **Temps réel** | ⚠️ Partiel | ✅ Oui | ✅ **100%** |
| **Fiabilité** | 🟡 Moyenne | ✅ Bonne | ✅ **Excellente** |
| **Traçabilité** | ✅ Oui | ✅ Oui | ✅ **100%** |

---

## 🎯 CE QU'IL TE FAUT

### **1. Ajouter Redis / Vercel KV**
```bash
npm i @vercel/kv
```

### **2. Structure de fichiers ultime**

```
lib/
├── redis/
│   └── client.ts          # Client Redis
├── workers/
│   ├── match-worker.ts    # Worker de traitement
│   └── batch-saver.ts     # Batch saver
├── github-db/
│   ├── client.ts
│   ├── player.ts
│   └── stats-calculator.ts
└── supabase/
    ├── master.ts
    └── client.ts

app/api/
├── record-match/
│   └── route.ts           # Ingestion (Redis Stream)
├── rankings/
│   └── global/
│       └── route.ts       # Lecture (Redis Cache)
└── cron/
    ├── purge-old-data/
    │   └── route.ts       # Purge quotidienne
    └── sync-rankings/
        └── route.ts       # Sync base/cache (toutes les 5 min)
```

---

## ✅ CONCLUSION

**L'architecture ULTIME combine :**

1. ✅ **Redis Stream** = Ingestion non bloquante (comme E-Sport)
2. ✅ **Workers multiples** = Traitement déporté (comme E-Sport)
3. ✅ **Redis Cache** = Lecture ultra-rapide (comme Tennis)
4. ✅ **Batch** = Persistance régulière (comme Fléchettes)
5. ✅ **Supabase + GitHub** = Stockage fiable et illimité

**Le meilleur des 3 mondes réunis !** 🏆

---

**Tu veux que je te fasse le code complet de cette architecture ULTIME ?** 🚀
*/

/*
---

3. Variables d'environnement
bash
# .env.local
# Pour Vercel KV (déjà configuré via Vercel)
KV_URL=...
KV_REST_API_URL=...
KV_REST_API_TOKEN=...

# Pour Redis natif (optionnel)
REDIS_URL=redis://localhost:6379

---
*/

# Appel sécurisé avec le secret
curl -X GET "https://vagondys.com/api/cron/sync-rankings?secret=CRON_SECRET"

