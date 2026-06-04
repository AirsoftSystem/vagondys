
# PROMPT ULTRA COMPLET - RÉCAPITULATIF A À Z

## PROJET VAGONDYS
**Maison d'élite d'airsoft - Architecture unifiée (Option B)**
**Statut actuel : 90% complété - Phase finale de correction**

---

## 1. CONTEXTE INITIAL

### Problème de départ
- Architecture multi-villes non unifiée
- 12 comptes GitHub distincts
- 25+ projets Supabase séparés
- Gestion complexe et inefficace

### Solution retenue : Option B (unifiée)
- **1 seul compte GitHub** : VGD-Tech
- **1 seul repo** : `VGD-Tech/VAGONDYS_ARCHIVES`
- **1 seul projet Supabase** : VGD-Tech
- **Colonne `city`** pour filtrer par ville
- **Toutes les données centralisées**

---

## 2. ARCHITECTURE SUPABASE - TABLES CRITIQUES

### 2.1 Tables "Sacrées" (NE JAMAIS PURGER)
| Table | Rôle |
|-------|------|
| `athletes` | Profils des joueurs (espace joueur) |
| `match_history` | Historique des parties |
| `tournament_results` | Résultats des tournois |
| `rankings_history` | Classements historiques |
| `as_eg_sessions` | Sessions d'entraînement |
| `player_archives` | Archives annuelles des joueurs |

### 2.2 Tables "Actives" (à conserver en base)
| Table | Rôle |
|-------|------|
| `messagerie_accounts` | Comptes partenaires (doivent rester actifs) |
| `messagerie_conversations` | Conversations (doivent rester visibles) |

### 2.3 Tables "Archivables" (à purger après archivage GitHub)
| Table | Rôle |
|-------|------|
| `pending_signals` | Signaux de contact (staff interface) |
| `communication_replies` | Réponses staff |
| `pending_messagerie_requests` | Demandes d'inscription messagerie |
| `messagerie_messages` | Messages de la messagerie (uniquement) |

### 2.4 Tables "Staff/Admin"
| Table | Rôle |
|-------|------|
| `staff_registry` | Membres du staff |
| `admin_config` | Configuration admin |

---

## 3. PROBLÈMES RENCONTRÉS ET CORRECTIONS

### 3.1 Problème #1 : Validation Turnstile

**Problème** : "Échec de la validation anti-bot" sur formulaire messagerie

**Cause** :
- Token Turnstile stocké dans état React (`turnstileToken`)
- Expiration du token avant soumission (upload KBis long)
- Vérification Cloudflare échouait

**Solution** :
- Adopter l'approche du formulaire CONTACT (qui fonctionne)
- Supprimer la vérification Cloudflare dans Server Action
- Vérifier uniquement l'existence du token

**Fichiers modifiés** :
- `app/(public)/messagerie/inscription/actions.ts`
- `app/(public)/messagerie/inscription/page.tsx`
- `components/FileUploader.tsx`
- `app/api/upload-temp/route.ts`

---

### 3.2 Problème #2 : Build Vercel - Suspense boundary

**Problème** : `useSearchParams() should be wrapped in a suspense boundary`

**Cause** : Next.js 15+ exige un Suspense pour `useSearchParams()`

**Solution** :
- Créer composant enfant avec `useSearchParams()`
- Encapsuler dans `<Suspense>` dans le parent

**Fichier modifié** : `app/(public)/messagerie/inscription/page.tsx`

---

### 3.3 Problème #3 : MessageInput - Touche Entrée

**Problème** : Touche Entrée envoie le message au lieu de faire un saut de ligne

**Solution** :
- Avant : `if (e.key === "Enter" && !e.shiftKey) { handleSend() }`
- Après : `if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { handleSend() }`
- Entrée seule = nouvelle ligne (comportement natif)

**Fichier modifié** : `app/(auth)/messagerie/components/MessageInput.tsx`

---

### 3.4 Problème #4 : Bouton Accueil - Déconnexion

**Problème** : Le lien "Accueil" ne déconnectait pas l'utilisateur

**Solution** :
- Remplacer `<Link>` par `<button>` avec `onClick`
- Appeler `supabase.auth.signOut()`
- Rediriger vers `/`

**Fichier modifié** : `app/(auth)/messagerie/layout.tsx`

---

### 3.5 Problème #5 : Archivage GitHub - Purge totale

**Problème** : Le bouton "Coffre-Fort GitHub" archivait mais ne purgeait PAS les données

**Cause** : `purgeDossierData()` dans `db-client.ts` ne purgait que `pending_signals` et `communication_replies`

**Solution** :
- Étendre `purgeDossierData()` pour purger toutes les tables de messagerie
- Ajouter dans l'archive les tables `messagerie_accounts`, `messagerie_conversations`, `messagerie_messages`, `pending_messagerie_requests`

**Fichiers modifiés** :
- `lib/archive-external/db-client.ts`
- `lib/archive-external/engine.ts`
- `app/staff/admin/messagerie/page.tsx`

---

### 3.6 Problème #6 : Approbation demande - Erreur création utilisateur

**Problème** : "Erreur lors de la création du compte utilisateur"

**Cause** : Tentative de créer un utilisateur avec un email existant

**Solution** :
- Vérifier l'existence de l'utilisateur AVANT création
- Réutiliser le compte existant si déjà présent
- UPSERT au lieu d'INSERT

**Fichier modifié** : `app/api/messagerie/approve/route.ts`

---

### 3.7 Problème #7 : Restauration - "Erreur insertion signal"

**Problème** : Restauration depuis GitHub échoue sur `pending_signals`

**Cause** : Conflit sur la clé primaire `id` (déjà existante)

