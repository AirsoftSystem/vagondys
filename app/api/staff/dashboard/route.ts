
// app/api/staff/dashboard/route.ts
import { NextResponse } from "next/server";

// Interface pour typer les activités
interface Activity {
  id: string;
  type: "message" | "game_launch" | "match";
  title: string;
  description: string;
  timestamp: string;
  link: string;
}

// Interface pour les stats globales
interface GlobalStats {
  totalAthletes: number;
  totalCities: number;
  totalStaff: number;
  totalMessages: number;
  pendingMessagerieRequests: number;
  activeAthletes: number;
  newAthletesThisMonth: number;
}

// Interface pour les stats par ville
interface CityStats {
  name: string;
  country: string;
  athletes: number;
  active: number;
  messages: number;
}

// Interface pour un athlète (type partiel)
interface AthleteData {
  city: string;
  country: string;
  status?: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get("city");
    const country = searchParams.get("country") || "FR";
    // since est conservé pour compatibilité future mais non utilisé actuellement
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const since = searchParams.get("since");

    if (!city) {
      return NextResponse.json({ error: "Ville manquante" }, { status: 400 });
    }

    // ✅ IMPORT DYNAMIQUE - Chargé UNIQUEMENT à l'exécution, pas au build
    const { createClient } = await import("@supabase/supabase-js");
    
    // ✅ Récupération des variables d'environnement (Version Option B - un seul projet)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    // ✅ VÉRIFICATION CRITIQUE : Les variables doivent exister
    if (!supabaseUrl) {
      console.error("❌ Dashboard API: NEXT_PUBLIC_SUPABASE_URL manquante");
      return NextResponse.json({ error: "Configuration serveur invalide" }, { status: 500 });
    }
    
    if (!supabaseServiceKey) {
      console.error("❌ Dashboard API: SUPABASE_SERVICE_ROLE_KEY manquante");
      return NextResponse.json({ error: "Configuration serveur invalide" }, { status: 500 });
    }
    
    // ✅ Client ADMIN avec SERVICE_ROLE (côté serveur, créé à l'exécution)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const cityUpper = city.toUpperCase().trim();
    const countryUpper = country.toUpperCase().trim();
    
    // ✅ Détection des admins (MASTER) pour qu'ils voient TOUTES les données
    const isAdmin = cityUpper === 'MASTER';

    // Récupérer toutes les données nécessaires pour le dashboard (avec ou sans filtre city selon le rôle)
    let athletesResult, activeAthletesResult, messagesResult, launchesResult, messagerieRequestsResult, staffResult, citiesResult;
    let recentMessagesResult, recentLaunchesResult, recentMatchesResult, topPlayersResult;
    let totalCitiesCount = 0;
    let totalStaffCount = 0;
    let pendingMessagerieCount = 0;
    let totalMessagesCount = 0;

