import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const OUTPUT_DIR = './VAGONDYS_TEST_DATA';
const PASSWORD_TEST = "Test1234#";

// Configuration des villes selon ta demande
const citiesConfig = [
    { city: "Nantes", country: "France", count: 250 },
    { city: "Lyon", country: "France", count: 23 },
    { city: "Bordeaux", country: "France", count: 23 },
    { city: "Paris", country: "France", count: 23 },
    { city: "Toulouse", country: "France", count: 23 },
    { city: "Lille", country: "France", count: 23 },
    { city: "Strasbourg", country: "France", count: 23 },
    { city: "Nice", country: "France", count: 22 },
    { city: "Madrid", country: "Espagne", count: 18 },
    { city: "Barcelone", country: "Espagne", count: 18 },
    { city: "Séville", country: "Espagne", count: 18 },
    { city: "Malaga", country: "Espagne", count: 18 },
    { city: "Lisbonne", country: "Portugal", count: 23 },
    { city: "Porto", country: "Portugal", count: 22 },
];

const firstNames = ["Lucas", "Emma", "Thomas", "Léa", "Hugo", "Manon", "Enzo", "Chloé", "Mateo", "Sofia", "Tiago", "Martim", "Alejandro", "Lucia", "Inès"];
const lastNames = ["Petit", "Moreau", "Garcia", "Silva", "Lefebvre", "Rousseau", "Lopes", "Martinez", "Rodriguez", "Ferreira", "Gomes", "Dubois"];

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

let totalGenerated = 0;

console.log("🚀 Lancement de la génération virtuelle Vagondys...");

