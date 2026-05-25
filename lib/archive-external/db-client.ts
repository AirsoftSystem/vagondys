
import { GitHubFile, HistoryRow } from "./types";
import { createDynamicClient } from "@/lib/supabase/master";
import { createClient } from "@supabase/supabase-js";

// Propriétaire par défaut mis à jour selon .env.local (MASTER)
const DEFAULT_OWNER = "vagondys";
const BRANCH = "main";

// Client MASTER pour les opérations par défaut
export const supabaseMaster = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER!,
  process.env.SUPABASE_SERVICE_ROLE_KEY_MASTER!
);

/**
 * Helper pour construire l'URL GitHub API
 * Gère les cas "owner/repo" (ex: VGD-Nantes/repo) ou juste "repo" (utilise vagondys/)
 */
function buildGitHubUrl(repoName: string, path: string): string {
  const isScoped = repoName.includes("/");
  const fullPath = isScoped ? repoName : `${DEFAULT_OWNER}/${repoName}`;
  return `https://api.github.com/repos/${fullPath}/contents/${path}`;
}

/**
 * Client de base pour les requêtes GitHub
 */
async function ghFetch(url: string, token: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "VAGONDYS-APP",
      ...options.headers,
    },
  });
}

/**
 * Recherche récursive d'un dossier par sa référence (VGD-XXXX)
 * Reprend votre algorithme exact de recherche par cleanRef
 * ✅ AJOUT : Paramètre countryCode (non utilisé, uniquement pour logs)
 * ✅ AJOUT : Deuxième méthode de comparaison (match direct)
 */
export async function findFileInRepo(
  ref: string, 
  token: string, 
  repoName: string, 
  path: string = "archives",
  countryCode?: string
): Promise<GitHubFile | null> {
  // ✅ Un seul log non bloquant
  if (countryCode) {
    console.log(`🔍 findFileInRepo: recherche ref=${ref} dans ${repoName} (${countryCode})`);
  }
  
  const url = buildGitHubUrl(repoName, path);
  const res = await ghFetch(url, token);
  if (!res.ok) {
    console.warn(`⚠️ findFileInRepo: échec requête GitHub pour ${path}, status=${res.status}`);
    return null;
  }

  const items = (await res.json()) as GitHubFile[];
  const cleanRef = ref.replace(/-/g, "").toLowerCase();

  for (const item of items) {
    if (item.type === "dir") {
      const found = await findFileInRepo(ref, token, repoName, item.path, countryCode);
      if (found) return found;
    } else if (item.type === "file") {
      // ✅ AJOUT : Deuxième méthode de comparaison (match direct avec la référence complète)
      const itemNameClean = item.name.replace(/-/g, "").toLowerCase();
      if (itemNameClean.includes(cleanRef) || item.name.includes(ref)) {
        return item;
      }
    }
  }
  
  return null;
}

/**
 * Liste tous les fichiers .json de manière récursive
 */
export async function listAllArchiveFiles(
  token: string, 
  repoName: string, 
  path: string = "archives"
): Promise<GitHubFile[]> {
  const url = buildGitHubUrl(repoName, path);
  const res = await ghFetch(url, token);
  if (!res.ok) return [];

  const items = (await res.json()) as GitHubFile[];
  let allFiles: GitHubFile[] = [];

  for (const item of items) {
    if (item.type === "dir") {
      const subFiles = await listAllArchiveFiles(token, repoName, item.path);
      allFiles = [...allFiles, ...subFiles];
    } else if (item.name.endsWith(".json")) {
      allFiles.push(item);
    }
  }
  return allFiles;
}

/**
 * Enregistre ou met à jour un fichier sur GitHub
 */
export async function upsertFile(
  token: string,
  repoName: string,
  path: string,
  content: string,
  message: string,
  sha?: string
) {
  const contentEncoded = Buffer.from(content).toString("base64");
  const url = buildGitHubUrl(repoName, path);
  
  return ghFetch(url, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: contentEncoded,
      branch: BRANCH,
      sha
    })
  });
}

/**
 * Supprime un fichier sur GitHub
 */
export async function deleteFile(
  token: string,
  repoName: string,
  path: string,
  sha: string,
  message: string
) {
  const url = buildGitHubUrl(repoName, path);
  
  return ghFetch(url, token, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      sha,
      branch: BRANCH
    })
  });
}

// ============================================================
// ✅ AJOUT : FONCTION RECHERCHE PAR EMAIL (pour route.ts)
// ============================================================

/**
 * Recherche un signal actif par email
 * @param email - Email du client
 * @param cityCode - Code de la ville (optionnel, pour cibler une base STAFF spécifique)
 * @returns Le signal trouvé (ou null)
 */