    // ✅ STATS GLOBALES - avec/sans filtre selon isAdmin
    if (isAdmin) {
      // ✅ ADMIN (MASTER) : PAS de filtre city - voit TOUTES les données
      console.log("🔍 Dashboard API: Mode ADMIN - pas de filtre city");
      
      [
        athletesResult, 
        activeAthletesResult, 
        messagesResult, 
        launchesResult,
        messagerieRequestsResult,
        staffResult,
        citiesResult,
        recentMessagesResult, 
        recentLaunchesResult, 
        recentMatchesResult, 
        topPlayersResult
      ] = await Promise.all([
        adminClient.from("athletes").select("*", { count: "exact", head: true }),
        adminClient.from("athletes").select("*", { count: "exact", head: true }).eq("status", "ACTIF"),
        // ✅ CORRECTION : Compter UNIQUEMENT les messages NON LUS (is_read = false)
        // ✅ EXCLURE les messages du staff (sender_email se terminant par @vagondys.com)
        // ✅ EXCLURE les messages du système (system@vagondys.com)
        adminClient.from("messagerie_messages")
          .select("*", { count: "exact", head: true })
          .eq("is_read", false)
          .not("sender_email", "like", "%@vagondys.com")
          .neq("sender_email", "system@vagondys.com"),
        adminClient.from("game_launches").select("*", { count: "exact", head: true }),
        adminClient.from("pending_messagerie_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
        adminClient.from("staff_registry").select("*", { count: "exact", head: true }),
        adminClient.from("athletes").select("city, country, status", { count: "exact", head: false }),
        // ✅ CORRECTION : Récupérer UNIQUEMENT les messages NON LUS récents
        // ✅ EXCLURE les messages du staff et du système
        adminClient.from("messagerie_messages")
          .select("*")
          .eq("is_read", false)
          .not("sender_email", "like", "%@vagondys.com")
          .neq("sender_email", "system@vagondys.com")
          .order("created_at", { ascending: false }).limit(3),
        adminClient.from("game_launches").select("*").order("created_at", { ascending: false }).limit(3),
        adminClient.from("match_history").select("*, athletes(pseudo, full_name)").order("date", { ascending: false }).limit(3),
        adminClient.from("athletes").select("id, pseudo, full_name, points, rank").order("points", { ascending: false }).limit(5),
      ]);
    } else {
      // ✅ AGENT STANDARD : filtre par city ET country
      console.log("🔍 Dashboard API: Mode STANDARD - filtre city=", cityUpper);
      
      [
        athletesResult, 
        activeAthletesResult, 
        messagesResult, 
        launchesResult,
        messagerieRequestsResult,
        staffResult,
        citiesResult,
        recentMessagesResult, 
        recentLaunchesResult, 
        recentMatchesResult, 
        topPlayersResult
      ] = await Promise.all([
        adminClient.from("athletes").select("*", { count: "exact", head: true }).eq("city", cityUpper).eq("country", countryUpper),
        adminClient.from("athletes").select("*", { count: "exact", head: true }).eq("city", cityUpper).eq("country", countryUpper).eq("status", "ACTIF"),
        // ✅ CORRECTION : Compter UNIQUEMENT les messages NON LUS avec filtre city
        // ✅ EXCLURE les messages du staff et du système
        adminClient.from("messagerie_messages")
          .select("*", { count: "exact", head: true })
          .eq("is_read", false)
          .not("sender_email", "like", "%@vagondys.com")
          .neq("sender_email", "system@vagondys.com")
          .in("dossier_ref", (await adminClient
            .from("messagerie_accounts")
            .select("dossier_ref")
            .eq("city", cityUpper)
            .eq("country", countryUpper)
          ).data?.map(a => a.dossier_ref) || []),
        adminClient.from("game_launches").select("*", { count: "exact", head: true }).eq("city", cityUpper).eq("country", countryUpper),
        adminClient.from("pending_messagerie_requests").select("*", { count: "exact", head: true }).eq("city", cityUpper).eq("country", countryUpper).eq("status", "pending"),
        adminClient.from("staff_registry").select("*", { count: "exact", head: true }).eq("city", cityUpper),
        adminClient.from("athletes").select("city, country, status", { count: "exact", head: false }).eq("city", cityUpper).eq("country", countryUpper),
        // ✅ CORRECTION : Récupérer UNIQUEMENT les messages NON LUS récents avec filtre city
        // ✅ EXCLURE les messages du staff et du système
        adminClient.from("messagerie_messages")
          .select("*")
          .eq("is_read", false)
          .not("sender_email", "like", "%@vagondys.com")
          .neq("sender_email", "system@vagondys.com")
          .in("dossier_ref", (await adminClient
            .from("messagerie_accounts")
            .select("dossier_ref")
            .eq("city", cityUpper)
            .eq("country", countryUpper)
          ).data?.map(a => a.dossier_ref) || [])
          .order("created_at", { ascending: false }).limit(3),
        adminClient.from("game_launches").select("*").eq("city", cityUpper).eq("country", countryUpper).order("created_at", { ascending: false }).limit(3),
        adminClient.from("match_history").select("*, athletes(pseudo, full_name)").eq("city", cityUpper).eq("country", countryUpper).order("date", { ascending: false }).limit(3),
        adminClient.from("athletes").select("id, pseudo, full_name, points, rank").eq("city", cityUpper).eq("country", cityUpper).order("points", { ascending: false }).limit(5),
      ]);
    }

    // ✅ Extraction des stats globales
    const totalAthletesCount = athletesResult.count || 0;
    const activeAthletesCount = activeAthletesResult.count || 0;
    totalMessagesCount = messagesResult.count || 0; // ✅ UNIQUEMENT les messages NON LUS (hors staff)
    const totalGameLaunches = launchesResult.count || 0;
    pendingMessagerieCount = messagerieRequestsResult?.count || 0;
    totalStaffCount = staffResult?.count || 0;

    // ✅ Calcul des villes uniques
    const uniqueCities = new Map<string, CityStats>();
    if (citiesResult.data) {
      // Extraire les villes uniques depuis les données des athlètes
      const cityMap = new Map<string, { athletes: number; active: number; messages: number }>();
      
      // Compter par ville
      for (const athlete of citiesResult.data as AthleteData[]) {
        const cityKey = athlete.city;
        if (!cityMap.has(cityKey)) {
          cityMap.set(cityKey, { athletes: 0, active: 0, messages: 0 });
        }
        const stats = cityMap.get(cityKey)!;
        stats.athletes += 1;
        if (athlete.status === "ACTIF") {
          stats.active += 1;
        }
      }

      // ✅ CORRECTION : Ajouter les messages NON LUS par ville (hors staff)
      if (isAdmin) {
        // Récupérer les comptes messagerie avec leur ville
        const { data: accounts } = await adminClient
          .from("messagerie_accounts")
          .select("dossier_ref, city, country");
        
        if (accounts && accounts.length > 0) {
          // Récupérer les messages NON LUS par dossier (hors staff)
          const dossierRefs = accounts.map(a => a.dossier_ref);
          const { data: messages } = await adminClient
            .from("messagerie_messages")
            .select("dossier_ref")
            .eq("is_read", false)
            .not("sender_email", "like", "%@vagondys.com")
            .neq("sender_email", "system@vagondys.com")
            .in("dossier_ref", dossierRefs);
          
          if (messages) {
            // Compter les messages NON LUS par ville via les comptes
            const messageCountByDossier = new Map<string, number>();
            for (const msg of messages) {
              messageCountByDossier.set(msg.dossier_ref, (messageCountByDossier.get(msg.dossier_ref) || 0) + 1);
            }
            
            for (const account of accounts) {
              const cityKey = account.city;
              if (!cityMap.has(cityKey)) {
                cityMap.set(cityKey, { athletes: 0, active: 0, messages: 0 });
              }
              const count = messageCountByDossier.get(account.dossier_ref) || 0;
              cityMap.get(cityKey)!.messages += count;
            }
          }
        }
      } else {
        // Pour les agents, les messages NON LUS sont déjà filtrés par ville (hors staff)
        const { data: accounts } = await adminClient
          .from("messagerie_accounts")
          .select("dossier_ref")
          .eq("city", cityUpper)
          .eq("country", countryUpper);
        
        if (accounts && accounts.length > 0) {
          const dossierRefs = accounts.map(a => a.dossier_ref);
          const { data: messages } = await adminClient
            .from("messagerie_messages")
            .select("dossier_ref")
            .eq("is_read", false)
            .not("sender_email", "like", "%@vagondys.com")
            .neq("sender_email", "system@vagondys.com")
            .in("dossier_ref", dossierRefs);
          
          if (messages) {
            const count = messages.length;
            if (cityMap.has(cityUpper)) {
              cityMap.get(cityUpper)!.messages += count;
            } else {
              cityMap.set(cityUpper, { athletes: 0, active: 0, messages: count });
            }
          }
        }
      }

      // Convertir en tableau
      for (const [name, stats] of cityMap) {
        uniqueCities.set(name, {
          name: name,
          country: countryUpper,
          athletes: stats.athletes,
          active: stats.active,
          messages: stats.messages
        });
      }
    }

    totalCitiesCount = uniqueCities.size;

    // ✅ Calcul des nouveaux athlètes ce mois-ci
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    let newAthletesThisMonth = 0;
    
    if (isAdmin) {
      const { count: newAthletesCount } = await adminClient
        .from("athletes")
        .select("*", { count: "exact", head: true })
        .gte("created_at", firstDayOfMonth);
      newAthletesThisMonth = newAthletesCount || 0;
    } else {
      const { count: newAthletesCount } = await adminClient
        .from("athletes")
        .select("*", { count: "exact", head: true })
        .eq("city", cityUpper)
        .eq("country", countryUpper)
        .gte("created_at", firstDayOfMonth);
      newAthletesThisMonth = newAthletesCount || 0;
    }

    // ✅ Construction des stats globales
    const globalStats: GlobalStats = {
      totalAthletes: totalAthletesCount,
      totalCities: totalCitiesCount,
      totalStaff: totalStaffCount,
      totalMessages: totalMessagesCount, // ✅ UNIQUEMENT les messages NON LUS (hors staff)
      pendingMessagerieRequests: pendingMessagerieCount,
      activeAthletes: activeAthletesCount,
      newAthletesThisMonth: newAthletesThisMonth
    };

    // ✅ Traitement des activités récentes (uniquement messages NON LUS hors staff)
    const activities: Activity[] = [];

    if (recentMessagesResult.data) {
      recentMessagesResult.data.forEach((msg: { id: string; content: string; sender_name: string; created_at: string }) => {
        activities.push({
          id: msg.id,
          type: "message",
          title: "Nouveau message non lu",
          description: `De: ${msg.sender_name || "inconnu"}`,
          timestamp: msg.created_at,
          link: "/staff/admin/messagerie",
        });
      });
    }

    if (recentLaunchesResult.data) {
      recentLaunchesResult.data.forEach(launch => {
        activities.push({
          id: launch.id,
          type: "game_launch",
          title: `Partie ${launch.game_mode} lancée`,
          description: `Par: ${launch.agent_email}`,
          timestamp: launch.created_at,
          link: "/staff/mode_jeux",
        });
      });
    }

    if (recentMatchesResult.data) {
      recentMatchesResult.data.forEach(match => {
        const playerName = match.athletes?.pseudo || match.athletes?.full_name || "Joueur";
        activities.push({
          id: match.id,
          type: "match",
          title: `Match terminé - ${match.win ? "Victoire" : "Défaite"}`,
          description: `${playerName} - ${match.score} pts`,
          timestamp: match.date,
          link: "/staff/licencies",
        });
      });
    }

    // Trier par date décroissante
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // ✅ Traitement des top joueurs
    const topPlayers = [];
    if (topPlayersResult.data) {
      for (const player of topPlayersResult.data) {
        let matchesQuery = adminClient
          .from("match_history")
          .select("*", { count: "exact", head: true })
          .eq("player_id", player.id);
        
        let winsQuery = adminClient
          .from("match_history")
          .select("*", { count: "exact", head: true })
          .eq("player_id", player.id)
          .eq("win", true);
        
        // ✅ Pour les agents standards, ajouter le filtre city/country
        if (!isAdmin) {
          matchesQuery = matchesQuery.eq("city", cityUpper).eq("country", countryUpper);
          winsQuery = winsQuery.eq("city", cityUpper).eq("country", countryUpper);
        }
        
        const { count: matchesPlayed } = await matchesQuery;
        const { count: wins } = await winsQuery;

        const totalMatches = matchesPlayed || 0;
        const winRate = totalMatches > 0 ? Math.round((wins || 0) / totalMatches * 100) : 0;

        topPlayers.push({
          id: player.id,
          pseudo: player.pseudo,
          full_name: player.full_name,
          points: player.points || 0,
          rank: player.rank || "RECRUE",
          matchesPlayed: totalMatches,
          winRate,
        });
      }
    }

    // ✅ Construction de la réponse complète avec les stats globales et par ville
    return NextResponse.json({
      global: globalStats,
      cities: Array.from(uniqueCities.values()),
      totalAthletes: totalAthletesCount,
      activeAthletes: activeAthletesCount,
      pendingMessages: totalMessagesCount, // ✅ UNIQUEMENT les messages NON LUS (hors staff)
      totalGameLaunches: totalGameLaunches,
      recentActivities: activities,
      topPlayers: topPlayers,
    });

  } catch (error) {
    console.error("Erreur API dashboard:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