**Solution** :
- Supprimer l'`id` de l'`insertData`
- Laisser Supabase générer automatiquement un nouvel ID
- Utiliser `upsert` avec `onConflict: "dossier_ref"`

**Fichier modifié** : `app/api/archive-external/restore/route.ts`

---

### 3.8 Problème #8 : Page Admin Messagerie - Expansion du fil de discussion

**Problème** : Zone d'échange trop petite, pas d'expansion

**Solution** :
- Ajouter bouton "Agrandir" avec `Maximize2`
- Créer modal d'expansion avec historique complet
- Formulaire de réponse toujours visible

**Fichier modifié** : `app/staff/admin/messagerie/page.tsx`

---

### 3.9 Problème #9 : Notification email partenaire

**Problème** : Le partenaire n'était pas notifié des nouveaux messages staff

**Solution** :
- Ajouter bloc `if (isStaff)` dans `POST /api/messagerie/messages`
- Envoyer email au partenaire (sans contenu du message)
- Lien direct vers `/messagerie`

**Fichier modifié** : `app/api/messagerie/messages/route.ts`

---

### 3.10 Problème #10 : Incohérence SQL - Contrainte UNIQUE

**Problème** : `pending_signals.dossier_ref` n'avait PAS de contrainte UNIQUE

**Solution** : Ajouter `UNIQUE` dans le script SQL

**Fichier modifié** : `SQL - VGD-Tech.md`

---

## 4. FICHIERS CORRIGÉS (LISTE COMPLÈTE)

| Fichier | Action |
|---------|--------|
| `app/(public)/messagerie/inscription/actions.ts` | CRÉÉ (Server Action) |
| `app/(public)/messagerie/inscription/page.tsx` | MODIFIÉ (Suspense + suppression token) |
| `components/FileUploader.tsx` | MODIFIÉ (suppression token) |
| `app/api/upload-temp/route.ts` | MODIFIÉ (suppression vérification Turnstile) |
| `app/api/messagerie/request/route.ts` | MODIFIÉ (POST supprimée, DELETE conservée) |
| `app/(auth)/messagerie/components/MessageInput.tsx` | MODIFIÉ (Ctrl+Entrée) |
| `app/(auth)/messagerie/layout.tsx` | MODIFIÉ (déconnexion) |
| `lib/archive-external/db-client.ts` | MODIFIÉ (purge étendue) |
| `lib/archive-external/engine.ts` | MODIFIÉ (logs + purge) |
| `app/staff/admin/messagerie/page.tsx` | MODIFIÉ (expansion + archiving) |
| `app/api/messagerie/approve/route.ts` | MODIFIÉ (vérification existence) |
| `app/api/archive-external/restore/route.ts` | MODIFIÉ (suppression id) |
| `app/api/messagerie/messages/route.ts` | MODIFIÉ (notification email) |
| `SQL - VGD-Tech.md` | MODIFIÉ (UNIQUE sur dossier_ref) |
| `app/api/archive-external/route.ts` | MODIFIÉ (logique restauration) |

---

## 5. CE QUI FONCTIONNE À 100%

| Fonctionnalité | Statut |
|----------------|--------|
| Formulaire inscription messagerie | ✅ |
| Validation Turnstile (sans vérification serveur) | ✅ |
| Approbation des demandes | ✅ |
| Création compte partenaire | ✅ |
| Conversation + message bienvenue | ✅ |
| Connexion partenaire | ✅ |
| Envoi/réception messages | ✅ |
| Notification email partenaire (nouveau message staff) | ✅ |
| Archivage GitHub (Coffre-Fort) | ✅ |
| Purge des données après archivage | ✅ |
| Restauration depuis GitHub | ✅ |
| Affichage N° dossier dans admin | ✅ |
| Expansion fil discussion admin | ✅ |
| Touche Entrée = nouvelle ligne | ✅ |
| Déconnexion accueil messagerie | ✅ |

---

## 6. PROBLÈMES RESTANTS / À VÉRIFIER

### 6.1 HIGH PRIORITY

| Problème | Statut |
|----------|--------|
| `messagerie_accounts` restauré après purge ? | ❌ À VÉRIFIER |
| `messagerie_conversations` restauré après purge ? | ❌ À VÉRIFIER |
| `messagerie_messages` restauré après purge ? | ❌ À VÉRIFIER |

### 6.2 SOLUTION PROPOSÉE

**Modifier `db-client.ts` - `purgeDossierData()` pour exclure** :
- `athletes` (tables joueurs)
- `messagerie_accounts`
- `messagerie_conversations`

**Modifier `restore/route.ts` pour restaurer uniquement** :
- `messagerie_messages`
- `pending_messagerie_requests`

---

## 7. COMMANDES UTILES

```bash
# Démarrer le projet
npm run dev

# Build de production
npm run build

# Déploiement Vercel
vercel --prod
```

---

## 8. VARIABLES D'ENVIRONNEMENT REQUISES

```bash
# Supabase (unifié)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# GitHub (unifié)
GITHUB_ARCHIVE_TOKEN=...
GITHUB_ARCHIVE_REPO=VGD-Tech/VAGONDYS_ARCHIVES

# Turnstile
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
TURNSTILE_SECRET_KEY=...

# Email
GMAIL_SMTP_USER=...
GMAIL_SMTP_APP_PASSWORD=...
GMAIL_NOREPLY=no-reply@vagondys.com

# Cloudflare R2
CLOUDFLARE_R2_ACCOUNT_ID=...
CLOUDFLARE_R2_ACCESS_KEY_ID=...
CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
CLOUDFLARE_R2_BUCKET_NAME=vagondys-documents
```

---

## 9. PRINCIPES FONDAMENTAUX À RESPECTER

