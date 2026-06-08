
import { GitHubFile, HistoryRow } from "./types";
import { createClient } from "@supabase/supabase-js";

// Propriétaire par défaut mis à jour selon .env.local (MASTER)
const DEFAULT_OWNER = "vagondys";
const BRANCH = "main";

// ✅ Option B : Client UNIQUE pour les opérations par défaut
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseMaster = (supabaseUrl && supabaseServiceKey) 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

if (!supabaseMaster) {
  console.warn("⚠️ db-client.ts: Supabase client non initialisé (variables manquantes)");
}

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
      // ✅ Deuxième méthode de comparaison (match direct avec la référence complète)
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
// ✅ FONCTION RECHERCHE PAR EMAIL (pour route.ts)
// Version adaptée pour l'Option B (un seul projet Supabase)
// ============================================================

/**
 * Recherche un signal actif par email
 * @param email - Email du client
 * @param cityCode - Code de la ville (optionnel, pour filtrer)
 * @returns Le signal trouvé (ou null)
 */
export async function findActiveSignalByEmail(
  email: string, 
  cityCode?: string
): Promise<{ dossier_ref: string } | null> {
  console.log(`🔍 findActiveSignalByEmail: recherche pour ${email}${cityCode ? ` sur ${cityCode}` : ' (toutes villes)'}`);
  
  if (!supabaseMaster) {
    console.error("❌ findActiveSignalByEmail: supabaseMaster non initialisé");
    return null;
  }
  
  try {
    // ✅ Option B : Recherche directe dans pending_signals (avec filtre city optionnel)
    let query = supabaseMaster
      .from("pending_signals")
      .select("dossier_ref")
      .eq("payload->>email", email.toLowerCase())
      .not("dossier_ref", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);
    
    // Ajouter le filtre city si fourni
    if (cityCode) {
      query = query.eq("city", cityCode.toUpperCase());
      console.log(`🔍 findActiveSignalByEmail: recherche avec filtre city=${cityCode}`);
    }
    
    const { data, error } = await query.maybeSingle();
    
    if (error) {
      console.error(`❌ findActiveSignalByEmail: erreur:`, error);
      return null;
    }
    
    if (data?.dossier_ref) {
      console.log(`✅ findActiveSignalByEmail: trouvé: ${data.dossier_ref}`);
      return { dossier_ref: data.dossier_ref };
    }
    
    // Fallback: recherche dans athletes_registry
    const { data: registryData, error: registryError } = await supabaseMaster
      .from("athletes_registry")
      .select("dossier_ref")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    
    if (registryError) {
      console.error(`❌ findActiveSignalByEmail: erreur registry:`, registryError);
      return null;
    }
    
    if (registryData?.dossier_ref) {
      console.log(`✅ findActiveSignalByEmail: trouvé dans registry: ${registryData.dossier_ref}`);
      return { dossier_ref: registryData.dossier_ref };
    }
    
    console.log(`ℹ️ findActiveSignalByEmail: aucun dossier trouvé pour ${email}`);
    return null;
    
  } catch (err) {
    console.error(`❌ findActiveSignalByEmail: exception pour ${email}:`, err);
    return null;
  }
}

// ============================================================
// ✅ FONCTIONS MANQUANTES POUR engine.ts
// Version adaptée pour l'Option B (un seul projet Supabase)
// ============================================================

/**
 * Récupère l'historique des échanges depuis la table communication_replies
 * @param ref - La référence du dossier (ex: VGD-5FPKM9ZC)
 * @param cityCode - Code de la ville (optionnel, pour filtrer)
 * @param countryCode - Code du pays (optionnel, pour filtrer)
 */
