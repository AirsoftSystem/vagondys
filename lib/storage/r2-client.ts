
/**
 * ==========================================================
 * CLOUDFLARE R2 CLIENT - STOCKAGE DOCUMENTS
 * ==========================================================
 * Ce fichier gère l'upload, le téléchargement et la suppression
 * des documents sur Cloudflare R2 via l'API native S3 (fetch)
 * 
 * ⚠️ PRÉ-REQUIS : Installer les dépendances suivantes :
 * npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 */

import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand, 
  ListObjectsV2Command, 
  HeadObjectCommand,
  _Object
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ==========================================================
// CONFIGURATION R2
// ==========================================================

const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'vagondys-documents';
const R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL;

// Endpoint R2 (format: https://{account-id}.r2.cloudflarestorage.com)
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

// Client S3 compatible pour R2
let r2ClientInstance: S3Client | null = null;

/**
 * Initialise et retourne le client R2
 */
function getR2Client(): S3Client {
  if (!r2ClientInstance) {
    if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ACCOUNT_ID) {
      throw new Error('Configuration R2 manquante. Vérifiez les variables d\'environnement.');
    }

    r2ClientInstance = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return r2ClientInstance;
}

// ==========================================================
// FONCTIONS UTILITAIRES
// ==========================================================

/**
 * Génère un chemin unique pour un document
 * Format: {city}/{category}/{playerId}/{timestamp}_{filename}
 */
export function generateDocumentPath(
  city: string,
  category: string,
  playerId: string,
  originalFilename: string
): string {
  const timestamp = Date.now();
  const cleanCity = city.toLowerCase().trim();
  const cleanCategory = category.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const extension = originalFilename.split('.').pop() || 'bin';
  const safeFilename = `${timestamp}_${playerId.substring(0, 8)}.${extension}`;
  
  return `${cleanCity}/${cleanCategory}/${playerId}/${safeFilename}`;
}

/**
 * Génère un chemin pour une archive annuelle
 * Format: archives/year={year}/{city}/{filename}.json.gz
 */
export function generateArchivePath(
  year: number,
  city: string,
  filename: string
): string {
  const cleanCity = city.toLowerCase().trim();
  return `archives/year=${year}/${cleanCity}/${filename}`;
}

/**
 * Vérifie si un fichier existe dans le bucket
 */
export async function fileExists(key: string): Promise<boolean> {
  try {
    const client = getR2Client();
    const command = new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });
    await client.send(command);
    return true;
  } catch {
    return false;
  }
}

// ==========================================================
// OPÉRATIONS DE BASE
// ==========================================================

/**
 * Convertit un Blob en Buffer
 */
async function blobToBuffer(blob: Blob): Promise<Buffer> {
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Upload d'un fichier vers R2
 * @param key - Chemin unique du fichier
 * @param body - Contenu du fichier (Buffer, ReadableStream, ou Blob)
 * @param contentType - Type MIME du fichier
 * @returns URL publique ou undefined
 */
export async function uploadFile(
  key: string,
  body: Buffer | ReadableStream | Blob,
  contentType: string
): Promise<string | undefined> {
  try {
    const client = getR2Client();
    
    // Convertir le body en format accepté par AWS SDK
    let fileBody: Buffer | ReadableStream;
    
    if (body instanceof Blob) {
      // Conversion Blob -> Buffer
      fileBody = await blobToBuffer(body);
    } else {
      // Buffer ou ReadableStream sont déjà acceptés
      fileBody = body;
    }
    
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: fileBody,
      ContentType: contentType,
    });
    
    await client.send(command);
    
    // Retourner l'URL publique si configurée
    if (R2_PUBLIC_URL) {
      return `${R2_PUBLIC_URL}/${key}`;
    }
    
    console.log(`✅ Fichier uploadé avec succès: ${key}`);
    return undefined;
    
  } catch (error) {
    console.error('❌ Erreur upload R2:', error);
    throw new Error(`Erreur lors de l'upload du fichier: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
  }
}

/**
 * Téléchargement direct d'un fichier depuis R2
 * @param key - Chemin du fichier
 * @returns Buffer du fichier
 */
export async function downloadFile(key: string): Promise<Buffer> {
  try {
    const client = getR2Client();
    
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });
    
    const response = await client.send(command);
    
    if (!response.Body) {
      throw new Error('Fichier vide ou introuvable');
    }
    
    // Convertir le stream en Buffer
    const chunks: Uint8Array[] = [];
    const stream = response.Body as ReadableStream;
    const reader = stream.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    return Buffer.concat(chunks);
    
  } catch (error) {
    console.error('❌ Erreur téléchargement R2:', error);
    throw new Error(`Erreur lors du téléchargement: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
  }
}

