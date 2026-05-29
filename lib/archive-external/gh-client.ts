
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
 * ✅ AJOUT : Support des fichiers .json et .json.gz
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
      // ✅ Support des fichiers .json et .json.gz
      const isJsonFile = item.name.endsWith('.json') || item.name.endsWith('.json.gz');
      if (!isJsonFile) continue;
      
      // ✅ Comparaison avec la référence
      const itemNameClean = item.name.replace(/-/g, "").toLowerCase();
      if (itemNameClean.includes(cleanRef) || item.name.includes(ref)) {
        return item;
      }
    }
  }
  
  return null;
}

/**
 * Liste tous les fichiers .json et .json.gz de manière récursive
 * ✅ MODIFICATION : Support des fichiers .json.gz
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
    } else if (item.type === "file") {
      // ✅ Support des fichiers .json et .json.gz
      if (item.name.endsWith('.json') || item.name.endsWith('.json.gz')) {
        allFiles.push(item);
      }
    }
  }
  return allFiles;
}

/**
 * Enregistre ou met à jour un fichier sur GitHub
 * ✅ MODIFICATION : Détection automatique du type de contenu (base64 vs texte)
 */
export async function upsertFile(
  token: string,
  repoName: string,
  path: string,
  content: string,
  message: string,
  sha?: string
) {
  // ✅ Vérifier si le contenu est déjà en base64 (fichiers compressés)
  // Les données compressées sont déjà en base64, pas besoin de re-encoder
  let contentEncoded: string;
  
  // Détection simple : si le contenu contient des caractères non ASCII ou si c'est du base64 valide
  // Pour les fichiers .gz, on suppose que le contenu est déjà en base64
  if (path.endsWith('.gz')) {
    // Déjà en base64 (venant de compressed.toString('base64'))
    contentEncoded = content;
    console.log(`📦 upsertFile: fichier compressé détecté (${path}), contenu déjà en base64`);
  } else {
    // Fichier JSON standard : encoder en base64
    contentEncoded = Buffer.from(content).toString("base64");
  }
  
  const url = buildGitHubUrl(repoName, path);
  
  const requestBody: {
    message: string;
    content: string;
    branch: string;
    sha?: string;
  } = {
    message,
    content: contentEncoded,
    branch: BRANCH,
  };
  
  if (sha) {
    requestBody.sha = sha;
  }
  
  return ghFetch(url, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
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
