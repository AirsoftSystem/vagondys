import { JsonObject } from "./types";

/**
 * Interface pour le résultat de la validation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * VALIDATEUR D'ARCHIVE
 * Vérifie la présence des champs obligatoires avant le traitement
 */
export function validateArchiveBody(body: unknown): ValidationResult {
  const errors: string[] = [];

  // 1. Vérification de l'existence du body
  if (!body || typeof body !== "object") {
    return { isValid: false, errors: ["Le corps de la requête est vide ou invalide"] };
  }

  const b = body as JsonObject;

  // 2. Vérification de l'objet 'message' (Le coeur du dossier)
  if (!b.message || typeof b.message !== "object") {
    errors.push("L'objet 'message' est obligatoire");
  } else {
    const msg = b.message as JsonObject;
    if (!msg.dossier_ref) {
      errors.push("La référence du dossier (dossier_ref) est manquante");
    }
  }

  // 3. Vérification de la structure du payload (Optionnel mais recommandé)
  const message = b.message as JsonObject | undefined;
  if (message && (!message.payload || typeof message.payload !== "object")) {
    errors.push("Le 'payload' du message est manquant ou mal formé");
  }

  // 4. Validation du format de l'historique si présent
  if (b.history !== undefined && !Array.isArray(b.history)) {
    errors.push("Le champ 'history' doit être un tableau");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Helper pour valider une référence dossier (Format VGD- + Aléatoire)
 * Adapté pour accepter les nouveaux matricules 100% aléatoires.
 */
export function isValidDossierRef(ref: string): boolean {
  // Accepte VGD- suivi d'au moins un caractère alphanumérique (souvent 8 dans ton cas)
  const regex = /^VGD-[A-Z0-9]+$/i;
  return regex.test(ref);
}
