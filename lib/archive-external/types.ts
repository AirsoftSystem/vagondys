
/**
 * TYPES DE BASE & UTILITAIRES
 * Correction : Utilisation de unknown au lieu de any
 */
export type JsonObject = Record<string, unknown>;

/**
 * INTERFACES GITHUB (API REST)
 */
export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  download_url: string;
  type: "file" | "dir";
}

/**
 * STRUCTURES DE LA BASE DE DONNÉES (SUPABASE)
 */
export interface HistoryRow {
  id: string;
  created_at: string;
  agent_email: string;
  content: string;
  document_url?: string | null;
  file_url?: string | null;
  file_key?: string | null;
  dossier_ref?: string | null;
}

/**
 * STRUCTURE DU FIL DE DISCUSSION (MAPPED FOR FRONTEND)
 */
export interface ThreadMessage {
  role: string;
  sender: string;
  content: string;
  created_at: string;
  document_url?: string | null;
  is_initial?: boolean;
  details?: {
    name?: string;
    phone?: string;
    email?: string;
    subject?: string;
  };
}

/**
 * STRUCTURE DU DOSSIER CLIENT (MAPPED FOR FRONTEND)
 */
export interface ClientDossier {
  id: string;
  created_at: string;
  confirmed: boolean;
  is_read: boolean;
  dossier_ref: string;
  payload: {
    name: string;
    firstname: string;
    lastname: string;
    pseudo: string;
    email: string;
    phone: string | null;
    subject: string;
    message: string;
    client_identity?: JsonObject | null;
  };
}

/**
 * L'ARCHIVE COMPLETE (Telle que stockée en JSON sur GitHub)
 */
export interface FullArchiveJSON {
  reference: string;
  client_identity: {
    nom: string;
    email: string;
    telephone: string;
    sujet: string;
  };
  dossier_complet: JsonObject; // Contient l'objet message original
  echanges_staff: HistoryRow[];
  fil_de_discussion: ThreadMessage[];
  date_archivage: string;
  archive_by: string;
  security_version: string;
}

/**
 * RÉPONSE FINALE POUR LE FRONTEND
 */
export interface ArchiveFrontendResponse {
  dossier: ClientDossier;
  echanges_staff: HistoryRow[];
  fil_de_discussion: ThreadMessage[];
  date_archivage: string | null;
  archive_by: string | null;
  security_version: string | null;
}
