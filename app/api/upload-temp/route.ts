
import { NextRequest, NextResponse } from 'next/server';
import { R2Client } from '@/lib/storage/r2-client';

// Types MIME autorisés
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

// Taille max : 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Rate limiting simple (en mémoire, pour éviter les abus)
const uploadRequests = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 5;

  const timestamps = uploadRequests.get(ip) || [];
  const recent = timestamps.filter(t => now - t < windowMs);

  if (recent.length >= maxRequests) return true;

  recent.push(now);
  uploadRequests.set(ip, recent);
  return false;
}

/**
 * Génère un nom de fichier sécurisé pour R2 (utilisé uniquement pour le fallback)
 * Note: R2Client.generateDocumentPath est utilisé directement pour la clé finale
 */
function sanitizeFilename(filename: string): string {
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .toLowerCase()
    .slice(0, 100);
}

/**
 * POST : Upload d’un fichier temporaire vers R2
 * Body (multipart/form-data) :
 *   - file: File
 *   - context: 'contact' | 'staff'
 *   - dossierRef?: string (optionnel)
 *   - cf-turnstile-response?: string (pour public)
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Récupération IP pour rate limiting
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Trop de requêtes. Réessayez dans une minute.' },
        { status: 429 }
      );
    }

    // 2. Récupération du formData
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const context = formData.get('context') as string | null;
    const dossierRef = formData.get('dossierRef') as string | null;
    const turnstileToken = formData.get('cf-turnstile-response') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
    }

    if (!context || !['contact', 'staff'].includes(context)) {
      return NextResponse.json({ error: 'Contexte invalide (contact ou staff requis)' }, { status: 400 });
    }

    // 3. Vérification Turnstile pour le contexte public
    if (context === 'contact') {
      if (!turnstileToken) {
        return NextResponse.json({ error: 'Validation Turnstile requise' }, { status: 400 });
      }

      const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
      if (turnstileSecret) {
        const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: turnstileSecret, response: turnstileToken }),
        });
        const verifyData = await verifyRes.json();
        if (!verifyData.success) {
          return NextResponse.json({ error: 'Validation Turnstile échouée' }, { status: 403 });
        }
      }
    }

    // 4. Validation du fichier
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Type de fichier non supporté. Types acceptés : ${ALLOWED_MIME_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Fichier trop volumineux. Maximum ${MAX_FILE_SIZE / 1024 / 1024} MB` },
        { status: 400 }
      );
    }

    // 5. Préparation des paramètres pour R2Client.uploadPlayerDocument
    // Signature exacte : (playerId, city, category, file, originalFilename)
    const playerId = dossierRef && dossierRef !== 'temp' ? dossierRef : `temp_${Date.now()}`;
    const city = context; // 'contact' ou 'staff'
    const category = 'temp';
    const originalFilename = sanitizeFilename(file.name);

    // 6. Upload vers R2 (via R2Client existant)
    const { key, signedUrl } = await R2Client.uploadPlayerDocument(
      playerId,
      city,
      category,
      file,
      originalFilename
    );

    // 7. Retourner l’URL signée
    return NextResponse.json({
      success: true,
      key,
      url: signedUrl,
      expiresIn: 3600,
    });

  } catch (error) {
    console.error('❌ Erreur upload-temp:', error);
    return NextResponse.json(
      { error: 'Erreur interne lors de l’upload' },
      { status: 500 }
    );
  }
}

/**
 * GET : Récupère une URL signée pour un fichier déjà uploadé
 * Query params : key (string)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'Clé du fichier manquante' }, { status: 400 });
    }

    // Vérification basique : la clé doit contenir 'temp'
    if (!key.includes('/temp/')) {
      return NextResponse.json({ error: 'Clé invalide' }, { status: 403 });
    }

    // Utilisation de la méthode existante de R2Client
    const signedUrl = await R2Client.getPlayerDocumentUrl(key);

    return NextResponse.json({
      success: true,
      url: signedUrl,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error('❌ Erreur récupération URL signée:', error);
    return NextResponse.json({ error: 'Fichier non trouvé' }, { status: 404 });
  }
}

/**
 * DELETE : Supprime un fichier temporaire
 * Query params : key (string)
 * (réservé au staff ou au nettoyage automatique)
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'Clé du fichier manquante' }, { status: 400 });
    }

    if (!key.includes('/temp/')) {
      return NextResponse.json({ error: 'Clé invalide' }, { status: 403 });
    }

    const deleted = await R2Client.deletePlayerDocument(key);

    if (!deleted) {
      return NextResponse.json({ error: 'Échec de la suppression' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Erreur suppression fichier temporaire:', error);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
