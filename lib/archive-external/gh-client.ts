
import { GitHubFile } from "./types";

// Propriétaire par défaut mis à jour selon .env.local (MASTER)
const DEFAULT_OWNER = "vagondys";
const BRANCH = "main";

/**
 * Helper pour construire l'URL GitHub API
 * Gère les cas "owner/repo" (ex: VGD-Nantes/repo) ou juste "repo" (utilise vagondys/)
 */
function buildGitHubUrl(repoName: string, path: string): string {
  const isScoped = repoName.includes("/");
  const fullPath = isScoped ? repoName : `${DEFAULT_OWNER}/${repoName}`;
  const url = `https://api.github.com/repos/${fullPath}/contents/${path}`;
  console.log(`🔗 buildGitHubUrl: ${url}`);
  return url;
}

/**
 * Client de base pour les requêtes GitHub
 */
async function ghFetch(url: string, token: string, options: RequestInit = {}) {
  console.log(`🌐 ghFetch: appel à ${url.substring(0, 80)}...`);
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "VAGONDYS-APP",
      ...options.headers,
    },
  });
  console.log(`🌐 ghFetch: réponse status ${response.status} ${response.statusText}`);
  return response;
}

/**
 * Recherche récursive d'un dossier par sa référence (VGD-XXXX)
 * Reprend votre algorithme exact de recherche par cleanRef
 */
export async function findFileInRepo(
  ref: string, 
  token: string, 
  repoName: string, 
  path: string = "archives",
  countryCode?: string
): Promise<GitHubFile | null> {
  console.log(`🔍 findFileInRepo [DÉBUT] ref=${ref}, repo=${repoName}, path=${path}, country=${countryCode || 'non spécifié'}`);
  
  const url = buildGitHubUrl(repoName, path);
  const res = await ghFetch(url, token);
  
  if (!res.ok) {
    console.error(`❌ findFileInRepo: échec requête GitHub pour ${url}, status=${res.status}`);
    let errorText = "";
    try {
      errorText = await res.text();
      console.error(`❌ findFileInRepo: réponse erreur: ${errorText.substring(0, 500)}`);
    } catch {
      console.error(`❌ findFileInRepo: impossible de lire la réponse d'erreur`);
    }
    return null;
  }

  let items: GitHubFile[];
  try {
    items = await res.json() as GitHubFile[];
    console.log(`📁 findFileInRepo: ${items.length} éléments trouvés dans ${path}`);
  } catch (parseError) {
    console.error(`❌ findFileInRepo: erreur parsing JSON pour ${url}`, parseError);
    return null;
  }

  const cleanRef = ref.replace(/-/g, "").toLowerCase();
  console.log(`🔍 findFileInRepo: recherche du pattern "${cleanRef}" dans les fichiers...`);

  for (const item of items) {
    if (item.type === "dir") {
      console.log(`📂 findFileInRepo: entrée dans le dossier ${item.path}`);
      const found = await findFileInRepo(ref, token, repoName, item.path, countryCode);
      if (found) {
        console.log(`✅ findFileInRepo: fichier trouvé dans sous-dossier: ${found.path}`);
        return found;
      }
    } else if (item.type === "file") {
      const itemNameClean = item.name.replace(/-/g, "").toLowerCase();
      const matchRef = itemNameClean.includes(cleanRef);
      const matchRefDirect = item.name.includes(ref);
      
      console.log(`📄 findFileInRepo: vérification fichier ${item.name} -> clean="${itemNameClean}", matchRef=${matchRef}, matchDirect=${matchRefDirect}`);
      
      if (matchRef || matchRefDirect) {
        console.log(`✅ findFileInRepo: FICHIER TROUVÉ: ${item.path}`);
        return item;
      }
    }
  }
  
  console.warn(`⚠️ findFileInRepo: aucun fichier trouvé pour ref=${ref} dans ${repoName} (chemin ${path})`);
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
  console.log(`📋 listAllArchiveFiles: début pour repo=${repoName}, path=${path}`);
  const url = buildGitHubUrl(repoName, path);
  const res = await ghFetch(url, token);
  if (!res.ok) {
    console.warn(`⚠️ listAllArchiveFiles: échec requête pour ${url}, status=${res.status}`);
    return [];
  }

  let items: GitHubFile[];
  try {
    items = await res.json() as GitHubFile[];
    console.log(`📋 listAllArchiveFiles: ${items.length} éléments trouvés dans ${path}`);
  } catch (parseError) {
    console.error(`❌ listAllArchiveFiles: erreur parsing JSON`, parseError);
    return [];
  }
  
  let allFiles: GitHubFile[] = [];

  for (const item of items) {
    if (item.type === "dir") {
      console.log(`📂 listAllArchiveFiles: exploration dossier ${item.path}`);
      const subFiles = await listAllArchiveFiles(token, repoName, item.path);
      allFiles = [...allFiles, ...subFiles];
    } else if (item.name.endsWith(".json")) {
      console.log(`📄 listAllArchiveFiles: fichier JSON trouvé: ${item.path}`);
      allFiles.push(item);
    }
  }
  console.log(`📋 listAllArchiveFiles: total ${allFiles.length} fichiers JSON trouvés`);
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
  console.log(`💾 upsertFile: ${repoName}/${path}, sha=${sha || 'nouveau fichier'}`);
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
  console.log(`🗑️ deleteFile: ${repoName}/${path}`);
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
