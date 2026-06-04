
// lib/github-db/client.ts
import { Octokit } from '@octokit/rest';
import pako from 'pako';

// ==========================================================
// INTERFACES TYPESCRIPT
// ==========================================================

/**
 * Type pour un item de contenu GitHub (fichier)
 */
interface GitHubFileContent {
  type: "file";
  encoding: string;
  size: number;
  name: string;
  path: string;
  content: string;
  sha: string;
  url: string;
  git_url: string | null;
  html_url: string | null;
  download_url: string | null;
  _links: {
    git: string;
    self: string;
    html: string;
  };
}

/**
 * Type pour un dossier GitHub
 */
interface GitHubDirContent {
  type: "dir";
  size: number;
  name: string;
  path: string;
  sha: string;
  url: string;
  git_url: string | null;
  html_url: string | null;
  download_url: string | null;
  _links: {
    git: string;
    self: string;
    html: string;
  };
}

/**
 * Type pour un submodule GitHub
 */
interface GitHubSubmoduleContent {
  type: "submodule";
  size: number;
  name: string;
  path: string;
  sha: string;
  url: string;
  git_url: string | null;
  html_url: string | null;
  download_url: string | null;
  _links: {
    git: string;
    self: string;
    html: string;
  };
}

/**
 * Type union pour tout type de contenu GitHub
 */
type GitHubContent = GitHubFileContent | GitHubDirContent | GitHubSubmoduleContent;

/**
 * Interface pour les métadonnées d'un fichier
 */
interface FileMetadata {
  size: number;
  sha: string;
  updatedAt: string;
}

/**
 * Interface pour l'entrée de cache
 */
interface CacheEntry<T> {
  data: T;
  expires: number;
}

// ==========================================================
// CONFIGURATION
// ==========================================================
const GITHUB_TOKEN = process.env.GITHUB_ARCHIVE_TOKEN;
const GITHUB_REPO = process.env.GITHUB_ARCHIVE_REPO || 'VGD-Tech/VAGONDYS_DATA';