export async function getHistoryFromDB(
  ref: string, 
  cityCode?: string,
  countryCode: string = 'FR'
): Promise<HistoryRow[]> {
  console.log(`📜 getHistoryFromDB: recherche historique pour ${ref}${cityCode ? ` sur ${cityCode}` : ''} (pays: ${countryCode})`);
  
  if (!supabaseMaster) {
    console.error("❌ getHistoryFromDB: supabaseMaster non initialisé");
    return [];
  }
  
  try {
    // ✅ Option B : Recherche directe dans communication_replies
    let query = supabaseMaster
      .from("communication_replies")
      .select("*")
      .eq("dossier_ref", ref)
      .order("created_at", { ascending: true });
    
    // Ajouter le filtre city si fourni
    if (cityCode) {
      query = query.eq("city", cityCode.toUpperCase());
    }
    
    const { data, error } = await query;
    
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
 * 
 * ✅ CORRECTION MAJEURE APPLIQUÉE :
 * ==========================================================
 * 
 * 1. Ne PAS supprimer messagerie_accounts (le compte partenaire doit rester actif)
 * 2. Ne PAS supprimer messagerie_conversations (l'historique de conversation reste)
 * 3. Ne PAS supprimer messagerie_messages (les messages restent consultables)
 * 4. Seules les tables suivantes sont purgées :
 *    - pending_signals (signaux de contact public)
 *    - communication_replies (réponses aux signaux)
 *    - pending_messagerie_requests (demandes d'inscription)
 * 
 * 5. Les tables messagerie_* sont CONSERVÉES pour que :
 *    - Le partenaire puisse continuer à se connecter
 *    - Tous les échanges restent visibles
 *    - L'archivage GitHub sert uniquement de backup externe
 * 
 * ==========================================================
 * 
 * @param ref - La référence du dossier (ex: VGD-5FPKM9ZC)
 * @param cityCode - Code de la ville (optionnel, pour filtrer)
 * @param countryCode - Code du pays (optionnel, pour filtrer)
 */
export async function purgeDossierData(
  ref: string, 
  cityCode?: string,
  countryCode: string = 'FR'
): Promise<{ purged: boolean; error?: string }> {
  console.log(`🗑️ purgeDossierData: purge POUR ${ref}${cityCode ? ` sur ${cityCode}` : ''} (${countryCode})`);
  console.log(`🗑️ purgeDossierData: MODE CONSERVATION - messagerie_accounts, messagerie_conversations, messagerie_messages ne sont PAS supprimés`);
  
  if (!supabaseMaster) {
    console.error("❌ purgeDossierData: supabaseMaster non initialisé");
    return { purged: false, error: "Supabase client non initialisé" };
  }
  
  let purged = true;
  const errors: string[] = [];

  try {
    // ==========================================================
    // 1. PURGE DES TABLES STAFF INTERFACE (pending_signals + communication_replies)
    // Ces données sont archivées sur GitHub, on peut les purger
    // ==========================================================
    
    // Supprimer les réponses staff
    let repliesQuery = supabaseMaster
      .from("communication_replies")
      .delete()
      .eq("dossier_ref", ref);
    
    if (cityCode) {
      repliesQuery = repliesQuery.eq("city", cityCode.toUpperCase());
    }
    
    const { error: repliesError } = await repliesQuery;
    
    if (repliesError) {
      console.error(`❌ purgeDossierData: erreur suppression communication_replies:`, repliesError);
      errors.push(`communication_replies: ${repliesError.message}`);
      purged = false;
    } else {
      console.log(`✅ purgeDossierData: communication_replies purgé pour ${ref}`);
    }
    
    // Supprimer le signal
    let signalsQuery = supabaseMaster
      .from("pending_signals")
      .delete()
      .eq("dossier_ref", ref);
    
    if (cityCode) {
      signalsQuery = signalsQuery.eq("city", cityCode.toUpperCase());
    }
    
    const { error: signalsError } = await signalsQuery;
    
    if (signalsError) {
      console.error(`❌ purgeDossierData: erreur suppression pending_signals:`, signalsError);
      errors.push(`pending_signals: ${signalsError.message}`);
      purged = false;
    } else {
      console.log(`✅ purgeDossierData: pending_signals purgé pour ${ref}`);
    }
    
    // ==========================================================
    // 2. PURGE DES DEMANDES D'INSCRIPTION À LA MESSAGERIE
    // Ces données sont archivées sur GitHub, on peut les purger
    // ==========================================================
    
    const { error: requestError } = await supabaseMaster
      .from("pending_messagerie_requests")
      .delete()
      .eq("dossier_ref", ref);
    
    if (requestError) {
      console.error(`❌ purgeDossierData: erreur suppression pending_messagerie_requests:`, requestError);
      errors.push(`pending_messagerie_requests: ${requestError.message}`);
      purged = false;
    } else {
      console.log(`✅ purgeDossierData: pending_messagerie_requests purgé pour ${ref}`);
    }
    
    // ==========================================================
    // 3. ✅ TABLES MESSAGERIE PRIVÉE - CONSERVÉES
    // ==========================================================
    // Les tables suivantes ne sont PAS supprimées :
    // - messagerie_accounts (le partenaire doit rester connectable)
    // - messagerie_conversations (l'historique des conversations reste visible)
    // - messagerie_messages (tous les messages restent consultables)
    //
    // L'archivage GitHub sert uniquement de backup externe.
    // Les données restent en base active pour une consultation immédiate.
    // ==========================================================
    
    console.log(`✅ purgeDossierData: messagerie_accounts CONSERVÉ pour ${ref} (compte partenaire actif)`);
    console.log(`✅ purgeDossierData: messagerie_conversations CONSERVÉ pour ${ref} (historique visible)`);
    console.log(`✅ purgeDossierData: messagerie_messages CONSERVÉ pour ${ref} (messages consultables)`);
    
    // ==========================================================
    // 4. RÉSULTAT FINAL
    // ==========================================================
    
    if (purged) {
      console.log(`✅ purgeDossierData: PURGE réussie pour ${ref} (tables contact purgées, messagerie privée conservée)`);
      return { purged: true };
    } else {
      console.warn(`⚠️ purgeDossierData: purge partielle pour ${ref}, erreurs: ${errors.join(', ')}`);
      return { purged: false, error: errors.join('; ') };
    }
    
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erreur inconnue";
    console.error(`❌ purgeDossierData: exception pour ${ref}:`, errorMsg);
    return { purged: false, error: errorMsg };
  }
}
