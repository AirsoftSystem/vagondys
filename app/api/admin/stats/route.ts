
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * API de statistiques globales pour l’administration
 * GET /api/admin/stats
 * 
 * Retourne les stats globales et par ville
 * Sécurité : Réservé à admin@vagondys.com
 */
export async function GET() {
  try {
    // 1. Vérification des variables d’environnement
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error("Variables Supabase manquantes");
      return NextResponse.json(
        { error: "Configuration serveur invalide" },
        { status: 500 }
      );
    }

    // 2. Récupérer l’utilisateur authentifié
    const cookieStore = await cookies();
    const supabaseServer = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    });

    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // 3. Vérifier que c’est bien admin@vagondys.com
    if (user.email !== "admin@vagondys.com") {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // 4. Connexion admin à Supabase
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Récupérer les statistiques globales

    // Total athlètes
    const { count: totalAthletes } = await supabaseAdmin
      .from("athletes")
      .select("*", { count: "exact", head: true });

    // Athlètes actifs (status = 'ACTIF')
    const { count: activeAthletes } = await supabaseAdmin
      .from("athletes")
      .select("*", { count: "exact", head: true })
      .eq("status", "ACTIF");

    // Athlètes créés ce mois
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    firstDayOfMonth.setHours(0, 0, 0, 0);

    const { count: newAthletesThisMonth } = await supabaseAdmin
      .from("athletes")
      .select("*", { count: "exact", head: true })
      .gte("created_at", firstDayOfMonth.toISOString());

    // Total staff (staff_registry)
    const { count: totalStaff } = await supabaseAdmin
      .from("staff_registry")
      .select("*", { count: "exact", head: true });

    // Total messages non lus (pending_signals)
    const { count: totalMessages } = await supabaseAdmin
      .from("pending_signals")
      .select("*", { count: "exact", head: true })
      .eq("is_read", false);

    // Demandes messagerie en attente
    const { count: pendingMessagerieRequests } = await supabaseAdmin
      .from("pending_messagerie_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    // 6. Récupérer les villes uniques
    const { data: citiesData, error: citiesError } = await supabaseAdmin
      .from("athletes")
      .select("city, country")
      .not("city", "is", null)
      .order("city", { ascending: true });

    if (citiesError) {
      console.error("Erreur récupération villes:", citiesError);
    }

    // Compter les villes uniques
    const uniqueCities = new Set();
    const cityStatsMap = new Map<string, { athletes: number; active: number; messages: number; country: string }>();

    if (citiesData) {
      citiesData.forEach((row) => {
        const cityName = row.city;
        const country = row.country || "FR";
        
        if (cityName) {
          uniqueCities.add(cityName);
          
          if (!cityStatsMap.has(cityName)) {
            cityStatsMap.set(cityName, { athletes: 0, active: 0, messages: 0, country });
          }
          
          const stats = cityStatsMap.get(cityName)!;
          stats.athletes++;
          
          // Compter les actifs pour cette ville
          // On a besoin d’une requête séparée ou de faire un second passage
        }
      });
    }

    // Récupérer les actifs par ville
    const { data: activeCitiesData } = await supabaseAdmin
      .from("athletes")
      .select("city")
      .eq("status", "ACTIF")
      .not("city", "is", null);

    if (activeCitiesData) {
      activeCitiesData.forEach((row) => {
        const cityName = row.city;
        if (cityName && cityStatsMap.has(cityName)) {
          cityStatsMap.get(cityName)!.active++;
        }
      });
    }

    // Récupérer les messages non lus par ville
    const { data: messagesByCity } = await supabaseAdmin
      .from("pending_signals")
      .select("city")
      .eq("is_read", false);

    if (messagesByCity) {
      messagesByCity.forEach((row) => {
        const cityName = row.city;
        if (cityName && cityStatsMap.has(cityName)) {
          cityStatsMap.get(cityName)!.messages++;
        }
      });
    }

    // Convertir la Map en tableau pour la réponse
    const citiesStats = Array.from(cityStatsMap.entries()).map(([name, data]) => ({
      name,
      country: data.country,
      athletes: data.athletes,
      active: data.active,
      messages: data.messages,
    }));

    // Trier par nom de ville
    citiesStats.sort((a, b) => a.name.localeCompare(b.name));

    // 7. Retourner les statistiques
    return NextResponse.json({
      global: {
        totalAthletes: totalAthletes || 0,
        activeAthletes: activeAthletes || 0,
        newAthletesThisMonth: newAthletesThisMonth || 0,
        totalCities: uniqueCities.size,
        totalStaff: totalStaff || 0,
        totalMessages: totalMessages || 0,
        pendingMessagerieRequests: pendingMessagerieRequests || 0,
      },
      cities: citiesStats,
    });
  } catch (error) {
    console.error("Erreur API admin/stats:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
