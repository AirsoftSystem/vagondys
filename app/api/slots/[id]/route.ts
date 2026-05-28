
/**
 * ==========================================================
 * API SLOTS - GESTION D'UN CRÉNEAU SPÉCIFIQUE
 * ==========================================================
 * GET /api/slots/[id] - Récupère un créneau
 * PUT /api/slots/[id] - Modifie un créneau (staff uniquement)
 * DELETE /api/slots/[id] - Supprime un créneau (staff uniquement)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Types
interface UpdateSlotInput {
  date?: string;
  start_time?: string;
  end_time?: string;
  price?: number;
  max_participants?: number;
  status?: 'available' | 'booked' | 'maintenance';
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
    
    return false;
  } catch (error) {
    console.error('❌ Erreur vérification staff:', error);
    return false;
  }
}

/**
 * Crée un client Supabase pour la ville du créneau
 */
async function getSlotClient(slotCity: string, slotCountry: string = 'FR') {
  const cookieStore = await cookies();
  
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER!;
  let anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_MASTER!;
  
  const cityUpper = slotCity.toUpperCase().trim();
  const countryUpper = slotCountry.toUpperCase().trim();
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
 * GET /api/slots/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID du créneau manquant' },
        { status: 400 }
      );
    }
    
    // Récupérer d'abord le créneau pour connaître sa ville
    const cookieStore = await cookies();
    const masterClient = createServerClient(
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
    
    const { data: slotMeta, error: metaError } = await masterClient
      .from('time_slots')
      .select('city, country')
      .eq('id', id)
      .single();
    
    if (metaError || !slotMeta) {
      return NextResponse.json(
        { success: false, error: 'Créneau non trouvé' },
        { status: 404 }
      );
    }
    
    const cityClient = await getSlotClient(slotMeta.city, slotMeta.country || 'FR');
    
    const { data: slot, error } = await cityClient
      .from('time_slots')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('❌ Erreur récupération créneau:', error);
      return NextResponse.json(
        { success: false, error: 'Créneau non trouvé' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: slot,
    });
    
  } catch (error) {
    console.error('❌ Erreur GET slot:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/slots/[id]
 * Modifie un créneau (staff uniquement)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    
    const { id } = await params;
    const body: UpdateSlotInput = await request.json();
    
    // Récupérer le créneau existant
    const cookieStore = await cookies();
    const masterClient = createServerClient(
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
    
    const { data: existingSlot, error: fetchError } = await masterClient
      .from('time_slots')
      .select('city, country')
      .eq('id', id)
      .single();
    
    if (fetchError || !existingSlot) {
      return NextResponse.json(
        { success: false, error: 'Créneau non trouvé' },
        { status: 404 }
      );
    }
    
    const cityClient = await getSlotClient(existingSlot.city, existingSlot.country || 'FR');
    
    // Préparer les données de mise à jour
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    
    if (body.date) updateData.date = body.date;
    if (body.start_time) updateData.start_time = body.start_time;
    if (body.end_time) updateData.end_time = body.end_time;
    if (body.price !== undefined) updateData.price = body.price;
    if (body.max_participants !== undefined) updateData.max_participants = body.max_participants;
    if (body.status) updateData.status = body.status;
    
    // Recalculer la durée si les heures changent
    if (body.start_time || body.end_time) {
      const startTime = body.start_time || (await cityClient.from('time_slots').select('start_time').eq('id', id).single()).data?.start_time;
      const endTime = body.end_time || (await cityClient.from('time_slots').select('end_time').eq('id', id).single()).data?.end_time;
      
      if (startTime && endTime) {
        const [startHour, startMinute] = startTime.split(':').map(Number);
        const [endHour, endMinute] = endTime.split(':').map(Number);
        updateData.duration = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
      }
    }
    
    const { data: slot, error } = await cityClient
      .from('time_slots')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Erreur mise à jour créneau:', error);
      return NextResponse.json(
        { success: false, error: 'Erreur lors de la mise à jour du créneau' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: slot,
      message: 'Créneau mis à jour avec succès',
    });
    
  } catch (error) {
    console.error('❌ Erreur PUT slot:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/slots/[id]
 * Supprime un créneau (staff uniquement)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    
    const { id } = await params;
    
    // Récupérer le créneau pour connaître sa ville
    const cookieStore = await cookies();
    const masterClient = createServerClient(
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
    
    const { data: existingSlot, error: fetchError } = await masterClient
      .from('time_slots')
      .select('city, country')
      .eq('id', id)
      .single();
    
    if (fetchError || !existingSlot) {
      return NextResponse.json(
        { success: false, error: 'Créneau non trouvé' },
        { status: 404 }
      );
    }
    
    const cityClient = await getSlotClient(existingSlot.city, existingSlot.country || 'FR');
    
    const { error } = await cityClient
      .from('time_slots')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('❌ Erreur suppression créneau:', error);
      return NextResponse.json(
        { success: false, error: 'Erreur lors de la suppression du créneau' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Créneau supprimé avec succès',
    });
    
  } catch (error) {
    console.error('❌ Erreur DELETE slot:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
