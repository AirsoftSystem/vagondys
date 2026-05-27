
/**
 * ==========================================================
 * API UPLOAD DOCUMENT - CLOUDFLARE R2
 * ==========================================================
 * Endpoint pour l'upload de documents joueurs
 * POST /api/upload-document
 * Body: FormData avec file, category, playerId, city
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { R2Client } from '@/lib/storage/r2-client';

// Types de documents acceptés
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// Taille maximale: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Catégories de documents valides
const VALID_CATEGORIES = [
  'PI',
  'JUSTIFICATIF_DOMICILE',
  'CHARTE',
  'INSCRIPTION_TOURNOI',
  'GAIN',
  'AUTRE',
] as const;

type DocumentCategory = typeof VALID_CATEGORIES[number];

/**
 * Vérifie l'authentification de l'utilisateur
 */
async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_MASTER!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return null;
  }
  
  return user;
}

/**
 * Crée un client Supabase pour les opérations internes
 */
async function createInternalSupabaseClient() {
  const cookieStore = await cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_MASTER!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
}

/**
 * Vérifie si l'utilisateur est autorisé à uploader pour ce joueur
 * - L'utilisateur lui-même peut uploader ses propres documents
 * - Le staff peut uploader pour n'importe quel joueur de sa ville
 */
async function isAuthorized(
  userId: string,
  playerId: string,
  city: string
): Promise<boolean> {
  try {
    const supabase = await createInternalSupabaseClient();
    
    // Vérifier si l'utilisateur est le joueur lui-même
    const { data: player, error: playerError } = await supabase
      .from('athletes_registry')
      .select('user_id, city, country, is_staff')
      .eq('id', playerId)
      .single();
    
    if (!playerError && player) {
      // Si c'est le joueur lui-même
      if (player.user_id === userId) {
        return true;
      }
      
      // Si c'est un staff de la même ville
      if (player.is_staff === true && player.city === city) {
        return true;
      }
    }
    
    // Vérifier si l'utilisateur est staff (via metadata)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (!userError && user?.user_metadata?.role === 'staff') {
      const userCity = user.user_metadata.city;
      if (userCity === city) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('❌ Erreur autorisation:', error);
    return false;
  }
}

/**
 * Valide le fichier uploadé
 */
function validateFile(file: File): { valid: boolean; error?: string } {
  // Vérifier la taille
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `Fichier trop volumineux. Maximum ${MAX_FILE_SIZE / 1024 / 1024}MB` };
  }
  
  // Vérifier le type MIME
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: `Type de fichier non supporté. Types acceptés: ${ALLOWED_MIME_TYPES.join(', ')}` };
  }
  
  return { valid: true };
}

/**
 * Nettoie le nom de fichier pour le stockage
 */
function sanitizeFilename(filename: string): string {
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .toLowerCase();
}

