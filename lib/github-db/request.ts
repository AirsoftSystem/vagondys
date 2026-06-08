
// lib/github-db/request.ts
import { GitHubDB } from './client';

// ==========================================================
// TYPES
// ==========================================================

export interface KbisScanResult {
  safe: boolean;
  virusDetected?: boolean;
  isAuthentic?: boolean;
  confidence?: number;
  fileSize?: number;
  fileType?: string;
  metadata?: Record<string, unknown>;
}

export interface MessagerieRequest {
  id: string;
  dossier_ref: string;
  full_name: string;
  email: string;
  company: string | null;
  phone: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  city: string;
  country: string;
  // KBis
  kbis_url?: string | null;
  kbis_key?: string | null;
  kbis_validated?: boolean;
  kbis_scan_result?: KbisScanResult | null;
}

export interface RequestMessage {
  id: string;
  sender_email: string;
  sender_name: string;
  content: string;
  is_staff: boolean;
  created_at: string;
}

// ==========================================================
// FONCTIONS
// ==========================================================

/**
 * Génère un dossier_ref unique (VGD-XXXXXXXX)
 */
export function generateDossierRef(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `VGD-${result}`;
}

/**
 * Construit le chemin du fichier de demande pour un dossier
 * @param dossierRef - Référence du dossier (ex: VGD-XXXXXX)
 * @returns Chemin dans GitHub
 */
function getRequestPath(dossierRef: string): string {
  return `conversations/${dossierRef}/request.json.gz`;
}

/**
 * Construit le chemin du fichier de messages pour un dossier
 * @param dossierRef - Référence du dossier
 * @returns Chemin dans GitHub
 */
function getMessagesPath(dossierRef: string): string {
  return `conversations/${dossierRef}/messages.json.gz`;
}

/**
 * Récupère une demande par sa référence
 * @param dossierRef - Référence du dossier
 * @returns La demande ou null
 */
export async function getRequest(dossierRef: string): Promise<MessagerieRequest | null> {
  try {
    const path = getRequestPath(dossierRef);
    const request = await GitHubDB.read<MessagerieRequest>(path);
    return request;
  } catch (err) {
    console.error(`Erreur lecture demande ${dossierRef}:`, err);
    return null;
  }
}

/**
 * Récupère toutes les demandes (pour admin)
 * @param options - Filtres optionnels (status, city, limit)
 * @returns Liste des demandes
 */
export async function getAllRequests(options?: {
  status?: "pending" | "approved" | "rejected";
  city?: string;
  limit?: number;
}): Promise<MessagerieRequest[]> {
  try {
    // Lister tous les dossiers dans conversations/
    const conversationsPath = "conversations/";
    const folders = await GitHubDB.list(conversationsPath);
    
    const requests: MessagerieRequest[] = [];
    
    for (const folder of folders) {
      // Vérifier si c'est un dossier (contient request.json.gz)
      const requestPath = `${conversationsPath}${folder}/request.json.gz`;
      const exists = await GitHubDB.exists(requestPath);
      
      if (exists) {
        const request = await GitHubDB.read<MessagerieRequest>(requestPath);
        if (request) {
          // Appliquer les filtres
          if (options?.status && request.status !== options.status) continue;
          if (options?.city && request.city !== options.city) continue;
          requests.push(request);
        }
      }
    }
    
    // Trier par date décroissante (plus récent d'abord)
    requests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    // Appliquer la limite
    if (options?.limit && options.limit > 0) {
      return requests.slice(0, options.limit);
    }
    
    return requests;
  } catch (err) {
    console.error("Erreur lecture toutes les demandes:", err);
    return [];
  }
}

/**
 * Crée une nouvelle demande
 * @param data - Données de la demande (sans dossier_ref, id, dates)
 * @returns La demande créée avec dossier_ref
 */
