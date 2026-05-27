
/**
 * ==========================================================
 * API ARCHIVE YEAR - ARCHIVAGE ANNUEL
 * ==========================================================
 * Endpoint pour déclencher l'archivage des données de l'année N-1
 * POST /api/archive-year
 * GET /api/archive-year?city=xxx&year=xxxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  archiveYearForCity,
  archiveYearForAllCities,
  archiveExists,
  getArchiveMetadata,
  loadArchive,
  ArchiveResult
} from '@/lib/archive/yearly-archiver';

// Types
interface ArchiveYearRequest {
  city?: string;
  country?: string;
  year?: number;
  allCities?: boolean;
  force?: boolean;
}

interface ArchiveYearResponse {
  success: boolean;
  message?: string;
  results?: ArchiveResult[];
  result?: ArchiveResult;
  error?: string;
}

/**
 * Vérifie l'authentification de l'utilisateur
 * Seul le staff peut déclencher l'archivage
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
 * Vérifie si l'utilisateur est autorisé (staff uniquement)
 */
async function isAuthorized(userId: string): Promise<boolean> {
  try {
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
    
    // Vérifier si l'utilisateur est staff
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (!userError && user?.user_metadata?.role === 'staff') {
      return true;
    }
    
    // Vérifier dans athletes_registry
    const { data: registry, error: registryError } = await supabase
      .from('athletes_registry')
      .select('is_staff')
      .eq('user_id', userId)
      .single();
    
    if (!registryError && registry) {
      if (registry.is_staff === true) {
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
 * GET /api/archive-year
 * Récupère les métadonnées d'une archive ou liste les archives disponibles
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      );
    }
    
    const authorized = await isAuthorized(user.id);
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé - Accès staff uniquement' },
        { status: 403 }
      );
    }
    
    const searchParams = request.nextUrl.searchParams;
    const city = searchParams.get('city');
    const year = searchParams.get('year');
    const country = searchParams.get('country') || 'FR';
    const action = searchParams.get('action');
    
    if (!city) {
      return NextResponse.json(
        { success: false, error: "Paramètre 'city' requis" },
        { status: 400 }
      );
    }
    
    if (!year) {
      return NextResponse.json(
        { success: false, error: "Paramètre 'year' requis" },
        { status: 400 }
      );
    }
    
    const targetYear = parseInt(year);
    
    if (action === 'load') {
      // Charger le contenu complet de l'archive
      const archiveData = await loadArchive(targetYear, city, country);
      
      if (!archiveData) {
        return NextResponse.json(
          { success: false, error: 'Archive non trouvée' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        data: archiveData,
      });
    } else {
      // Récupérer les métadonnées
      const exists = await archiveExists(targetYear, city, country);
      
      if (!exists) {
        return NextResponse.json(
          { success: false, error: 'Archive non trouvée' },
          { status: 404 }
        );
      }
      
      const metadata = await getArchiveMetadata(targetYear, city, country);
      
      return NextResponse.json({
        success: true,
        data: {
          year: targetYear,
          city,
          country,
          exists: true,
          size: metadata?.size,
          recordsCount: metadata?.recordsCount,
        },
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur GET archive-year:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/archive-year
 * Déclenche l'archivage des données
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      );
    }
    
    const authorized = await isAuthorized(user.id);
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé - Accès staff uniquement' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { city, country, year, allCities, force }: ArchiveYearRequest = body;
    
    // Vérifier si l'utilisateur a demandé l'archivage pour toutes les villes
    if (allCities) {
      console.log(`📦 Archivage annuel demandé par ${user.email} pour TOUTES les villes`);
      
      // Vérifier si l'archivage existe déjà (sauf force=true)
      if (!force) {
        // Cette vérification est optionnelle, on peut archiver même si déjà fait
        console.log(`ℹ️ Archivage forcé: ${force || false}`);
      }
      
      const results = await archiveYearForAllCities(year);
      
      const allSuccess = results.every(r => r.success);
      const hasErrors = results.some(r => r.error);
      
      const response: ArchiveYearResponse = {
        success: allSuccess,
        results,
        message: allSuccess
          ? 'Archivage annuel terminé pour toutes les villes'
          : 'Archivage terminé avec certaines erreurs'
      };
      
      const status = hasErrors ? 207 : 200;
      return NextResponse.json(response, { status });
    }
    
    // Archivage pour une ville spécifique
    if (!city) {
      return NextResponse.json(
        { success: false, error: "Paramètre 'city' requis" },
        { status: 400 }
      );
    }
    
    console.log(`📦 Archivage annuel demandé par ${user.email} pour ${city}/${country || 'FR'} (année: ${year || 'N-1'})`);
    
    // Vérifier si l'archive existe déjà
    const targetYear = year || new Date().getFullYear() - 1;
    const exists = await archiveExists(targetYear, city, country || 'FR');
    
    if (exists && !force) {
      return NextResponse.json(
        {
          success: false,
          error: `Une archive existe déjà pour ${city} (${targetYear}). Utilisez 'force: true' pour écraser.`,
          exists: true
        },
        { status: 409 }
      );
    }
    
    const result = await archiveYearForCity(city, country || 'FR', year);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        result,
        message: `Archivage ${targetYear} terminé pour ${city}`,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Erreur lors de l\'archivage',
          result
        },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('❌ Erreur POST archive-year:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/archive-year?city=xxx&year=xxxx
 * Supprime une archive (uniquement pour le staff admin)
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      );
    }
    
    const authorized = await isAuthorized(user.id);
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé - Accès staff uniquement' },
        { status: 403 }
      );
    }
    
    const searchParams = request.nextUrl.searchParams;
    const city = searchParams.get('city');
    const year = searchParams.get('year');
    const country = searchParams.get('country') || 'FR';
    
    if (!city || !year) {
      return NextResponse.json(
        { success: false, error: 'Paramètres requis: city, year' },
        { status: 400 }
      );
    }
    
    const targetYear = parseInt(year);
    
    // Vérifier si l'archive existe
    const exists = await archiveExists(targetYear, city, country);
    
    if (!exists) {
      return NextResponse.json(
        { success: false, error: 'Archive non trouvée' },
        { status: 404 }
      );
    }
    
    // Récupérer les métadonnées pour obtenir la clé
    const metadata = await getArchiveMetadata(targetYear, city, country);
    
    if (!metadata) {
      return NextResponse.json(
        { success: false, error: 'Impossible de récupérer les métadonnées' },
        { status: 500 }
      );
    }
    
    // Supprimer le fichier de R2
    const { R2Client } = await import('@/lib/storage/r2-client');
    const deleted = await R2Client.deleteFile(metadata.key);
    
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Erreur lors de la suppression du fichier' },
        { status: 500 }
      );
    }
    
    // Supprimer la référence en base de données
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
    
    const { error: deleteError } = await supabase
      .from('player_archives')
      .delete()
      .eq('year', targetYear)
      .eq('city', city.toUpperCase())
      .eq('country', country.toUpperCase());
    
    if (deleteError) {
      console.error('❌ Erreur suppression référence:', deleteError);
      // Non bloquant - le fichier est déjà supprimé de R2
    }
    
    return NextResponse.json({
      success: true,
      message: `Archive ${targetYear} pour ${city} supprimée avec succès`,
    });
    
  } catch (error) {
    console.error('❌ Erreur DELETE archive-year:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}
