
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
 * Vérifie si un fichier est une archive JSON (compressée ou non)
 */
function isArchiveFile(filename: string): boolean {
  return filename.endsWith('.json') || filename.endsWith('.json.gz');
}

/**
 * Nettoie le nom de fichier pour la recherche (enlève l'extension)
 */
function cleanFilenameForSearch(filename: string, removeExtension: boolean = true): string {
  let result = filename;
  if (removeExtension) {
    result = result.replace(/\.json(\.gz)?$/, '');
  }
  return result.toLowerCase().replace(/-/g, "");
}

/**
 * Recherche récursive d'un dossier par sa référence (VGD-XXXX)
 * Reprend votre algorithme exact de recherche par cleanRef
 * ✅ AJOUT : Support des fichiers .json et .json.gz
 * ✅ AJOUT : Recherche améliorée pour les fichiers compressés
 */
export async function findFileInRepo(
  ref: string, 
  token: string, 
  repoName: string, 
  path: string = "archives",
  countryCode?: string
): Promise<GitHubFile | null> {
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
    } else if (item.type === "file" && isArchiveFile(item.name)) {
      // ✅ Comparaison améliorée pour les fichiers compressés
      const itemNameClean = cleanFilenameForSearch(item.name, true);
      const refClean = cleanRef;
      
      // Vérifier si le nom du fichier contient la référence
      if (itemNameClean.includes(refClean) || item.name.includes(ref)) {
        console.log(`✅ findFileInRepo: fichier trouvé: ${item.name}`);
        return item;
      }
    }
  }
  
  return null;
}

/**
 * Liste tous les fichiers .json et .json.gz de manière récursive
 * ✅ MODIFICATION : Support complet des fichiers .json.gz
 * ✅ AJOUT : Gestion des erreurs améliorée
 */
export async function listAllArchiveFiles(
  token: string, 
  repoName: string, 
  path: string = "archives",
  depth: number = 0
): Promise<GitHubFile[]> {
  const url = buildGitHubUrl(repoName, path);
  const res = await ghFetch(url, token);
  
  if (!res.ok) {
    if (res.status === 404) {
      // Le dossier n'existe pas encore, retourner un tableau vide
      return [];
    }
    console.warn(`⚠️ listAllArchiveFiles: échec requête GitHub pour ${path}, status=${res.status}`);
    return [];
  }

  const items = (await res.json()) as GitHubFile[];
  let allFiles: GitHubFile[] = [];

  for (const item of items) {
    if (item.type === "dir") {
      // Limiter la profondeur de récursion pour éviter les appels infinis
      if (depth < 10) {
        const subFiles = await listAllArchiveFiles(token, repoName, item.path, depth + 1);
        allFiles = [...allFiles, ...subFiles];
      } else {
        console.warn(`⚠️ listAllArchiveFiles: profondeur maximale atteinte pour ${item.path}`);
      }
    } else if (item.type === "file" && isArchiveFile(item.name)) {
      allFiles.push(item);
    }
  }
  
  console.log(`📦 listAllArchiveFiles: ${allFiles.length} fichiers trouvés dans ${path}`);
  return allFiles;
}

/**
 * Enregistre ou met à jour un fichier sur GitHub
 * ✅ MODIFICATION : Détection automatique du type de contenu (base64 vs texte)
 * ✅ AJOUT : Support complet des fichiers .json.gz
 */
export async function upsertFile(
  token: string,
  repoName: string,
  path: string,
  content: string,
  message: string,
  sha?: string
) {
  let contentEncoded: string;
  let isCompressed = false;
  
  // Détection du type de fichier par l'extension
  if (path.endsWith('.gz')) {
    // Fichier compressé : le contenu est déjà en base64
    contentEncoded = content;
    isCompressed = true;
    console.log(`📦 upsertFile: fichier compressé détecté (${path}), contenu déjà en base64`);
  } else {
    // Fichier JSON standard : encoder en base64
    contentEncoded = Buffer.from(content).toString("base64");
    console.log(`📦 upsertFile: fichier JSON standard (${path}), contenu encodé en base64`);
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
  
  const response = await ghFetch(url, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });
  
  if (response.ok && isCompressed) {
    console.log(`✅ upsertFile: fichier compressé uploadé avec succès (${path})`);
  } else if (response.ok) {
    console.log(`✅ upsertFile: fichier uploadé avec succès (${path})`);
  }
  
  return response;
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
  
  console.log(`🗑️ deleteFile: suppression de ${path}`);
  
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