export async function findActiveSignalByEmail(
  email: string, 
  cityCode?: string
): Promise<{ dossier_ref: string } | null> {
  console.log(`🔍 findActiveSignalByEmail: recherche pour ${email}${cityCode ? ` sur ${cityCode}` : ' (MASTER)'}`);
  
  try {
    let client;
    
    if (cityCode) {
      // Recherche dans la base STAFF de la ville spécifique
      client = await createDynamicClient(cityCode, 'FR', 'STAFF');
      console.log(`🔍 findActiveSignalByEmail: recherche dans STAFF de ${cityCode}`);
    } else {
      // Recherche dans MASTER (athletes_registry)
      client = supabaseMaster;
      console.log(`🔍 findActiveSignalByEmail: recherche dans MASTER`);
    }
    
    // Déterminer la table et la condition selon le type de client
    if (cityCode) {
      // Dans STAFF, chercher dans pending_signals
      const { data, error } = await client
        .from("pending_signals")
        .select("dossier_ref")
        .eq("payload->>email", email.toLowerCase())
        .not("dossier_ref", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error(`❌ findActiveSignalByEmail: erreur STAFF pour ${cityCode}:`, error);
        return null;
      }
      
      if (data?.dossier_ref) {
        console.log(`✅ findActiveSignalByEmail: trouvé dans STAFF ${cityCode}: ${data.dossier_ref}`);
        return { dossier_ref: data.dossier_ref };
      }
    } else {
      // Dans MASTER, chercher dans athletes_registry
      const { data, error } = await client
        .from("athletes_registry")
        .select("dossier_ref")
        .eq("email", email.toLowerCase())
        .maybeSingle();
      
      if (error) {
        console.error(`❌ findActiveSignalByEmail: erreur MASTER:`, error);
        return null;
      }
      
      if (data?.dossier_ref) {
        console.log(`✅ findActiveSignalByEmail: trouvé dans MASTER: ${data.dossier_ref}`);
        return { dossier_ref: data.dossier_ref };
      }
    }
    
    console.log(`ℹ️ findActiveSignalByEmail: aucun dossier trouvé pour ${email}`);
    return null;
    
  } catch (err) {
    console.error(`❌ findActiveSignalByEmail: exception pour ${email}:`, err);
    return null;
  }
}

// ============================================================
// ✅ AJOUT : FONCTIONS MANQUANTES POUR engine.ts
// ============================================================

/**
 * Récupère l'historique des échanges depuis la table communication_replies
 * @param ref - La référence du dossier (ex: VGD-5FPKM9ZC)
 * @param cityCode - Code de la ville (ex: NANTES)
 * @param countryCode - Code du pays (ex: FR)
 */
export async function getHistoryFromDB(
  ref: string, 
  cityCode?: string,
  countryCode: string = 'FR'
): Promise<HistoryRow[]> {
  console.log(`📜 getHistoryFromDB: recherche historique pour ${ref} sur ${cityCode || 'MASTER'}`);
  
  try {
    let client;
    
    if (cityCode) {
      client = await createDynamicClient(cityCode, countryCode, 'STAFF');
      console.log(`📜 getHistoryFromDB: client STAFF créé pour ${cityCode}/${countryCode}`);
    } else {
      client = supabaseMaster;
      console.log(`📜 getHistoryFromDB: utilisation du MASTER`);
    }
    
    const { data, error } = await client
      .from("communication_replies")
      .select("*")
      .eq("dossier_ref", ref)
      .order("created_at", { ascending: true });
    
    if (error) {
      console.error(`❌ getHistoryFromDB: erreur pour ${ref}:`, error);
      return [];
    }
    
    console.log(`✅ getHistoryFromDB: ${data?.length || 0} enregistrements trouvés pour ${ref}`);
    return (data as HistoryRow[]) || [];
    
  } catch (err) {
    console.error(`❌ getHistoryFromDB: exception pour ${ref}:`, err);
    return [];
  }
}

/**
 * Purge les données d'un dossier dans les tables actives
 * @param ref - La référence du dossier (ex: VGD-5FPKM9ZC)
 * @param cityCode - Code de la ville (ex: NANTES)
 * @param countryCode - Code du pays (ex: FR)
 */
export async function purgeDossierData(
  ref: string, 
  cityCode?: string,
  countryCode: string = 'FR'
): Promise<{ purged: boolean; error?: string }> {
  console.log(`🗑️ purgeDossierData: purge pour ${ref} sur ${cityCode || 'MASTER'} (${countryCode})`);
  
  try {
    let client;
    
    if (cityCode) {
      client = await createDynamicClient(cityCode, countryCode, 'STAFF');
      console.log(`🗑️ purgeDossierData: client STAFF créé pour ${cityCode}/${countryCode}`);
    } else {
      client = supabaseMaster;
      console.log(`🗑️ purgeDossierData: utilisation du MASTER`);
    }
    
    // Supprimer les réponses
    const { error: repliesError } = await client
      .from("communication_replies")
      .delete()
      .eq("dossier_ref", ref);
    
    if (repliesError) {
      console.error(`❌ purgeDossierData: erreur suppression replies:`, repliesError);
      return { purged: false, error: repliesError.message };
    }
    
    // Supprimer le signal
    const { error: signalsError } = await client
      .from("pending_signals")
      .delete()
      .eq("dossier_ref", ref);
    
    if (signalsError) {
      console.error(`❌ purgeDossierData: erreur suppression signals:`, signalsError);
      return { purged: false, error: signalsError.message };
    }
    
    console.log(`✅ purgeDossierData: purge réussie pour ${ref}`);
    return { purged: true };
    
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erreur inconnue";
    console.error(`❌ purgeDossierData: exception pour ${ref}:`, errorMsg);
    return { purged: false, error: errorMsg };
  }
}