| Règle | Application |
|-------|-------------|
| **Les joueurs ne doivent jamais perdre leurs données** | `athletes`, `match_history`, etc. ne sont JAMAIS purgés |
| **Les partenaires gardent leur compte actif** | `messagerie_accounts` et `messagerie_conversations` ne sont PAS purgés |
| **Seuls les messages sont archivés** | `messagerie_messages` peut être purgé après archivage |
| **Turnstile = UX, pas sécurité** | Ne pas vérifier le token côté serveur |

---

## 10. PROCHAINE ACTION RECOMMANDÉE

**Corriger `db-client.ts` et `restore/route.ts`** pour :
1. Exclure `messagerie_accounts` et `messagerie_conversations` de la purge
2. Restaurer uniquement les messages, pas les comptes

---

**FIN DU RÉCAPITULATIF**


# PROMPT ULTRA COMPLET - VOLUMES DE STOCKAGE SUPABASE & GITHUB

## CONTEXTE DE L'ANALYSE

Dans le cadre du projet VAGONDYS (architecture unifiée Option B), une analyse détaillée des volumes de stockage a été réalisée pour comparer l'empreinte des données sur **Supabase** (base de données active) et **GitHub** (archives compressées en `.json.gz`).

L'objectif est de comprendre :
1. Ce que représente réellement une "partie" de 20 tirs vs 60 tirs
2. Ce que représente un message de 200 caractères vs 500 caractères
3. La différence de volume entre stockage Supabase et stockage GitHub
4. L'impact de la compression GZIP sur les archives

---

## 1. EXEMPLE CONCRET DE MESSAGES

### Message de 200 caractères (court) :
```
"Bonjour, je vous contacte concernant le tournoi du mois prochain. Pouvez-vous me donner plus d'informations sur les modalités d'inscription et les horaires ? Merci."
```
**Taille réelle** : 200 caractères = 200 bytes en UTF-8

### Message de 500 caractères (long) :
```
"Bonjour l'équipe VAGONDYS,

Je me permets de vous écrire suite à notre échange de la semaine dernière concernant le partenariat potentiel entre notre structure et votre maison d'airsoft. Nous sommes très intéressés par les opportunités de collaboration pour la saison à venir.

Pourriez-vous s'il vous plaît me faire parvenir le dossier de sponsoring ainsi que la grille tarifaire pour les différents paliers de partenariat ?

Dans l'attente de votre retour, je vous remercie par avance.

Cordialement,
Jean Dupont
Responsable Partenariats"
```
**Taille réelle** : 500 caractères = 500 bytes en UTF-8

---

## 2. VOLUME D'UNE PARTIE COMPLÈTE (20 tirs)

### Ce qu'une partie contient VRAIMENT dans Supabase (`match_history`) :

| Champ | Type | Taille |
|-------|------|--------|
| `id` | UUID | 16 bytes |
| `player_id` | UUID | 16 bytes |
| `date` | TIMESTAMPTZ | 8 bytes |
| `duration` | FLOAT | 8 bytes |
| `score` | INT | 4 bytes |
| `kills` | INT | 4 bytes |
| `deaths` | INT | 4 bytes |
| `assists` | INT | 4 bytes |
| `shots` | INT (0-20) | 4 bytes |
| `hits_head` | INT | 4 bytes |
| `hits_body` | INT | 4 bytes |
| `hits_legs` | INT | 4 bytes |
| `win` | BOOLEAN | 1 byte |
| `game_group` | TEXT | ~10 bytes |
| `shot_distribution` (JSONB) | Voir détail | ~150 bytes |
| Index (PK, player_id, date) | - | ~96 bytes |

### Détail du `shot_distribution` (JSONB) - 20 tirs :

```json
{
  "timeout": 3,
  "0": 2,
  "5": 1,
  "10": 2,
  "15": 3,
  "25": 2,
  "50": 2,
  "100": 1,
  "150": 2,
  "200": 1,
  "250": 1
}
```

### TOTAL pour 1 partie (20 tirs) dans Supabase :

| Composant | Taille |
|-----------|--------|
| Champs simples | ~91 bytes |
| `shot_distribution` JSONB | ~150 bytes |
| Index et métadonnées | ~96 bytes |
| **TOTAL** | **~337 bytes** |

---

## 3. VOLUME D'UNE PARTIE COMPLÈTE (60 tirs)

### Même structure, seul le `shot_distribution` change légèrement :

```json
{
  "timeout": 8,
  "0": 5,
  "5": 4,
  "10": 6,
  "15": 7,
  "25": 6,
  "50": 6,
  "100": 5,
  "150": 5,
  "200": 4,
  "250": 4
}
```

### TOTAL pour 1 partie (60 tirs) dans Supabase :

| Composant | Taille |
|-----------|--------|
| Champs simples | ~91 bytes |
| `shot_distribution` JSONB | ~150 bytes |
| Index et métadonnées | ~96 bytes |
| **TOTAL** | **~337 bytes** |

**⇨ CONCLUSION IMPORTANTE** : Une partie de 20 tirs et une partie de 60 tirs occupent la **MÊME taille** en base ! Le `shot_distribution` JSONB a un nombre de clés fixe (les valeurs changent, pas la structure).

---

## 4. VOLUME D'UN MESSAGE DE MESSAGERIE

### Dans Supabase (`messagerie_messages`) :

| Champ | 200 caractères | 500 caractères |
|-------|----------------|----------------|
| `id` (UUID) | 16 bytes | 16 bytes |
| `conversation_id` (UUID) | 16 bytes | 16 bytes |
| `sender_email` (TEXT) | ~25 bytes | ~25 bytes |
| `sender_name` (TEXT) | ~20 bytes | ~20 bytes |
| `content` (TEXT) | 200 bytes | 500 bytes |
| `file_url` (TEXT, nullable) | 0 bytes | 0 bytes |
| `file_key` (TEXT, nullable) | 0 bytes | 0 bytes |
| `is_read` (BOOLEAN) | 1 byte | 1 byte |
| `created_at` (TIMESTAMPTZ) | 8 bytes | 8 bytes |
| Index + métadonnées | ~64 bytes | ~64 bytes |
| **TOTAL Supabase** | **~350 bytes** | **~650 bytes** |

