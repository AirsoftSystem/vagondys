
/**
 * UTILITAIRES DE GÉNÉRATION DE RÉFÉRENCES UNIFIÉES
 * Format standard : VGD-XXXXXXXX (8 caractères alphanumériques)
 * 
 * Utilisé par :
 * - Inscription des athlètes (confirm-email)
 * - Messagerie privée (request/approve)
 * - Archivage GitHub
 * 
 * Centralisation unique pour garantir la cohérence des références
 */

/**
 * Caractères autorisés pour les références
 * Exclusion de O, I, l, 0, 1 pour éviter les confusions visuelles
 */
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Génère un segment aléatoire de longueur donnée
 * @param length - Nombre de caractères à générer
 * @returns Chaîne aléatoire
 */
function generateSegment(length: number): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return result;
}

/**
 * Génère une référence standard VAGONDYS
 * Format : VGD-XXXXXXXX (8 caractères)
 * 
 * @returns Référence unique (ex: VGD-5FPKM9ZC)
 */
export function generateVGDReference(): string {
  return `VGD-${generateSegment(8)}`;
}

/**
 * Génère une référence avec vérification d'unicité
 * À utiliser pour les insertions en base de données
 * 
 * @param checkUniqueness - Fonction asynchrone qui vérifie si la référence existe déjà
 * @param maxAttempts - Nombre maximum de tentatives (défaut: 5)
 * @returns Référence unique
 */
export async function generateUniqueVGDReference(
  checkUniqueness: (ref: string) => Promise<boolean>,
  maxAttempts: number = 5
): Promise<string> {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const ref = generateVGDReference();
    const exists = await checkUniqueness(ref);
    
    if (!exists) {
      return ref;
    }
    
    attempts++;
  }
  
  throw new Error(`Impossible de générer une référence unique après ${maxAttempts} tentatives`);
}

/**
 * Génère une référence pour la messagerie privée
 * Format : VGD-MSG-XXXXXXXX (8 caractères)
 * 
 * @returns Référence messagerie (ex: VGD-MSG-5FPKM9ZC)
 */
export function generateMessagerieReference(): string {
  return `VGD-MSG-${generateSegment(8)}`;
}

/**
 * Valide une référence VAGONDYS
 * Formats acceptés :
 * - VGD-XXXXXXXX (standard)
 * - VGD-MSG-XXXXXXXX (messagerie)
 * 
 * @param ref - Référence à valider
 * @returns true si le format est valide
 */
export function isValidVGDReference(ref: string): boolean {
  const standardPattern = /^VGD-[A-HJKMNP-TV-Z2-9]{8}$/;
  const messageriePattern = /^VGD-MSG-[A-HJKMNP-TV-Z2-9]{8}$/;
  
  return standardPattern.test(ref) || messageriePattern.test(ref);
}

/**
 * Extrait le type de référence
 * 
 * @param ref - Référence complète
 * @returns 'standard' | 'messagerie' | 'unknown'
 */
export function getReferenceType(ref: string): "standard" | "messagerie" | "unknown" {
  if (/^VGD-[A-HJKMNP-TV-Z2-9]{8}$/.test(ref)) {
    return "standard";
  }
  if (/^VGD-MSG-[A-HJKMNP-TV-Z2-9]{8}$/.test(ref)) {
    return "messagerie";
  }
  return "unknown";
}

/**
 * Extrait le segment unique d'une référence (sans le préfixe)
 * 
 * @param ref - Référence complète
 * @returns Segment unique (ex: 5FPKM9ZC)
 */
export function extractReferenceSegment(ref: string): string {
  if (ref.startsWith("VGD-MSG-")) {
    return ref.substring(8); // "VGD-MSG-".length = 8
  }
  if (ref.startsWith("VGD-")) {
    return ref.substring(4); // "VGD-".length = 4
  }
  return ref;
}

/**
 * Génère un slug pour GitHub à partir d'une référence
 * Format : VGD_XXXXXXXX ou VGD_MSG_XXXXXXXX
 * 
 * @param ref - Référence complète
 * @returns Slug pour GitHub
 */
export function referenceToGitHubSlug(ref: string): string {
  return ref.replace(/-/g, "_");
}

/**
 * Génère un slug pour email à partir d'une référence
 * Format : VGD-XXXXXXXX (inchangé)
 * 
 * @param ref - Référence complète
 * @returns Slug pour email
 */
export function referenceToEmailSlug(ref: string): string {
  return ref;
}
