
import { JsonObject, HistoryRow, ThreadMessage, ArchiveFrontendResponse } from "./types";

/**
 * Récupère une valeur sécurisée dans un objet imbriqué.
 * Utilise un cast 'as JsonObject' pour naviguer dans les données 'unknown'.
 */
export function getPathString(obj: JsonObject | null, path: string[]): string | null {
  if (!obj) return null;
  let cur: unknown = obj;
  for (const p of path) {
    if (typeof cur === "object" && cur !== null && p in (cur as JsonObject)) {
      cur = (cur as JsonObject)[p];
    } else {
      return null;
    }
  }
  return typeof cur === "string" ? cur : null;
}

/**
 * Découpe un nom complet en Prénom, Nom et Pseudo.
 */
export function splitName(fullName: string | null) {
  const fn = (fullName ?? "").trim();
  if (!fn) return { full_name: "INCONNU", firstname: "INCONNU", lastname: "", pseudo: "INCONNU" };
  
  const parts = fn.split(/\s+/);
  if (parts.length === 1) {
    return { full_name: fn, firstname: parts[0], lastname: "", pseudo: parts[0] };
  } else if (parts.length === 2) {
    return { full_name: fn, firstname: parts[0], lastname: parts[1], pseudo: fn };
  } else {
    const firstname = parts[0];
    const lastname = parts[parts.length - 1];
    const middle = parts.slice(1, -1).join(" ");
    const pseudo = middle || fn;
    return { full_name: fn, firstname, lastname, pseudo };
  }
}

/**
 * Normalise une chaîne pour GitHub (Accents -> Sans, Espace -> _)
 */
export function normalizeForPath(str: string | null): string {
  if (!str) return "INCONNU";
  return str
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .toUpperCase();
}

/**
 * MAPPER : Transforme le JSON brut de l'archive vers la forme attendue par le Front.
 * C'est l'élément crucial qui manquait à ton fichier utils.
 * ✅ CORRECTION : Ajout de messages_history dans le payload retourné
 */
export function mapArchiveToFrontendShape(contentJson: JsonObject): ArchiveFrontendResponse {
  const dossier_complet = (contentJson["dossier_complet"] as JsonObject | undefined) ?? null;
  
  const reference =
    getPathString(contentJson, ["reference"]) ||
    getPathString(dossier_complet, ["dossier_ref"]) ||
    null;

  const client_identity = (contentJson["client_identity"] as JsonObject | undefined) ?? null;
  const echanges_staff = contentJson["echanges_staff"] as HistoryRow[] | undefined;
  const fil_de_discussion = contentJson["fil_de_discussion"] as ThreadMessage[] | undefined;
  
  const date_archivage = getPathString(contentJson, ["date_archivage"]);
  const archive_by = getPathString(contentJson, ["archive_by"]);
  const security_version = getPathString(contentJson, ["security_version"]);

  // Extraction du payload
  const dossierPayload = dossier_complet?.["payload"] as JsonObject | undefined;

  const rawName = (dossierPayload?.["name"] as string) ?? (client_identity?.["nom"] as string) ?? "";
  const rawEmail = (dossierPayload?.["email"] as string) ?? (client_identity?.["email"] as string) ?? "";
  const rawPhone = (dossierPayload?.["phone"] as string) ?? (client_identity?.["telephone"] as string) ?? null;
  const rawSubject = (dossierPayload?.["subject"] as string) ?? (client_identity?.["sujet"] as string) ?? "";
  const rawMessage = (dossierPayload?.["message"] as string) ?? "";
  
  // ✅ CORRECTION : Récupérer messages_history depuis le payload de l'archive
  const rawMessagesHistory = dossierPayload?.["messages_history"] as Array<{ content: string; created_at: string }> | undefined;

  const nameParts = splitName(rawName);

  const dossier = {
    id: (dossier_complet?.["id"] as string) ?? `archived-${reference ?? "unknown"}`,
    created_at: (dossier_complet?.["created_at"] as string) ?? new Date().toISOString(),
    confirmed: Boolean(dossier_complet?.["confirmed"] ?? false),
    is_read: Boolean(dossier_complet?.["is_read"] ?? true),
    dossier_ref: reference ?? "SANS-REF",
    payload: {
      name: nameParts.full_name,
      firstname: nameParts.firstname,
      lastname: nameParts.lastname,
      pseudo: nameParts.pseudo,
      email: rawEmail,
      phone: rawPhone,
      subject: rawSubject,
      message: rawMessage,
      // ✅ CORRECTION : Ajout de messages_history dans le payload
      messages_history: rawMessagesHistory ?? [],
      client_identity: client_identity ?? null
    }
  };

  return {
    dossier,
    echanges_staff: Array.isArray(echanges_staff) ? echanges_staff : [],
    fil_de_discussion: Array.isArray(fil_de_discussion) ? fil_de_discussion : [],
    date_archivage,
    archive_by,
    security_version
  };
}

/**
 * Nettoyage des emails pour la création de slugs
 */
export function getEmailSlug(email: string | null): string {
  return String(email || "inconnu").toLowerCase().replace(/[@.]/g, "_");
}