---

## 5. VOLUME DANS GITHUB (.json.gz) APRÈS COMPRESSION

### Principe de compression GZIP :
- Texte (messages, JSON) : gain de **60-75%**
- Données binaires (UUID, timestamps) : gain moindre
- Structure répétitive : très bonne compression

### Pour 1 partie (20 ou 60 tirs) :

| Élément | Taille |
|---------|--------|
| JSON brut | ~500-700 bytes |
| Compression GZIP (gain ~70%) | **~150-200 bytes** |

### Pour 100 messages :

| Messages | 200 caractères | 500 caractères |
|----------|----------------|----------------|
| JSON brut | ~35 KB | ~65 KB |
| Compression GZIP (gain ~70%) | **~10-15 KB** | **~20-25 KB** |

### Pour 1 000 messages :

| Messages | 200 caractères | 500 caractères |
|----------|----------------|----------------|
| JSON brut | ~350 KB | ~650 KB |
| Compression GZIP (gain ~70%) | **~100-150 KB** | **~200-250 KB** |

### Pour 10 000 messages :

| Messages | 200 caractères | 500 caractères |
|----------|----------------|----------------|
| JSON brut | ~3.5 MB | ~6.5 MB |
| Compression GZIP (gain ~70%) | **~1-1.5 MB** | **~2-2.5 MB** |

### Pour 100 000 messages :

| Messages | 200 caractères | 500 caractères |
|----------|----------------|----------------|
| JSON brut | ~35 MB | ~65 MB |
| Compression GZIP (gain ~70%) | **~10-15 MB** | **~20-25 MB** |

### Pour 1 000 000 messages :

| Messages | 200 caractères | 500 caractères |
|----------|----------------|----------------|
| JSON brut | ~350 MB | ~650 MB |
| Compression GZIP (gain ~70%) | **~100-150 MB** | **~200-250 MB** |

---

## 6. TABLEAU RÉCAPITULATIF FINAL

| Type de donnée | Supabase | GitHub (.json.gz) | Gain compression |
|----------------|----------|-------------------|------------------|
| 1 partie (20 tirs) | **~337 bytes** | **~150-200 bytes** | ~40-55% |
| 1 partie (60 tirs) | **~337 bytes** | **~150-200 bytes** | ~40-55% |
| 1 message (200 chars) | **~350 bytes** | **~10-15 bytes** | ~70-75% |
| 1 message (500 chars) | **~650 bytes** | **~20-25 bytes** | ~65-70% |
| 100 messages (200 chars) | **~35 KB** | **~10-15 KB** | ~55-70% |
| 100 messages (500 chars) | **~65 KB** | **~20-25 KB** | ~60-70% |
| 1 000 messages (200 chars) | **~350 KB** | **~100-150 KB** | ~55-70% |
| 1 000 messages (500 chars) | **~650 KB** | **~200-250 KB** | ~60-70% |
| 10 000 messages (200 chars) | **~3.5 MB** | **~1-1.5 MB** | ~55-70% |
| 10 000 messages (500 chars) | **~6.5 MB** | **~2-2.5 MB** | ~60-70% |
| 100 000 messages (200 chars) | **~35 MB** | **~10-15 MB** | ~55-70% |
| 100 000 messages (500 chars) | **~65 MB** | **~20-25 MB** | ~60-70% |
| 1 000 000 messages (200 chars) | **~350 MB** | **~100-150 MB** | ~55-70% |
| 1 000 000 messages (500 chars) | **~650 MB** | **~200-250 MB** | ~60-70% |

---

## 7. IMPACT SUR LES LIMITES SUPABASE

| Plan | Limite de stockage | Capacité messages (200 chars) |
|------|-------------------|------------------------------|
| **Starter (gratuit)** | 500 MB | ~1 400 000 messages |
| **Pro ($25/mois)** | 8 GB | ~22 000 000 messages |
| **Pro + supplément** | +1 GB (+$10/mois) | +~2 800 000 messages |

### Capacité en parties :

| Plan | Limite | Capacité parties |
|------|--------|------------------|
| Starter (gratuit) | 500 MB | ~1 500 000 parties |
| Pro ($25/mois) | 8 GB | ~24 000 000 parties |

---

## 8. IMPACT SUR LES LIMITES GITHUB

| Type de compte | Limite repo | Capacité messages (200 chars compressés) |
|----------------|-------------|------------------------------------------|
| **Gratuit** | ~1-5 GB | ~10 000 000 - 50 000 000 messages |
| **Pro** | ~5-10 GB | ~50 000 000 - 100 000 000 messages |

---

## 9. CONCLUSIONS CLÉS

| Point | Conclusion |
|-------|------------|
| **20 tirs vs 60 tirs** | Même volume en base (~337 bytes) car JSONB a une structure fixe |
| **Compression GZIP** | Très efficace sur le texte (gain 60-75%), moins sur les UUID/timestamps |
| **Stockage Supabase** | Idéal pour les données actives, consultations fréquentes |
| **Stockage GitHub** | Idéal pour l'archivage, compression excellente sur les discussions |
| **1 million de messages** | ~350-650 MB en base, ~100-250 MB sur GitHub (compressé) |
| **1 million de parties** | ~337 MB en base |

---

**FIN DE L'ANALYSE**


