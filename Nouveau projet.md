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