/**
 * Génère une URL signée pour un accès temporaire
 * @param key - Chemin du fichier
 * @param expiresIn - Durée de validité en secondes (défaut: 3600 = 1h)
 * @returns URL signée
 */
export async function getSignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  try {
    const client = getR2Client();
    
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });
    
    const signedUrl = await getSignedUrl(client, command, { expiresIn });
    return signedUrl;
    
  } catch (error) {
    console.error('❌ Erreur génération URL signée:', error);
    throw new Error(`Erreur lors de la génération de l'URL: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
  }
}

/**
 * Supprime un fichier de R2
 * @param key - Chemin du fichier
 */
export async function deleteFile(key: string): Promise<boolean> {
  try {
    const client = getR2Client();
    
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });
    
    await client.send(command);
    console.log(`✅ Fichier supprimé: ${key}`);
    return true;
    
  } catch (error) {
    console.error('❌ Erreur suppression R2:', error);
    return false;
  }
}

/**
 * Liste les fichiers dans un dossier (préfixe)
 * @param prefix - Préfixe du chemin (ex: "NANTES/PI/")
 * @returns Liste des clés de fichiers
 */
export async function listFiles(prefix: string): Promise<string[]> {
  try {
    const client = getR2Client();
    
    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
    });
    
    const response = await client.send(command);
    
    const keys = response.Contents?.map((obj: _Object) => obj.Key || '').filter((keyValue: string) => keyValue !== '') || [];
    return keys;
    
  } catch (error) {
    console.error('❌ Erreur liste fichiers R2:', error);
    return [];
  }
}

/**
 * Supprime tous les fichiers d'un dossier (utile pour nettoyage)
 * @param prefix - Préfixe du chemin
 */
export async function deleteFolder(prefix: string): Promise<number> {
  try {
    const files = await listFiles(prefix);
    let deletedCount = 0;
    
    for (const file of files) {
      const success = await deleteFile(file);
      if (success) deletedCount++;
    }
    
    console.log(`✅ Dossier supprimé: ${prefix}, ${deletedCount}/${files.length} fichiers`);
    return deletedCount;
    
  } catch (error) {
    console.error('❌ Erreur suppression dossier R2:', error);
    return 0;
  }
}

// ==========================================================
// OPÉRATIONS SPÉCIFIQUES AUX DOCUMENTS JOUEURS
// ==========================================================

/**
 * Upload d'un document joueur
 * @param playerId - ID du joueur
 * @param city - Ville du joueur
 * @param category - Catégorie de document (PI, JUSTIFICATIF_DOMICILE, etc.)
 * @param file - Fichier à uploader
 * @param originalFilename - Nom original du fichier
 * @returns Clé du fichier et URL signée
 */
export async function uploadPlayerDocument(
  playerId: string,
  city: string,
  category: string,
  file: Blob,
  originalFilename: string
): Promise<{ key: string; signedUrl: string }> {
  const key = generateDocumentPath(city, category, playerId, originalFilename);
  const contentType = file.type || 'application/octet-stream';
  
  await uploadFile(key, file, contentType);
  const signedUrl = await getSignedDownloadUrl(key);
  
  return { key, signedUrl };
}

/**
 * Récupère l'URL signée d'un document joueur
 * @param key - Chemin du document
 * @returns URL signée
 */
export async function getPlayerDocumentUrl(key: string): Promise<string> {
  return getSignedDownloadUrl(key);
}

/**
 * Supprime un document joueur
 * @param key - Chemin du document
 */
export async function deletePlayerDocument(key: string): Promise<boolean> {
  return deleteFile(key);
}

/**
 * Liste tous les documents d'un joueur
 * @param playerId - ID du joueur
 * @param city - Ville du joueur
 * @returns Liste des clés de documents
 */
export async function listPlayerDocuments(playerId: string, city: string): Promise<string[]> {
  const cleanCity = city.toLowerCase().trim();
  const prefix = `${cleanCity}/`;
  
  const allFiles = await listFiles(prefix);
  const playerFiles = allFiles.filter((file: string) => file.includes(`/${playerId}/`));
  
  return playerFiles;
}

// ==========================================================
// OBJET D'EXPORT (pour éviter default export anonyme)
// ==========================================================

export const R2Client = {
  uploadFile,
  downloadFile,
  getSignedDownloadUrl,
  deleteFile,
  listFiles,
  deleteFolder,
  uploadPlayerDocument,
  getPlayerDocumentUrl,
  deletePlayerDocument,
  listPlayerDocuments,
  generateDocumentPath,
  generateArchivePath,
  fileExists,
};