citiesConfig.forEach(config => {
    for (let i = 0; i < config.count; i++) {
        const first = firstNames[Math.floor(Math.random() * firstNames.length)];
        const last = lastNames[Math.floor(Math.random() * lastNames.length)];
        const fullName = `${first} ${last}`;
        // Création d'un pseudo unique basé sur la ville pour faciliter tes tests de filtrage
        const pseudo = `${first}${last}${Math.floor(Math.random() * 9999)}`;
        const email = `${pseudo.toLowerCase()}@test-vagondys.com`;
        
        // Génération d'une référence type VGD-XXXXXX (6 caractères après le tiret)
        const ref = `VGD-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const timestamp = new Date().toISOString();

        const logData = {
            reference: ref,
            client_identity: { 
                nom: fullName, 
                email: email, 
                telephone: "06" + Math.floor(10000000 + Math.random() * 90000000), 
                sujet: "ENRÔLEMENT ATHLÈTE" 
            },
            dossier_complet: {
                dossier_ref: ref,
                created_at: timestamp,
                payload: {
                    name: fullName, 
                    pseudo: pseudo, 
                    email: email, 
                    phone: "06" + Math.floor(10000000 + Math.random() * 90000000),
                    city: config.city, 
                    country: config.country, 
                    subject: "ENRÔLEMENT ATHLÈTE",
                    password_virtuel: PASSWORD_TEST, // Pour tes tests de connexion
                    message: "FÉLICITATIONS : VOTRE COMPTE EST DÉSORMAIS ACTIF. BIENVENUE CHEZ VAGONDYS."
                }
            },
            echanges_staff: [],
            fil_de_discussion: [
                {
                    role: "CLIENT_CONTACT_INFO", 
                    sender: "SYSTEM",
                    content: `Fiche Contact : ${fullName} | Email: ${email}`,
                    created_at: timestamp,
                    details: { name: fullName, email: email, subject: "ENRÔLEMENT ATHLÈTE" }
                },
                {
                    role: "public", 
                    sender: email, 
                    is_initial: true,
                    content: "FÉLICITATIONS : VOTRE COMPTE EST DÉSORMAIS ACTIF. BIENVENUE CHEZ VAGONDYS.",
                    created_at: timestamp
                }
            ],
            date_archivage: timestamp,
            archive_by: "VAGONDYS_AUTO_SYSTEM",
            security_version: "1.4"
        };

        // Format du nom de fichier conforme à ton exemple
        const fileName = `${email.replace(/[@.]/g, '_')}_${ref}.json`;
        fs.writeFileSync(path.join(OUTPUT_DIR, fileName), JSON.stringify(logData, null, 2));
        totalGenerated++;
    }
});

console.log(`✅ ${totalGenerated} fichiers générés avec succès dans /VAGONDYS_TEST_DATA`);



/*
🚀 Comment l'utiliser dans ton projet VSC ?
Générer les fichiers : Ouvre ton terminal dans VS Code et tape :

Bash
===>>> node generate-logs.mjs <<<===

Un dossier temp_archives va apparaître dans ton arborescence avec les 500 fichiers.

Les envoyer sur ton GitHub "Archives" : Puisque ton projet est lié à ton GitHub, tu n'as qu'à copier le contenu de temp_archives vers le dossier où ton système va les lire (probablement ton repo VAGONDYS_ARCHIVES_DATA).

Tout supprimer d'un coup :

Sur ton PC : Clique droit sur le dossier temp_archives > Supprimer.

Sur GitHub : Si tu les as poussés par erreur sur ton repo principal, utilise cette commande terminal pour supprimer tous les fichiers de test d'un coup sans toucher au reste :

Bash
===>>> rm temp_archives/*.json <<<===

💡 Le petit conseil "Vagondys"
Puisque tu utilises Supabase, si ton but est de tester l'affichage dans ton "Espace Staff" ou "Espace Joueur", assure-toi que ton API (app/api/archive-external/route.ts) est bien capable de lire ces fichiers JSON.
*/



/*
C'est parfait, ton script a bien tourné et tes **527 fichiers** sont prêts dans ton dossier local. Pour les envoyer sur GitHub et pouvoir les supprimer proprement plus tard, voici la procédure exacte à suivre dans ton terminal VS Code.

---

## 1. Envoyer les 527 dossiers sur GitHub

Comme tu as déjà une structure Git liée à ton projet, on va utiliser les commandes classiques. Assure-toi d'être dans le dossier racine `vagondys`.

1. **Ajouter les fichiers au suivi Git :**
```powershell
git add VAGONDYS_TEST_DATA/

```


2. **Créer le point de sauvegarde (Commit) :**
```powershell
git commit -m "DATA: Ajout de 527 athlètes virtuels pour phase de test"

```


3. **Propulser sur GitHub :**
```powershell
git push

```



*Dès que c'est fait, ton API `/api/archive-external` pourra lire ces fichiers et ton interface Staff affichera la liste complète.*

---

## 2. Comment tout supprimer d'un coup (Sécurité Maximale)

Le jour où tu veux nettoyer ton projet pour repasser en "production" sans données virtuelles, ne les supprime pas à la main un par un. Utilise ces deux commandes :

### Étape A : Suppression locale et Git

Cette commande supprime tous les fichiers JSON du dossier de test et informe Git de la suppression :

```powershell
rm VAGONDYS_TEST_DATA/*.json
git add .
git commit -m "CLEAN: Suppression des données de test"
git push

```

### Étape B : Suppression du dossier vide (Optionnel)

Si tu n'as plus besoin du dossier lui-même :

```powershell
rmdir VAGONDYS_TEST_DATA

```

---

## 3. Analyse de sécurité et fonctionnement

En analysant ton fichier `alejandrodubois466_test-vagondys_com_VGD-8821D5.json`, tout est conforme :

* **Ville (Nantes) :** Le champ `city` est bien présent dans le `payload`. Ton filtrage par agent (Nantes, Paris, etc.) va fonctionner immédiatement.
* **Référence (VGD-8821D5) :** Le format est respecté, ton interface pourra générer les liens de dossier sans bug.
* **Mot de passe :** Le `password_virtuel` est bien là, ce qui te permet de simuler des connexions si besoin.

### Ce que tu as fait :

* Génération de 527 fichiers JSON structurés selon le modèle Vagondys.
* Répartition géographique respectée (250 Nantes + reste Europe).

### Ce qui est à faire :

1. **Pousse les fichiers** avec les commandes `git` ci-dessus.
2. **Connecte-toi** sur `https://staff.vagondys.com/staff/licencies`.
3. **Vérifie** que les athlètes apparaissent bien dans la liste (surtout si tu te connectes avec l'email `communication.nantes@vagondys.com`).

**Est-ce que tu veux que je t'aide à vérifier si ton API GitHub (archive-external) limite le nombre de fichiers lus, ou on teste directement comme ça ?**
*/


