
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
 * Version étendue pour supporter également les tables de la messagerie privée
 * 
 * ✅ CORRECTION : Ajout de la purge des tables de messagerie privée :
 * - pending_messagerie_requests (demandes d'inscription)
 * - messagerie_accounts (comptes partenaires)
 * - messagerie_conversations (conversations)
 * - messagerie_messages (messages échangés)
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
  
  if (!supabaseMaster) {
    console.error("❌ purgeDossierData: supabaseMaster non initialisé");
    return { purged: false, error: "Supabase client non initialisé" };
  }
  
  let purged = true;
  const errors: string[] = [];

  try {
    // ==========================================================
    // 1. PURGE DES TABLES STAFF INTERFACE (pending_signals + communication_replies)
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
    // 2. PURGE DES TABLES MESSAGERIE PRIVÉE (Admin)
    // ==========================================================
    
    // 2.1 Supprimer les messages de la messagerie
    // D'abord récupérer les IDs des conversations liées à ce dossier
    const { data: conversations, error: fetchConvError } = await supabaseMaster
      .from("messagerie_conversations")
      .select("id")
      .eq("dossier_ref", ref);
    
    if (fetchConvError) {
      console.warn(`⚠️ purgeDossierData: impossible de récupérer les conversations pour ${ref}:`, fetchConvError);
    }
    
    if (conversations && conversations.length > 0) {
      const conversationIds = conversations.map(c => c.id);
      
      // Supprimer les messages liés à ces conversations
      const { error: messagesError } = await supabaseMaster
        .from("messagerie_messages")
        .delete()
        .in("conversation_id", conversationIds);
      
      if (messagesError) {
        console.error(`❌ purgeDossierData: erreur suppression messagerie_messages:`, messagesError);
        errors.push(`messagerie_messages: ${messagesError.message}`);
        purged = false;
      } else {
        console.log(`✅ purgeDossierData: messagerie_messages purgé pour ${ref} (${conversationIds.length} conversations)`);
      }
    }
    
    // 2.2 Supprimer les conversations
    const { error: convError } = await supabaseMaster
      .from("messagerie_conversations")
      .delete()
      .eq("dossier_ref", ref);
    
    if (convError) {
      console.error(`❌ purgeDossierData: erreur suppression messagerie_conversations:`, convError);
      errors.push(`messagerie_conversations: ${convError.message}`);
      purged = false;
    } else {
      console.log(`✅ purgeDossierData: messagerie_conversations purgé pour ${ref}`);
    }
    
    // 2.3 Supprimer le compte messagerie associé
    const { error: accountError } = await supabaseMaster
      .from("messagerie_accounts")
      .delete()
      .eq("dossier_ref", ref);
    
    if (accountError) {
      console.error(`❌ purgeDossierData: erreur suppression messagerie_accounts:`, accountError);
      errors.push(`messagerie_accounts: ${accountError.message}`);
      purged = false;
    } else {
      console.log(`✅ purgeDossierData: messagerie_accounts purgé pour ${ref}`);
    }
    
    // 2.4 Supprimer la demande d'inscription à la messagerie
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
    // 3. RÉSULTAT FINAL
    // ==========================================================
    
    if (purged) {
      console.log(`✅ purgeDossierData: PURGE TOTALE réussie pour ${ref} (toutes les tables)`);
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
