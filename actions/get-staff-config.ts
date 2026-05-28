
// actions/get-staff-config.ts
'use server';

// ✅ Option B : Plus besoin de getStationConfig - un seul projet Supabase
// Les variables d'environnement sont directement accessibles

export interface StaffConfig {
  staff_url: string;
  staff_anon_key: string;
  staff_service_key: string;
  city: string;
  country: string;
}

/**
 * Récupère la configuration STAFF pour une ville donnée
 * Version adaptée pour l'Option B (un seul projet Supabase)
 * 
 * Dans l'Option B, la configuration est unique pour toutes les villes,
 * mais on conserve le paramètre city pour la logique de filtrage.
 * 
 * @param cityCode - Code de la ville (ex: NANTES) - utilisé pour le filtrage
 * @param countryCode - Code du pays (ex: FR) - utilisé pour le filtrage
 * @returns Configuration STAFF (identifiants uniques du projet Supabase)
 */
export async function getStaffConfig(cityCode: string, countryCode: string = 'FR'): Promise<StaffConfig | null> {
  try {
    // ✅ Option B : Variables uniques (un seul projet Supabase)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    // Vérification des variables d'environnement
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error(`❌ getStaffConfig: Variables Supabase manquantes`);
      return null;
    }
    
    // Log pour tracer l'utilisation (cityCode est maintenant un filtre, pas une base différente)
    console.log(`✅ getStaffConfig: Configuration récupérée pour ${cityCode}/${countryCode} (filtre city dans les requêtes)`);
    
    return {
      staff_url: supabaseUrl,
      staff_anon_key: supabaseAnonKey,
      staff_service_key: supabaseServiceKey,
      city: cityCode.toUpperCase(),
      country: countryCode.toUpperCase(),
    };
    
  } catch (error) {
    console.error('❌ getStaffConfig: Erreur', error);
    return null;
  }
}