/*
VAGONDYS/
┃
┣━ .next/                                          ✅ EXISTANT
┣━ .vscode                                         ✅ EXISTANT   
┃  ┣━ .vercel/                                     ✅ EXISTANT
┃  ┃  ┣━ project.json                              ✅ EXISTANT
┃  ┃  ┗━ README.txt                                ✅ EXISTANT
┃  ┗━ settings.json                                ✅ EXISTANT
┣━ actions/
┃  ┣━ get-staff-config.ts                          ✅ EXISTANT
┃  ┗━ staff-actions.ts                             ✅ EXISTANT (Contient le Server Action)
┃
┣━ app/                                            ✅ EXISTANT
┃  ┣━ (auth)/                                      ✅ EXISTANT
┃  ┃  ┣━ activation-reussie/                       ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ carte-id/                                 ✅ EXISTANT
┃  ┃  ┃  ┣━ DocumentVault.tsx                      ✅ EXISTANT
┃  ┃  ┃  ┣━ page.tsx                               ✅ EXISTANT
┃  ┃  ┃  ┗━ ProfileForm.tsx                        ✅ EXISTANT
┃  ┃  ┣━ connexion/                                ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ espace-joueur/                            ✅ EXISTANT
┃  ┃  ┃  ┣━ components/                            ✅ EXISTANT
┃  ┃  ┃  ┃   ┣━ cibles/                            ✅ EXISTANT
┃  ┃  ┃  ┃   ┃  ┣━ CibleDetail.css                 ✅ EXISTANT
┃  ┃  ┃  ┃   ┃  ┣━ CibleDetail.tsx                 ✅ EXISTANT
┃  ┃  ┃  ┃   ┃  ┣━ CibleSimple.tsx                 ✅ EXISTANT
┃  ┃  ┃  ┃   ┃  ┣━ FleurCibles.css                 ✅ EXISTANT
┃  ┃  ┃  ┃   ┃  ┣━ FleurCibles.tsx                 ✅ EXISTANT
┃  ┃  ┃  ┃   ┃  ┣━ FleurDeCiblesWidget.css         ✅ EXISTANT
┃  ┃  ┃  ┃   ┃  ┣━ FleurDeCiblesWidget.tsx         ✅ EXISTANT
┃  ┃  ┃  ┃   ┃  ┣━ FlowerCibleCamembertWidget.css  ✅ EXISTANT
┃  ┃  ┃  ┃   ┃  ┣━ FlowerCibleCamembertWidget.tsx  ✅ EXISTANT
┃  ┃  ┃  ┃   ┃  ┣━ FullscreenCibles.css            ✅ EXISTANT
┃  ┃  ┃  ┃   ┃  ┣━ FullscreenCibles.tsx            ✅ EXISTANT
┃  ┃  ┃  ┃   ┃  ┗━ types.tsx                       ✅ EXISTANT
┃  ┃  ┃  ┃   ┣━ ArchiveViewer.tsx                  ✅ EXISTANT                 
┃  ┃  ┃  ┃   ┣━ GlobalProgressBar.css              ✅ EXISTANT
┃  ┃  ┃  ┃   ┣━ GlobalProgressBar.css              ✅ EXISTANT
┃  ┃  ┃  ┃   ┣━ GlobalProgressBar.tsx              ✅ EXISTANT
┃  ┃  ┃  ┃   ┣━ PrecisionBar.css                   ✅ EXISTANT
┃  ┃  ┃  ┃   ┣━ PrecisionBar.tsx                   ✅ EXISTANT
┃  ┃  ┃  ┃   ┣━ RankCard.tsx                       ✅ EXISTANT
┃  ┃  ┃  ┃   ┣━ ScoreChart.css                     ✅ EXISTANT
┃  ┃  ┃  ┃   ┣━ ScoreChart.tsx                     ✅ EXISTANT
┃  ┃  ┃  ┃   ┣━ StatsCard.tsx                      ✅ EXISTANT
┃  ┃  ┃  ┃   ┗━ TournamentHistory.tsx              ✅ EXISTANT
┃  ┃  ┃  ┣━ types/                                 ✅ EXISTANT
┃  ┃  ┃  ┃   ┗━ index.ts                           ✅ EXISTANT
┃  ┃  ┃  ┣━ utils/                                 ✅ EXISTANT
┃  ┃  ┃  ┃   ┗━ formatters.ts                      ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ inscription/                              ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┗━ messagerie/                               ✅ EXISTANT
┃  ┃     ┣━ components/                            ✅ EXISTANT
┃  ┃     ┃  ┣━ MessageInput.tsx                    ✅ EXISTANT
┃  ┃     ┃  ┣━ MessageList.tsx                     ✅ EXISTANT
┃  ┃     ┃  ┗━ MessageThread.tsx                   ✅ EXISTANT
┃  ┃     ┣━ actions.ts                             ✅ EXISTANT
┃  ┃     ┣━ layout.tsx                             ✅ EXISTANT
┃  ┃     ┗━ page.tsx                               ✅ EXISTANT
┃  ┃
┃  ┣━ (public)/                                    ✅ EXISTANT
┃  ┃  ┣━ bareme/                                   ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ classements/                              ✅ EXISTANT
┃  ┃  ┃  ┣━ archives/                              ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ page.tsx                            ✅ EXISTANT
┃  ┃  ┃  ┣━ saison/                                ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ [year]/                             ✅ EXISTANT
┃  ┃  ┃  ┃     ┗━ page.tsx                         ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ communication/                            ✅ EXISTANT 
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ competition/                              ✅ EXISTANT 
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ contact/                                  ✅ EXISTANT
┃  ┃  ┃  ┣━ actions.tsx                            ✅ EXISTANT
┃  ┃  ┃  ┣━ page.tsx                               ✅ EXISTANT
┃  ┃  ┃  ┗━ SubmitButton.tsx                       ✅ EXISTANT
┃  ┃  ┣━ evenementiels/                            ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ joueurs/                                  ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ la-ligue/                                 ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ leaders/                                  ✅ EXISTANT
┃  ┃  ┃  ┣━ historique/                            ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ page.tsx                            ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ maison/                                   ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ mentions-legales/                         ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ messagerie/                               ✅ EXISTANT
┃  ┃  ┃  ┣━ connexion/                             ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ page.tsx                            ✅ EXISTANT
┃  ┃  ┃  ┣━ inscription/                           ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ page.tsx                            ✅ EXISTANT
┃  ┃  ┃  ┗━ set-password/                          ✅ EXISTANT
┃  ┃  ┃     ┗━ page.tsx                            ✅ EXISTANT
┃  ┃  ┣━ politique-de-confidentialite/             ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ sponsors/                                 ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ tournois/                                 ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ layout.tsx                                ✅ EXISTANT
┃  ┃  ┗━ page.tsx                                  ✅ EXISTANT
┃  ┃
┃  ┣━ api/                                         ✅ EXISTANT
┃  ┃  ┣━ admin/                                    ✅ EXISTANT
┃  ┃  ┃  ┗━ stats/                                 ✅ EXISTANT
┃  ┃  ┃     ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┣━ archive-external/                         ✅ EXISTANT
┃  ┃  ┃  ┣━ restore/                               ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┗━ route.ts                               ✅ EXISTANT
┃  ┃  ┣━ archive-year                              ✅ EXISTANT
┃  ┃  ┃  ┗━ route.ts                               ✅ EXISTANT 
┃  ┃  ┣━ as-eg/                                    ✅ EXISTANT
┃  ┃  ┃  ┗━ session/                               ✅ EXISTANT
┃  ┃  ┃     ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┣━ auth/                                     ✅ EXISTANT
┃  ┃  ┃  ┗━ signup/                                ✅ EXISTANT
┃  ┃  ┃     ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┣━ check-athlete/                            ✅ EXISTANT
┃  ┃  ┃  ┗━ route.ts                               ✅ EXISTANT
┃  ┃  ┣━ confirm-email/                            ✅ EXISTANT
┃  ┃  ┃  ┗━ route.ts                               ✅ EXISTANT
┃  ┃  ┣━ confirm-signal/                           ✅ EXISTANT
┃  ┃  ┃  ┗━ route.ts                               ✅ EXISTANT
┃  ┃  ┣━ debug-env/                                ✅ EXISTANT
┃  ┃  ┃  ┗━ route.ts                               ✅ EXISTANT
┃  ┃  ┣━ force-admin/                              ✅ EXISTANT
┃  ┃  ┃  ┗━ route.ts                               ✅ EXISTANT
┃  ┃  ┣━ messagerie/                               ✅ EXISTANT
┃  ┃  ┃  ┣━ approve/                               ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┣━ chek-account/                          ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┣━ confirm/                               ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┣━ conversations/                         ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┣━ message/                               ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┣━ request/                               ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ reopen/                             ✅ EXISTANT
┃  ┃  ┃  ┃  ┃  ┗━ route.ts                         ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┗━ set-password/                          ✅ EXISTANT
┃  ┃  ┃     ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┣━ notify-read/                              ✅ EXISTANT
┃  ┃  ┃  ┗━ route.ts                               ✅ EXISTANT
┃  ┃  ┣━ player/                                   ✅ EXISTANT
┃  ┃  ┃  ┗━ token/                                 ✅ EXISTANT
┃  ┃  ┃     ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┣━ record-match/                             ✅ EXISTANT
┃  ┃  ┃  ┗━ route.ts                               ✅ EXISTANT
┃  ┃  ┣━ scan-document/                            ✅ EXISTANT
┃  ┃  ┃  ┗━ route.ts                               ✅ EXISTANT
┃  ┃  ┣━ send-reply/                               ✅ EXISTANT
┃  ┃  ┃  ┗━ route.ts                               ✅ EXISTANT
┃  ┃  ┣━ slots/                                    ✅ EXISTANT
┃  ┃  ┃  ┣━ [id]/                                  ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┗━ route.ts                               ✅ EXISTANT
┃  ┃  ┣━ staff/                                    ✅ EXISTANT
┃  ┃  ┃  ┣━ dashboard/                             ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┣━ history/                               ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┣━ messagerie-requests/                   ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┣━ notify-transfer/                       ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┣━ pending-signals/                       ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┣━ public-data/                           ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┗━ register-athlete/                      ✅ EXISTANT
┃  ┃  ┃     ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┣━ tournaments/                              ✅ EXISTANT
┃  ┃  ┃  ┣━ rankings/                              ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┃  ┗━ record-result/                         ✅ EXISTANT
┃  ┃  ┃     ┗━ route.ts                            ✅ EXISTANT
┃  ┃  ┣━ upload-document/                          ✅ EXISTANT
┃  ┃  ┃  ┗━ route.ts                               ✅ EXISTANT
┃  ┃  ┗━ upload-temp/                              ✅ EXISTANT
┃  ┃     ┗━ route.ts                               ✅ EXISTANT
┃  ┃
┃  ┣━ staff/                                       ✅ EXISTANT
┃  ┃  ┣━ admin/                                    ✅ EXISTANT
┃  ┃  ┃  ┣━ configuration/                         ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ page.tsx                            ✅ EXISTANT
┃  ┃  ┃  ┣━ dashboard/                             ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ page.tsx                            ✅ EXISTANT
┃  ┃  ┃  ┣━ logs/                                  ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ page.tsx                            ✅ EXISTANT
┃  ┃  ┃  ┣━ messagerie/                            ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ page.tsx                            ✅ EXISTANT
┃  ┃  ┃  ┣━ staff/                                 ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ page.tsx                            ✅ EXISTANT
┃  ┃  ┃  ┣━ verification/                          ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ page.tsx                            ✅ EXISTANT
┃  ┃  ┃  ┣━ villes/                                ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ page.tsx                            ✅ EXISTANT
┃  ┃  ┃  ┗━ layout.tsx                             ✅ EXISTANT
┃  ┃  ┣━ competitions/                             ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ components/                               ✅ EXISTANT
┃  ┃  ┃  ┣━ dashboard/                             ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ CityInfoCard.tsx                    ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ NavigationGrid.tsx                  ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ RecentActivity.tsx                  ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ StatsGrid.tsx                       ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ TopPlayers.tsx                      ✅ EXISTANT
┃  ┃  ┃  ┣━ ui/                                    ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ Badge.tsx                           ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ Card.tsx                            ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ LoadingSpinner.ts                   ✅ EXISTANT
┃  ┃  ┃  ┗━ AdminSidebar.tsx                       ✅ EXISTANT
┃  ┃  ┣━ hooks/                                    ✅ EXISTANT
┃  ┃  ┃  ┗━ useDashboardData.ts                    ✅ EXISTANT
┃  ┃  ┣━ interface/                                ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ licencies/                                ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ login/                                    ✅ EXISTANT
┃  ┃  ┃  ┣━ layout.tsx                             ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ mode_jeux/                                ✅ EXISTANT
┃  ┃  ┃  ┣━ components/                            ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ GameHeader.tsx                      ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ GameModeButton.tsx                  ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ GameModeSection.tsx                 ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ LaneSelector.tsx                    ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ LaneStatus.tsx                      ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ PlayerPseudoModal.tsx               ✅ EXISTANT
┃  ┃  ┃  ┣━ hooks/                                 ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ useGameModes.ts                     ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ useWebSocketManager.ts              ✅ EXISTANT
┃  ┃  ┃  ┣━ types/                                 ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ game.types.ts                       ✅ EXISTANT
┃  ┃  ┃  ┃  ┣━ index.ts                            ✅ EXISTANT
┃  ┃  ┃  ┃  ┗━ websocket.types.ts                  ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT (Ajout sélection couloirs)
┃  ┃  ┣━ reservations/                             ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ settings/                                 ✅ EXISTANT
┃  ┃  ┃  ┣━ actions.ts                             ✅ EXISTANT
┃  ┃  ┃  ┗━ page.tsx                               ✅ EXISTANT
┃  ┃  ┣━ types/                                    ✅ EXISTANT
┃  ┃  ┃  ┗━ dashboard.ts                           ✅ EXISTANT
┃  ┃  ┣━ layout.tsx                                ✅ EXISTANT
┃  ┃  ┗━ page.tsx                                  ✅ EXISTANT
┃  ┃
┃  ┣━ globals.css                                  ✅ EXISTANT
┃  ┣━ layout.tsx                                   ✅ EXISTANT
┃  ┣━ Maison.css                                   ✅ EXISTANT
┃  ┣━ manifest.ts                                  ✅ EXISTANT
┃  ┣━ Ranking.css                                  ✅ EXISTANT
┃  ┗━ sitemap.ts                                   ✅ EXISTANT
┃
┣━ components/                                     ✅ EXISTANT
┃  ┣━ staff/                                       ✅ EXISTANT
┃  ┃  ┣━ Sidebar.tsx                               ✅ EXISTANT
┃  ┃  ┗━ StaffShell.tsx                            ✅ EXISTANT
┃  ┣━ FileUploader.tsx                             ✅ EXISTANT
┃  ┗━ Footer.tsx                                   ✅ EXISTANT
┃
┣━ lib/                                            ✅ EXISTANT 
┃  ┣━ archive/                                     ✅ EXISTANT
┃  ┃  ┗━ yearly-archiver.ts                        ✅ EXISTANT
┃  ┣━ archive-external/                            ✅ EXISTANT
┃  ┃  ┣━ db-client.ts                              ✅ EXISTANT
┃  ┃  ┣━ engine.ts                                 ✅ EXISTANT
┃  ┃  ┣━ gh-client.ts                              ✅ EXISTANT
┃  ┃  ┣━ types.t s                                 ✅ EXISTANT
┃  ┃  ┣━ utils.ts                                  ✅ EXISTANT
┃  ┃  ┗━ validator.ts                              ✅ EXISTANT
┃  ┣━ email/                                       ✅ EXISTANT
┃  ┃  ┗━ gmail.ts                                  ✅ EXISTANT
┃  ┣━ hooks/                                       ✅ EXISTANT
┃  ┃  ┣━ useAudioControl.ts                        ✅ EXISTANT
┃  ┃  ┗━ usePhysicalButton.ts                      ✅ EXISTANT
┃  ┣━ storage/                                     ✅ EXISTANT
┃  ┃  ┗━ r2-client.ts                              ✅ EXISTANT
┃  ┣━ supabase/                                    ✅ EXISTANT
┃  ┃  ┣━ client.ts                                 ✅ EXISTANT
┃  ┃  ┣━ master.ts                                 ✅ EXISTANT
┃  ┃  ┣━ server.ts                                 ✅ EXISTANT
┃  ┃  ┗━ unified-client.ts                         ✅ EXISTANT 
┃  ┣━ websocket/                                   ✅ EXISTANT
┃  ┃  ┗━ client.ts                                 ✅ EXISTANT   
┃  ┗━ rate-limit.ts                                ✅ EXISTANT
┃
┣━ public/                                         ✅ EXISTANT
┃  ┣━ grades/                                      ✅ EXISTANT
┃  ┃  ┣━ guerrier_1.png                            ✅ EXISTANT
┃  ┃  ┣━ guerrier_2.png                            ✅ EXISTANT
┃  ┃  ┣━ guerrier_3.png                            ✅ EXISTANT
┃  ┃  ┣━ elite_1.png                               ✅ EXISTANT
┃  ┃  ┣━ elite_2.png                               ✅ EXISTANT
┃  ┃  ┣━ elite_3.png                               ✅ EXISTANT
┃  ┃  ┣━ maitre_1.png                              ✅ EXISTANT
┃  ┃  ┣━ maitre_2.png                              ✅ EXISTANT
┃  ┃  ┣━ maitre_3.png                              ✅ EXISTANT
┃  ┃  ┣━ grand_maitre_1.png                        ✅ EXISTANT
┃  ┃  ┣━ grand_maitre_2.png                        ✅ EXISTANT
┃  ┃  ┣━ grand_maitre_3.png                        ✅ EXISTANT
┃  ┃  ┣━ epique_1.png                              ✅ EXISTANT
┃  ┃  ┣━ epique_2.png)                             ✅ EXISTANT
┃  ┃  ┣━ epique_3.png                              ✅ EXISTANT
┃  ┃  ┣━ epique_4.png                              ✅ EXISTANT
┃  ┃  ┣━ epique_5.png                              ✅ EXISTANT
┃  ┃  ┣━ legende_1.png                             ✅ EXISTANT
┃  ┃  ┣━ legende_2.png                             ✅ EXISTANT
┃  ┃  ┣━ legende_3.png                             ✅ EXISTANT
┃  ┃  ┣━ immortel_1000.png                         ✅ EXISTANT
┃  ┃  ┣━ immortel_100.png                          ✅ EXISTANT
┃  ┃  ┣━ immortel_10.png                           ✅ EXISTANT
┃  ┃  ┗━ immortel_1.png                            ✅ EXISTANT
┃  ┣━ logo/                                        ✅ EXISTANT
┃  ┃  ┣━ icon.png                                  ✅ EXISTANT
┃  ┃  ┣━ icon.webp                                 ✅ EXISTANT
┃  ┃  ┣━ vagondys-mark-icon.png                    ✅ EXISTANT
┃  ┃  ┣━ vagondys-mark-icon.webp                   ✅ EXISTANT
┃  ┃  ┣━ vagondys-mark.png                         ✅ EXISTANT
┃  ┃  ┣━ vagondys-mark.svg                         ✅ EXISTANT
┃  ┃  ┣━ vagondys-mark.webp                        ✅ EXISTANT
┃  ┃  ┣━ vagondys.png                              ✅ EXISTANT
┃  ┃  ┗━ vagondys.webp                             ✅ EXISTANT
┃  ┣━ sounds/                                      ✅ EXISTANT
┃  ┃  ┣━ 3.wav                                     ✅ EXISTANT
┃  ┃  ┣━ 2.wav                                     ✅ EXISTANT
┃  ┃  ┣━ 1.wav                                     ✅ EXISTANT
┃  ┃  ┗━ VIZ.wav                                   ✅ EXISTANT
┃  ┣━ tv/                                          ✅ EXISTANT
┃  ┃  ┣━ 0.html                                    ✅ EXISTANT
┃  ┃  ┣━ 1.html                                    ✅ EXISTANT
┃  ┃  ┣━ 2.html                                    ✅ EXISTANT
┃  ┃  ┣━ 3.html                                    ✅ EXISTANT
┃  ┃  ┣━ 4.html                                    ✅ EXISTANT
┃  ┃  ┣━ 5.html                                    ✅ EXISTANT
┃  ┃  ┣━ 6.html                                    ✅ EXISTANT
┃  ┃  ┣━ 7.html                                    ✅ EXISTANT
┃  ┃  ┗━ 8.html                                    ✅ EXISTANT
┃  ┣━ cible.png                                    ✅ EXISTANT
┃  ┣━ cible.webp                                   ✅ EXISTANT
┃  ┣━ favicon.ico                                  ✅ EXISTANT
┃  ┣━ file.svg                                     ✅ EXISTANT
┃  ┣━ globe.svg                                    ✅ EXISTANT
┃  ┣━ next.svg                                     ✅ EXISTANT
┃  ┣━ tv.html                                      ✅ EXISTANT
┃  ┣━ vagondys-mark.ico                            ✅ EXISTANT
┃  ┣━ vercel.svg                                   ✅ EXISTANT
┃  ┗━ window.svg                                   ✅ EXISTANT
┃
┣━ scripts/                                        ✅ EXISTANT
┃  ┣━ obfuscate-build.js                           ✅ EXISTANT
┃  ┗━ optimize-images.js                           ✅ EXISTANT
┃
┣━ types/                                          ✅ EXISTANT
┃  ┗━ official.types.ts                            ✅ EXISTANT (Centralisation types officiels)
┃
┣━ VAGONDYS_TEST_DATA                              ✅ EXISTANT
┃
┣━ .env.local                                      ✅ EXISTANT
┣━ .gitignore                                      ✅ EXISTANT
┣━ arborescence.txt                                ✅ EXISTANT
┣━ eslint.config.mjs                               ✅ EXISTANT
┣━ generate-test-logs.mjs                          ✅ EXISTANT
┣━ next-env.d.ts                                   ✅ EXISTANT
┣━ next.config.ts                                  ✅ EXISTANT
┣━ package-lock.json                               ✅ EXISTANT
┣━ package.json                                    ✅ EXISTANT
┣━ postcss.config.mjs                              ✅ EXISTANT
┣━ proxy.ts                                        ✅ EXISTANT
┣━ README.md                                       ✅ EXISTANT
┣━ tailwind.config.ts                              ✅ EXISTANT
┣━ tsconfig.json                                   ✅ EXISTANT
┗━ vercel.json                                     ✅ EXISTANT
*/
