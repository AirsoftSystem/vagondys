
/*
Parfait. On repart sur une base **stable et réaliste** :

- **Supabase FREE** (500 MB) – Auth + RLS + Realtime + **données actives légères**
- **R2 (10 GB)** – Documents (PI, RIB, photos, avatars)
- **GitHub (1 GB)** – Archives compressées (anciennes parties, anciens messages)

**Objectif** : Tenir jusqu’à plusieurs milliers de joueurs sans payer.

---

# RÉANALYSE PROFONDE – CE QUI EST STOCKÉ OÙ (RÉPARTITION ACTUELLE)

## 1. ÉTAT DES LIEUX DE VOTRE CODE ACTUEL

### 1.1 Supabase – Ce qui y est réellement stocké (tables)

| Table | Rôle | Taille estimée pour 100 joueurs | Taille pour 1 000 joueurs |
|-------|------|--------------------------------|---------------------------|
| `athletes` | Profils + stats cumulées | ~0,5 MB | ~5 MB |
| `match_history` | **TOUTES les parties** | ~30 MB | ~300 MB |
| `tournament_results` | Résultats tournois | ~5 MB | ~50 MB |
| `rankings_history` | Snapshot classements | ~2 MB | ~20 MB |
| `as_eg_sessions` | Sessions notoriété | ~1 MB | ~10 MB |
| `pending_signals` | Signaux contact public | ~1 MB | ~10 MB |
| `communication_replies` | Réponses staff | ~1 MB | ~10 MB |
| `pending_messagerie_requests` | Demandes inscription | ~0,5 MB | ~5 MB |
| `messagerie_accounts` | Comptes partenaires | ~0,5 MB | ~5 MB |
| `messagerie_conversations` | Conversations | ~0,5 MB | ~5 MB |
| `messagerie_messages` | **TOUS les messages** | ~20 MB | ~200 MB |
| `admin_config` | Config | ~0,01 MB | ~0,01 MB |
| `staff_registry` | Membres staff | ~0,01 MB | ~0,01 MB |
| `global_rankings` | Classements pré-calculés | ~1 MB | ~10 MB |

**Total pour 1 000 joueurs (avec 100 parties/joueur)** : **~300-500 MB** → frôle la limite FREE (500 MB).

### 1.2 GitHub – Ce qui est archivable (et ne devrait PAS être en Supabase)

| Type de donnée | Stockage actuel | Stockage souhaité |
|----------------|----------------|-------------------|
| **Anciennes parties (> 1 mois)** | Supabase (`match_history`) | **GitHub** (GZIP) |
| **Anciens messages (> 1 mois)** | Supabase (`messagerie_messages`) | **GitHub** (GZIP) |
| **Anciens signaux traités** | Supabase (`pending_signals`) | GitHub |
| **Anciennes réponses staff** | Supabase (`communication_replies`) | GitHub |
| **Anciennes demandes messagerie** | Supabase (`pending_messagerie_requests`) | GitHub |

### 1.3 R2 – Ce qui devrait y être (documents)

| Type de document | Stockage actuel | Stockage souhaité |
|------------------|----------------|-------------------|
| Pièce d’identité (PI) | URL dans `athletes.documents_urls` | R2 |
| Justificatif domicile | URL dans `athletes.documents_urls` | R2 |
| RIB | URL dans `athletes.documents_urls` | R2 |
| Photo identité / Avatar | URL dans `athletes.documents_urls` | R2 |
| KBis (partenaires) | URL dans `pending_messagerie_requests.kbis_url` | R2 |

---

## 2. LE PROBLÈME FONDAMENTAL (IDENTIFIÉ)

| Contradiction | Explication |
|---------------|-------------|
| `match_history` contient **TOUTES** les parties (même anciennes) | → Sature Supabase rapidement |
| `messagerie_messages` contient **TOUS** les messages (même anciens) | → Sature Supabase rapidement |
| Les **archives GitHub** existent (`lib/archive-external/`) mais ne sont **pas utilisées** pour la lecture courante | → Code incohérent |

**Votre code écrit dans Supabase (via `record-match/route.ts`) mais lit depuis GitHub (via `espace-joueur/page.tsx`)** → **Incohérence totale**.

**Résultat** : Les parties s’accumulent dans Supabase, mais l’UI ne les voit pas → double consommation inutile.

---

## 3. CE QU’IL FAUT CORRIGER (SANS CODE – JUSTE LE PLAN)

### 3.1 Nettoyage immédiat (pour rester dans 500 MB)

| Action | Fichier / Table concerné | Pourquoi |
|--------|--------------------------|----------|
| **1. Purger les anciennes parties** | `match_history` (dates < 1 mois) | Libérer de l’espace |
| **2. Purger les anciens messages** | `messagerie_messages` (dates < 1 mois) | Libérer de l’espace |
| **3. Purger les signaux traités** | `pending_signals` (confirmed = true) | Libérer de l’espace |
| **4. Purger les réponses staff associées** | `communication_replies` (dossier_ref correspondant) | Libérer de l’espace |

### 3.2 Rendre le code cohérent (une seule source de vérité)

| Problème actuel | Correction |
|-----------------|------------|
| `record-match/route.ts` écrit dans Supabase | **Supprimer ce fichier** (ou le modifier pour écrire dans GitHub) |
| `espace-joueur/page.tsx` lit depuis GitHub | **Garder** (c’est l’objectif) |
| `player/matches/route.ts` écrit dans GitHub | **Garder** (mais inutilisé actuellement) |

**Donc** :

- **Arrêter d’écrire dans `match_history` (Supabase)** pour les nouvelles parties.
- **Écrire uniquement dans GitHub** via `/api/player/matches` (déjà existant).
- **Lire depuis GitHub** (déjà fait dans l’UI).

### 3.3 Mettre en place l’archivage mensuel automatique

| Étape | Description |
|-------|-------------|
| **1** | Script cron (ou GitHub Action) qui lit les parties de plus de 1 mois dans Supabase |
| **2** | Les compresse en GZIP |
| **3** | Les envoie vers GitHub (`archives/{city}/{year}/{month}/...`) |
| **4** | Les supprime de Supabase |

**Résultat** : Supabase ne contient que **1 mois de données actives** → tient dans 500 MB.

### 3.4 R2 – documents (déjà implémenté mais à vérifier)

| Vérification | Action si absent |
|--------------|------------------|
| L’upload de documents va bien dans R2 | Déjà fait (`upload-document/route.ts`) |
| Les URLs sont bien stockées dans `athletes.documents_urls` | À vérifier |
| Les documents sont accessibles en lecture | À vérifier |

---

## 4. ORDRE DE PRIORITÉ POUR LES CORRECTIONS

| # | Action | Fichiers concernés |
|---|--------|---------------------|
| **1** | **Supprimer ou commenter** l’écriture dans `match_history` pour les nouvelles parties | `record-match/route.ts` |
| **2** | **Modifier le code Python (`FrNantes1.py`)** pour appeler `/api/player/matches` au lieu de `/api/record-match` | `FrNantes1.py` |
| **3** | **Purger les anciennes données** de Supabase (manually, une fois) | `match_history`, `messagerie_messages`, etc. |
| **4** | **Mettre en place l’archivage automatique** (cron) | À créer |
| **5** | **Vérifier que l’UI lit depuis GitHub** | `espace-joueur/page.tsx` (déjà bon) |
| **6** | **Vérifier les documents R2** | `upload-document/route.ts`, `carte-id/page.tsx` |

---

## 5. RÉPONSE À VOTRE QUESTION : "QUEL(S) FICHIER(S) CORRIGER ?"

| Fichier | Action | Priorité |
|---------|--------|----------|
| `app/api/record-match/route.ts` | **Supprimer** (ou désactiver) | **1** |
| `FrNantes1.py` | **Modifier** l’appel API | **2** |
| `app/api/player/matches/route.ts` | **Vérifier** qu’il écrit bien dans GitHub | **3** (déjà bon) |
| `app/(auth)/espace-joueur/page.tsx` | **Déjà bon** (lit GitHub) | **4** (rien à faire) |
| `lib/archive-external/` | **Déjà existant** (à utiliser) | **5** |

**Rien d’autre** n’est nécessaire pour que votre projet tienne dans le cadre gratuit.

---

## 6. CE QUE VOUS DEVEZ FAIRE MAINTENANT

| Étape | Décision |
|-------|----------|
| **1** | Confirmez-vous que vous voulez **supprimer** `record-match/route.ts` (plus d’écriture Supabase) ? |
| **2** | Confirmez-vous que vous voulez **archiver automatiquement** (cron) les données de plus de 1 mois vers GitHub ? |
| **3** | Confirmez-vous que vous voulez **conserver** l’UI actuelle (qui lit GitHub) ? |

**Dès que vous confirmez ces 3 points, je vous donne les corrections exactes (code) pour chaque fichier, sans rien toucher d’autre.**
/*




/*
Félicitations. Votre système est maintenant cohérent :

Écriture : Python → /api/player/matches → GitHub

Lecture : UI → /api/player/matches → GitHub

Stockage : GitHub (parties) + R2 (documents) + Supabase FREE (auth)
*/
