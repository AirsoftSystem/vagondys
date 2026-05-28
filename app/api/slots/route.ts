
/**
 * ==========================================================
 * API SLOTS - GESTION DES CRÉNEAUX
 * ==========================================================
 * GET /api/slots?date=YYYY-MM-DD&city=xxx - Récupère les créneaux
 * POST /api/slots - Crée un nouveau créneau (staff uniquement)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Types
interface CreateSlotInput {
  date: string;
  start_time: string;
  end_time: string;
  price: number;
  max_participants: number;
  city: string;
  country?: string;
  is_recurring?: boolean;
}

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
 * Vérifie si l'utilisateur est staff
 */
async function isStaff(userId: string): Promise<boolean> {
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
    
    // Vérifier dans athletes_registry
    const { data: registry, error: registryError } = await supabase
      .from('athletes_registry')
      .select('is_staff, role')
      .eq('user_id', userId)
      .single();
    
    if (!registryError && registry) {
      if (registry.is_staff === true || registry.role === 'admin' || registry.role === 'staff') {
        return true;
      }
    }
    
    // Vérifier les métadonnées utilisateur
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (!userError && user?.user_metadata?.role === 'staff') {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ Erreur vérification staff:', error);
    return false;
  }
}

/**
 * Crée un client Supabase pour une ville spécifique
 */
async function createCityClient(city: string, country: string = 'FR') {
  const cookieStore = await cookies();
  
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER!;
  let anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_MASTER!;
  
  const cityUpper = city.toUpperCase().trim();
  const countryUpper = country.toUpperCase().trim();
  const geoKey = `${countryUpper}_${cityUpper}`;
  
  const cityUrl = process.env[`NEXT_PUBLIC_SUPABASE_URL_${geoKey}`] || 
                  process.env[`NEXT_PUBLIC_SUPABASE_URL_${cityUpper}`];
  const cityKey = process.env[`NEXT_PUBLIC_SUPABASE_ANON_KEY_${geoKey}`] || 
                  process.env[`NEXT_PUBLIC_SUPABASE_ANON_KEY_${cityUpper}`];
  
  if (cityUrl && cityKey) {
    url = cityUrl;
    anonKey = cityKey;
  }
  
  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {},
      remove() {},
    },
  });
}

/**
 * GET /api/slots?date=YYYY-MM-DD&city=xxx&country=FR
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');
    const city = searchParams.get('city');
    const country = searchParams.get('country') || 'FR';
    
    if (!date) {
      return NextResponse.json(
        { success: false, error: 'Paramètre "date" requis' },
        { status: 400 }
      );
    }
    
    if (!city) {
      return NextResponse.json(
        { success: false, error: 'Paramètre "city" requis' },
        { status: 400 }
      );
    }
    
    const cityClient = await createCityClient(city, country);
    
    const { data: slots, error } = await cityClient
      .from('time_slots')
      .select('*')
      .eq('date', date)
      .eq('city', city.toUpperCase())
      .order('start_time', { ascending: true });
    
    if (error) {
      console.error('❌ Erreur récupération créneaux:', error);
      return NextResponse.json(
        { success: false, error: 'Erreur lors de la récupération des créneaux' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: slots,
    });
    
  } catch (error) {
    console.error('❌ Erreur GET slots:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/slots
 * Crée un nouveau créneau (staff uniquement)
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
    
    const isStaffUser = await isStaff(user.id);
    if (!isStaffUser) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé - Accès staff uniquement' },
        { status: 403 }
      );
    }
    
    const body: CreateSlotInput = await request.json();
    const { date, start_time, end_time, price, max_participants, city, country, is_recurring } = body;
    
    if (!date || !start_time || !end_time || !city) {
      return NextResponse.json(
        { success: false, error: 'Champs requis manquants: date, start_time, end_time, city' },
        { status: 400 }
      );
    }
    
    // Calculer la durée en minutes
    const [startHour, startMinute] = start_time.split(':').map(Number);
    const [endHour, endMinute] = end_time.split(':').map(Number);
    const duration = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
    
    const cityClient = await createCityClient(city, country || 'FR');
    
    const { data: slot, error } = await cityClient
      .from('time_slots')
      .insert({
        date,
        start_time,
        end_time,
        duration,
        status: 'available',
        price: price || 25,
        max_participants: max_participants || 4,
        current_participants: 0,
        is_recurring: is_recurring || false,
        city: city.toUpperCase(),
        country: country || 'FR',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ Erreur création créneau:', error);
      return NextResponse.json(
        { success: false, error: 'Erreur lors de la création du créneau' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: slot,
      message: 'Créneau créé avec succès',
    });
    
  } catch (error) {
    console.error('❌ Erreur POST slots:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
