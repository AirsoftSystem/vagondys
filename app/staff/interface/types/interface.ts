/**
 * Modèle de données pour les messages entrants (Signaux)
 * Extrait du fichier original page.tsx
 */
export interface SignalMessage {
  id: string;
  created_at: string;
  confirmed: boolean;
  is_read: boolean;
  dossier_ref: string | null;
  payload: {
    name: string;
    firstname?: string;
    lastname?: string;
    pseudo?: string;
    email: string;
    phone?: string;
    subject: string;
    message: string;
    client_identity?: unknown;
  };
}

/**
 * Modèle de données pour l'historique des échanges
 */
export interface HistoryMessage {
  id: string;
  created_at: string;
  agent_email: string;
  content: string;
  document_url?: string | null;
  dossier_ref: string;
}

/**
 * Structure des données provenant de l'archive externe GitHub
 */
export interface GitHubArchiveData {
  dossier: SignalMessage;
  echanges_staff: HistoryMessage[];
  date_archivage: string;
  archive_by: string;
}