export async function createRequest(data: {
  full_name: string;
  email: string;
  company?: string | null;
  phone?: string | null;
  reason: string;
  city: string;
  country?: string;
  kbis_url?: string | null;
  kbis_key?: string | null;
  kbis_validated?: boolean;
  kbis_scan_result?: KbisScanResult | null;
}): Promise<MessagerieRequest | null> {
  try {
    const dossierRef = generateDossierRef();
    const now = new Date().toISOString();
    
    const newRequest: MessagerieRequest = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      dossier_ref: dossierRef,
      full_name: data.full_name,
      email: data.email.toLowerCase().trim(),
      company: data.company || null,
      phone: data.phone || null,
      reason: data.reason,
      status: "pending",
      reviewed_by: null,
      reviewed_at: null,
      created_at: now,
      updated_at: now,
      city: data.city.toUpperCase().trim(),
      country: data.country || "FR",
      kbis_url: data.kbis_url || null,
      kbis_key: data.kbis_key || null,
      kbis_validated: data.kbis_validated || false,
      kbis_scan_result: data.kbis_scan_result || null,
    };
    
    const path = getRequestPath(dossierRef);
    const success = await GitHubDB.write(path, newRequest, { compress: true });
    
    if (!success) return null;
    
    // Créer également un fichier messages vide
    const messagesPath = getMessagesPath(dossierRef);
    await GitHubDB.write(messagesPath, [], { compress: true });
    
    return newRequest;
  } catch (err) {
    console.error("Erreur création demande:", err);
    return null;
  }
}

/**
 * Met à jour le statut d'une demande (approuver/rejeter)
 * @param dossierRef - Référence du dossier
 * @param status - Nouveau statut
 * @param reviewedBy - Email du staff qui a traité
 * @returns true si succès
 */
export async function updateRequestStatus(
  dossierRef: string,
  status: "approved" | "rejected",
  reviewedBy: string
): Promise<boolean> {
  try {
    const request = await getRequest(dossierRef);
    if (!request) return false;
    
    request.status = status;
    request.reviewed_by = reviewedBy;
    request.reviewed_at = new Date().toISOString();
    request.updated_at = new Date().toISOString();
    
    const path = getRequestPath(dossierRef);
    return await GitHubDB.write(path, request, { compress: true });
  } catch (err) {
    console.error(`Erreur mise à jour statut ${dossierRef}:`, err);
    return false;
  }
}

/**
 * Supprime une demande (et tous ses messages)
 * @param dossierRef - Référence du dossier
 * @returns true si succès
 */
export async function deleteRequest(dossierRef: string): Promise<boolean> {
  try {
    // Supprimer le fichier de demande
    const requestPath = getRequestPath(dossierRef);
    const requestDeleted = await GitHubDB.delete(requestPath, `Suppression demande ${dossierRef}`);
    
    // Supprimer le fichier de messages
    const messagesPath = getMessagesPath(dossierRef);
    await GitHubDB.delete(messagesPath, `Suppression messages ${dossierRef}`);
    
    // Optionnel : supprimer le dossier s'il est vide
    // GitHub ne permet pas de supprimer des dossiers vides facilement,
    // on laisse le dossier (il restera vide)
    
    return requestDeleted;
  } catch (err) {
    console.error(`Erreur suppression demande ${dossierRef}:`, err);
    return false;
  }
}

/**
 * Vérifie si une demande existe déjà pour un email
 * @param email - Email du demandeur
 * @returns La demande existante ou null
 */
export async function findRequestByEmail(email: string): Promise<MessagerieRequest | null> {
  const allRequests = await getAllRequests();
  const normalizedEmail = email.toLowerCase().trim();
  return allRequests.find(r => r.email === normalizedEmail) || null;
}

/**
 * Récupère les messages d'une conversation (demande)
 * @param dossierRef - Référence du dossier
 * @returns Liste des messages
 */
export async function getRequestMessages(dossierRef: string): Promise<RequestMessage[]> {
  try {
    const path = getMessagesPath(dossierRef);
    const messages = await GitHubDB.read<RequestMessage[]>(path);
    return messages || [];
  } catch (err) {
    console.error(`Erreur lecture messages ${dossierRef}:`, err);
    return [];
  }
}

/**
 * Ajoute un message à une conversation (demande)
 * @param dossierRef - Référence du dossier
 * @param message - Message à ajouter
 * @returns true si succès
 */
export async function addRequestMessage(
  dossierRef: string,
  message: Omit<RequestMessage, "id" | "created_at">
): Promise<boolean> {
  try {
    const existingMessages = await getRequestMessages(dossierRef);
    
    const newMessage: RequestMessage = {
      ...message,
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      created_at: new Date().toISOString(),
    };
    
    existingMessages.push(newMessage);
    
    const path = getMessagesPath(dossierRef);
    return await GitHubDB.write(path, existingMessages, { compress: true });
  } catch (err) {
    console.error(`Erreur ajout message ${dossierRef}:`, err);
    return false;
  }
}

// ==========================================================
// EXPORT
// ==========================================================
export const requestDB = {
  getRequest,
  getAllRequests,
  createRequest,
  updateRequestStatus,
  deleteRequest,
  findRequestByEmail,
  getRequestMessages,
  addRequestMessage,
  generateDossierRef,
};
