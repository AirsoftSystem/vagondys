
# CONTEXTE PROJET VAGONDYS

## ARCHITECTURE GÉNÉRALE

VAGONDYS est une plateforme d'airsoft avec une architecture **City-Aware décentralisée** (type "Gare de triage") :

- **MASTER** : Centralise l'authentification (Supabase Auth) et l'annuaire des athlètes (`athletes_registry`)
- **VILLES (PUBLIC)** : Chaque ville (Nantes, Lyon, Madrid, etc.) a sa propre base Supabase pour les données publiques (athlètes, matchs, etc.)
- **VILLES (STAFF)** : Chaque ville a sa propre base Supabase pour l'administration (messages, signalements, réponses)
- **GitHub** : Archives sécurisées par ville (ex: `VGD-Nantes/VAGONDYS_NANTES_DATA`)

**Technologies** : Next.js 16 (App Router), TypeScript, Supabase, Tailwind CSS, WebSocket (ESP32), Resend/Gmail SMTP.

## PROBLÈMES ACTUELS À RÉSOUDRE

### 1. Page `/staff/interface` (Unité Communication)

| Symptôme | Cause probable |
|----------|----------------|
| Chargement extrêmement lent (30s à 2min) | Appels API redondants, absence de cache, WebSocket inutile |
| Plantage au clic sur "En attente"/"Archives" | Re-rendu incohérent |
| Erreur "Dossier introuvable dans la base NANTES" | `notify-read` ne trouve pas le dossier |

### 2. Bouton "MARQUER COMME LU"

| Problème | Détail |
|----------|--------|
| Le message ne passe pas dans l'onglet "ARCHIVES" | `is_read` n'est pas mis à jour ou la vue "archived" ne rafraîchit pas |
| Erreur "Dossier introuvable" | Le `dossier_ref` existe bien en base (`VGD-5FPKM9ZC`) mais la requête échoue |

### 3. "Fil de discussion"

| Problème | Détail |
|----------|--------|
| La réponse du staff n'apparaît pas | L'API `/api/staff/history` ne retourne pas les `communication_replies` |
| L'historique est vide | Problème d'insertion ou de lecture |

### 4. Performance globale

| Problème | Détail |
|----------|--------|
| Flash au chargement du dashboard | Re-rendus multiples |
| Interface figée après certaines actions | WebSocket Realtime qui bloque |
| Temps de réponse > 10s | Appels séquentiels, pas de cache, pas de parallélisation |

---

## FICHIERS CORRIGÉS (À CONFIRMER)

### Déjà modifiés (mais pas fonctionnels) :

| Fichier | Modifications apportées |
|---------|------------------------|
| `app/api/notify-read/route.ts` | Logs, fallback email, uppercase `dossier_ref` |
| `app/api/send-reply/route.ts` | Logs, vérification `dossierRef`, `crypto.randomUUID()` |
| `app/api/staff/history/route.ts` | Logs, paramètres `city`/`country`, fallback `getStaffCity()` |
| `app/staff/page.tsx` | Simplifié, suppression `useDashboardData`, un seul appel API |
| `app/staff/interface/page.tsx` | Simplifié, suppression cache localStorage, suppression debounce |

### À vérifier / corriger :

| Fichier | Ce qu'il faut vérifier |
|---------|------------------------|
| `app/api/notify-read/route.ts` | Pourquoi le dossier n'est pas trouvé malgré les logs |
| `app/api/send-reply/route.ts` | L'insertion dans `communication_replies` réussit-elle ? |
| `app/api/staff/history/route.ts` | Pourquoi les réponses du staff ne remontent pas ? |
| `app/api/staff/pending-signals/route.ts` | Le paramètre `view=archived` fonctionne-t-il ? |

---

## DONNÉES DE TEST CONNUES

### Signal fonctionnel (à réutiliser pour les tests) :

```json
{
  "id": "8ddeb49e-28d8-48cb-8c26-14e61985a8f9",
  "dossier_ref": "VGD-5FPKM9ZC",
  "confirmed": true,
  "is_read": false,
  "payload": {
    "name": "Borne",
    "email": "borneprojet@gmail.com",
    "phone": "0776240750",
    "city": "NANTES",
    "country": "FR",
    "message": "1er Test > Staff Nantes",
    "subject": "nantes"
  }
}
```

### Bases concernées :

| Base | URL | Table clé |
|------|-----|-----------|
| MASTER | `ahkquocuzrqbtcotqesy.supabase.co` | `athletes_registry`, `email_confirmations` |
| Nantes PUBLIC | `xasyhednvkbzxfwbqnsn.supabase.co` | `athletes`, `pending_signals` |
| Nantes STAFF | `bifzylrfednqgolynnnx.supabase.co` | `pending_signals`, `communication_replies`, `game_launches` |

---

## ACTIONS IMMÉDIATES À MENER

1. **Vérifier les logs Vercel** pour identifier où la requête échoue dans `notify-read`
2. **Exécuter en SQL** sur la base STAFF de Nantes :
   ```sql
   SELECT * FROM pending_signals WHERE dossier_ref = 'VGD-5FPKM9ZC';
   SELECT * FROM communication_replies WHERE dossier_ref = 'VGD-5FPKM9ZC';
   ```
3. **Tester l'API `/api/staff/pending-signals?view=archived`** directement dans le navigateur
4. **Tester l'API `/api/staff/history?ref=VGD-5FPKM9ZC`** directement dans le navigateur
5. **Supprimer tout WebSocket Realtime** dans `useDashboardData` et `page.tsx` (interface)
6. **Ajouter un cache simple** (useRef) pour les appels API répétés

---

## OBJECTIF FINAL

- [ ] `/staff/interface` charge en moins de 3 secondes
- [ ] Le "MARQUER COMME LU" met à jour `is_read=true` et le message passe dans "ARCHIVES"
- [ ] Le "Fil de discussion" affiche TOUS les échanges (client + staff) avec horodateur
- [ ] Le dashboard `/staff` met à jour son compteur après chaque action
- [ ] Plus d'erreur "Dossier introuvable"
- [ ] Plus de plantages au clic sur les onglets

---

## CONTRAINTES

- Ne jamais coder en dur `NANTES` ou `FR` (City-Aware)
- Utiliser `createDynamicClient` pour les bases de ville
- Ne pas utiliser `localStorage` pendant le SSR (vérifier `typeof window !== 'undefined'`)
- Éviter les appels séquentiels → utiliser `Promise.all`
- Privilégier les API Routes plutôt que les connexions directes côté client

---