/**
 * POST /api/upload-document
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Vérifier l'authentification
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié', success: false },
        { status: 401 }
      );
    }
    
    // 2. Récupérer le FormData
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const category = formData.get('category') as string | null;
    const playerId = formData.get('playerId') as string | null;
    const city = formData.get('city') as string | null;
    const country = formData.get('country') as string || 'FR';
    
    // 3. Valider les champs requis
    if (!file) {
      return NextResponse.json(
        { error: 'Fichier manquant', success: false },
        { status: 400 }
      );
    }
    
    if (!playerId) {
      return NextResponse.json(
        { error: 'ID joueur manquant', success: false },
        { status: 400 }
      );
    }
    
    if (!city) {
      return NextResponse.json(
        { error: 'Ville manquante', success: false },
        { status: 400 }
      );
    }
    
    if (!category || !VALID_CATEGORIES.includes(category as DocumentCategory)) {
      return NextResponse.json(
        { error: `Catégorie invalide. Valeurs acceptées: ${VALID_CATEGORIES.join(', ')}`, success: false },
        { status: 400 }
      );
    }
    
    // 4. Valider le fichier
    const fileValidation = validateFile(file);
    if (!fileValidation.valid) {
      return NextResponse.json(
        { error: fileValidation.error, success: false },
        { status: 400 }
      );
    }
    
    // 5. Vérifier les autorisations (le paramètre country n'est plus passé)
    const authorized = await isAuthorized(user.id, playerId, city);
    if (!authorized) {
      return NextResponse.json(
        { error: 'Non autorisé à uploader pour ce joueur', success: false },
        { status: 403 }
      );
    }
    
    // 6. Upload vers R2
    const sanitizedFilename = sanitizeFilename(file.name);
    const result = await R2Client.uploadPlayerDocument(
      playerId,
      city,
      category,
      file,
      sanitizedFilename
    );
    
    // 7. Enregistrer la référence du document dans Supabase
    const supabase = await createInternalSupabaseClient();
    
    // Insérer la référence du document
    const { error: insertError } = await supabase
      .from('player_documents')
      .insert({
        player_id: playerId,
        document_key: result.key,
        document_url: result.signedUrl,
        category: category,
        original_filename: file.name,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user.id,
        city: city,
        country: country,
        created_at: new Date().toISOString(),
      });
    
    if (insertError) {
      console.warn('⚠️ Impossible d\'enregistrer la référence du document:', insertError);
      // Non bloquant - le fichier est déjà sur R2
    }
    
    // 8. Retourner la réponse
    return NextResponse.json({
      success: true,
      data: {
        key: result.key,
        url: result.signedUrl,
        category: category,
        playerId: playerId,
      },
      message: 'Document uploadé avec succès',
    });
    
  } catch (error) {
    console.error('❌ Erreur upload document:', error);
    return NextResponse.json(
      { 
        error: 'Erreur lors de l\'upload du document', 
        success: false,
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/upload-document?playerId=xxx&city=xxx
 * Liste les documents d'un joueur
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Vérifier l'authentification
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié', success: false },
        { status: 401 }
      );
    }
    
    // 2. Récupérer les paramètres
    const searchParams = request.nextUrl.searchParams;
    const playerId = searchParams.get('playerId');
    const city = searchParams.get('city');
    
    if (!playerId || !city) {
      return NextResponse.json(
        { error: 'Paramètres manquants: playerId et city sont requis', success: false },
        { status: 400 }
      );
    }
    
    // 3. Vérifier les autorisations
    const authorized = await isAuthorized(user.id, playerId, city);
    if (!authorized) {
      return NextResponse.json(
        { error: 'Non autorisé à consulter les documents de ce joueur', success: false },
        { status: 403 }
      );
    }
    
    // 4. Récupérer les références des documents depuis Supabase
    const supabase = await createInternalSupabaseClient();
    
    const { data: documents, error: fetchError } = await supabase
      .from('player_documents')
      .select('*')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false });
    
    if (fetchError) {
      console.error('❌ Erreur récupération documents:', fetchError);
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des documents', success: false },
        { status: 500 }
      );
    }
    
    // 5. Générer des URLs signées pour chaque document (si elles sont expirées)
    const documentsWithUrls = await Promise.all(
      (documents || []).map(async (doc) => {
        try {
          const signedUrl = await R2Client.getPlayerDocumentUrl(doc.document_key);
          return {
            ...doc,
            url: signedUrl,
          };
        } catch {
          return {
            ...doc,
            url: doc.document_url,
          };
        }
      })
    );
    
    return NextResponse.json({
      success: true,
      data: documentsWithUrls,
    });
    
  } catch (error) {
    console.error('❌ Erreur liste documents:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des documents', success: false },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/upload-document?key=xxx
 * Supprime un document
 */
export async function DELETE(request: NextRequest) {
  try {
    // 1. Vérifier l'authentification
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié', success: false },
        { status: 401 }
      );
    }
    
    // 2. Récupérer le paramètre
    const searchParams = request.nextUrl.searchParams;
    const documentKey = searchParams.get('key');
    
    if (!documentKey) {
      return NextResponse.json(
        { error: 'Paramètre manquant: key est requis', success: false },
        { status: 400 }
      );
    }
    
    // 3. Récupérer les métadonnées du document depuis Supabase
    const supabase = await createInternalSupabaseClient();
    
    const { data: document, error: fetchError } = await supabase
      .from('player_documents')
      .select('*')
      .eq('document_key', documentKey)
      .single();
    
    if (fetchError || !document) {
      return NextResponse.json(
        { error: 'Document non trouvé', success: false },
        { status: 404 }
      );
    }
    
    // 4. Vérifier les autorisations
    const authorized = await isAuthorized(user.id, document.player_id, document.city);
    if (!authorized) {
      return NextResponse.json(
        { error: 'Non autorisé à supprimer ce document', success: false },
        { status: 403 }
      );
    }
    
    // 5. Supprimer le fichier de R2
    const deleted = await R2Client.deletePlayerDocument(documentKey);
    
    if (!deleted) {
      return NextResponse.json(
        { error: 'Erreur lors de la suppression du fichier', success: false },
        { status: 500 }
      );
    }
    
    // 6. Supprimer la référence en base de données
    const { error: deleteError } = await supabase
      .from('player_documents')
      .delete()
      .eq('document_key', documentKey);
    
    if (deleteError) {
      console.warn('⚠️ Document supprimé de R2 mais référence en base persistante:', deleteError);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Document supprimé avec succès',
    });
    
  } catch (error) {
    console.error('❌ Erreur suppression document:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du document', success: false },
      { status: 500 }
    );
  }
}