if (!GITHUB_TOKEN) {
  console.warn('⚠️ GITHUB_ARCHIVE_TOKEN manquant - Les opérations GitHub échoueront');
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

const [REPO_OWNER, REPO_NAME] = GITHUB_REPO.split('/');

// ==========================================================
// CACHE MÉMOIRE (5 minutes)
// ==========================================================

const memoryCache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getFromCache<T>(key: string): T | null {
  const entry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (entry && entry.expires > Date.now()) {
    return entry.data as T;
  }
  if (entry) memoryCache.delete(key);
  return null;
}

function setInCache<T>(key: string, data: T): void {
  memoryCache.set(key, {
    data,
    expires: Date.now() + CACHE_TTL,
  });
}

function invalidateCache(path: string): void {
  // Invalider toutes les clés qui commencent par read:{path}
  for (const key of memoryCache.keys()) {
    if (key === `read:${path}` || key.startsWith(`read:${path}/`)) {
      memoryCache.delete(key);
    }
  }
}

// ==========================================================
// CLASSE PRINCIPALE GitHubDB
// ==========================================================
export class GitHubDB {
  
  /**
   * Lire un fichier depuis GitHub (avec décompression GZIP automatique)
   */
  static async read<T>(path: string, options?: { noCache?: boolean }): Promise<T | null> {
    const cacheKey = `read:${path}`;
    
    // Vérifier le cache
    if (!options?.noCache) {
      const cached = getFromCache<T>(cacheKey);
      if (cached !== null) return cached;
    }
    
    try {
      const response = await octokit.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path,
      });
      
      const data = response.data as GitHubContent;
      
      if (data.type !== 'file') {
        console.warn(`GitHubDB.read: ${path} est un dossier, pas un fichier`);
        return null;
      }
      
      const content = Buffer.from(data.content, 'base64');
      let result: T;
      
      // Détection automatique GZIP
      if (path.endsWith('.gz')) {
        const decompressed = pako.ungzip(content, { to: 'string' });
        result = JSON.parse(decompressed);
      } else {
        result = JSON.parse(content.toString('utf-8'));
      }
      
      // Mettre en cache
      setInCache(cacheKey, result);
      
      return result;
    } catch (err) {
      const error = err as { status?: number; message?: string };
      if (error.status === 404) {
        // Fichier inexistant, c'est normal
        return null;
      }
      console.error(`GitHubDB.read error: ${path}`, error.message);
      return null;
    }
  }
  
  /**
   * Écrire un fichier dans GitHub (avec compression GZIP optionnelle)
   */
  static async write<T>(
    path: string,
    data: T,
    options?: { compress?: boolean; message?: string }
  ): Promise<boolean> {
    const compress = options?.compress ?? path.endsWith('.gz');
    let contentBase64: string;
    
    if (compress) {
      const json = JSON.stringify(data, null, 2);
      const compressed = pako.gzip(json);
      contentBase64 = Buffer.from(compressed).toString('base64');
    } else {
      const content = JSON.stringify(data, null, 2);
      contentBase64 = Buffer.from(content, 'utf-8').toString('base64');
    }
    
    try {
      // Vérifier si le fichier existe déjà (pour récupérer le SHA)
      let sha: string | undefined;
      try {
        const existing = await octokit.repos.getContent({
          owner: REPO_OWNER,
          repo: REPO_NAME,
          path,
        });
        const existingData = existing.data as GitHubContent;
        if ('sha' in existingData) {
          sha = existingData.sha;
        }
      } catch (err) {
        const error = err as { status?: number; message?: string };
        if (error.status !== 404) {
          console.warn(`GitHubDB.write: erreur en vérifiant l'existence de ${path}`, error.message);
        }
        // 404 = fichier inexistant, on continue sans SHA
      }
      
      await octokit.repos.createOrUpdateFileContents({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path,
        message: options?.message || `Update ${path}`,
        content: contentBase64,
        sha,
      });
      
      // Invalider le cache
      invalidateCache(path);
      
      return true;
    } catch (err) {
      const error = err as { message?: string };
      console.error(`GitHubDB.write error: ${path}`, error.message);
      return false;
    }
  }
  
  /**
   * Lister les fichiers d'un dossier (noms seulement)
   */
  static async list(path: string): Promise<string[]> {
    const cacheKey = `list:${path}`;
    const cached = getFromCache<string[]>(cacheKey);
    if (cached !== null) return cached;
    
    try {
      const response = await octokit.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path,
      });
      
      if (!Array.isArray(response.data)) {
        return [];
      }
      
      // On ne lit que la propriété 'name', donc on peut typer avec un objet partiel
      const files = response.data.map((item: { name: string }) => item.name);
      setInCache(cacheKey, files);
      return files;
    } catch (err) {
      const error = err as { status?: number; message?: string };
      if (error.status === 404) {
        return [];
      }
      console.error(`GitHubDB.list error: ${path}`, error.message);
      return [];
    }
  }
  
  /**
   * Lister récursivement tous les fichiers d'un dossier (chemins complets)
   */
  static async listRecursive(path: string): Promise<string[]> {
    const items = await this.list(path);
    const allFiles: string[] = [];
    
    for (const item of items) {
      const itemPath = `${path}/${item}`;
      // Vérifier si c'est un dossier (pas d'extension)
      if (!item.includes('.')) {
        const subFiles = await this.listRecursive(itemPath);
        allFiles.push(...subFiles);
      } else {
        allFiles.push(itemPath);
      }
    }
    
    return allFiles;
  }
  
  /**
   * Supprimer un fichier
   */
  static async delete(path: string, message?: string): Promise<boolean> {
    try {
      const existing = await octokit.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path,
      });
      
      const existingData = existing.data as GitHubContent;
      if (!('sha' in existingData)) {
        return false;
      }
      
      await octokit.repos.deleteFile({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path,
        message: message || `Delete ${path}`,
        sha: existingData.sha,
      });
      
      invalidateCache(path);
      return true;
    } catch (err) {
      const error = err as { status?: number; message?: string };
      if (error.status !== 404) {
        console.error(`GitHubDB.delete error: ${path}`, error.message);
      }
      return false;
    }
  }
  
  /**
   * Vérifier si un fichier existe
   */
  static async exists(path: string): Promise<boolean> {
    try {
      await octokit.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path,
      });
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Obtenir les métadonnées d'un fichier (taille, date, SHA)
   * Note: L'API GitHub ne fournit pas la date de commit directement via getContent
   */
  static async getMetadata(path: string): Promise<FileMetadata | null> {
    try {
      const response = await octokit.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path,
      });
      
      const data = response.data as GitHubContent;
      
      if ('size' in data && 'sha' in data) {
        // Pour obtenir la date, il faudrait faire un appel supplémentaire à l'API commits
        // On retourne la date courante par défaut
        return {
          size: data.size,
          sha: data.sha,
          updatedAt: new Date().toISOString(),
        };
      }
      return null;
    } catch {
      return null;
    }
  }
}

// ==========================================================
// EXPORT D'UN CLIENT PRÊT À L'EMPLOI
// ==========================================================
export const githubDB = GitHubDB;
