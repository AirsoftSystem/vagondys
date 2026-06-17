
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const since = searchParams.get("since");

    if (!city) {
      return NextResponse.json({ error: "Ville manquante" }, { status: 400 });
    }

    // ✅ IMPORT DYNAMIQUE - Chargé UNIQUEMENT à l'exécution, pas au build
    const { createClient } = await import("@supabase/supabase-js");
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl) {
      console.error("❌ Dashboard API: NEXT_PUBLIC_SUPABASE_URL manquante");
      return NextResponse.json({ error: "Configuration serveur invalide" }, { status: 500 });
    }
    
    if (!supabaseServiceKey) {
      console.error("❌ Dashboard API: SUPABASE_SERVICE_ROLE_KEY manquante");
      return NextResponse.json({ error: "Configuration serveur invalide" }, { status: 500 });
    }
    
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const cityUpper = city.toUpperCase().trim();
    const countryUpper = country.toUpperCase().trim();
    const isAdmin = cityUpper === 'MASTER';

    let athletesResult, activeAthletesResult, messagesResult, launchesResult, messagerieRequestsResult, staffResult, citiesResult;
    let recentMessagesResult, recentLaunchesResult, recentMatchesResult, topPlayersResult;
    let totalCitiesCount = 0;
    let totalStaffCount = 0;
    let pendingMessagerieCount = 0;
    let totalMessagesCount = 0;

    // ✅ Pour MASTER : compter depuis messagerie_messages (Système 2 - Messagerie privée)
    // ✅ Pour les autres villes : compter depuis pending_signals (Système 1 - Contact/Staff)
    if (isAdmin) {
      console.log("🔍 Dashboard API: Mode ADMIN - pas de filtre city (messagerie_messages)");
      
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
        // ✅ MASTER : Compter les messages NON LUS depuis messagerie_messages (hors staff)
        adminClient.from("messagerie_messages")
          .select("*", { count: "exact", head: true })
          .eq("is_read", false)
          .not("sender_email", "like", "%@vagondys.com")
          .neq("sender_email", "system@vagondys.com"),
        adminClient.from("game_launches").select("*", { count: "exact", head: true }),
        adminClient.from("pending_messagerie_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
        adminClient.from("staff_registry").select("*", { count: "exact", head: true }),
        adminClient.from("athletes").select("city, country, status", { count: "exact", head: false }),
        // ✅ MASTER : Messages récents depuis messagerie_messages
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
      // ✅ AGENTS STANDARDS (NANTES, LYON, etc.) : compter depuis pending_signals
      console.log(`🔍 Dashboard API: Mode STANDARD - filtre city=${cityUpper} (pending_signals)`);
      
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
        // ✅ STANDARD : Compter les signaux NON LUS depuis pending_signals
        adminClient.from("pending_signals")
          .select("*", { count: "exact", head: true })
          .eq("city", cityUpper)
          .eq("country", countryUpper)
          .eq("is_read", false)
          .eq("confirmed", true),
        adminClient.from("game_launches").select("*", { count: "exact", head: true }).eq("city", cityUpper).eq("country", countryUpper),
        adminClient.from("pending_messagerie_requests").select("*", { count: "exact", head: true }).eq("city", cityUpper).eq("country", countryUpper).eq("status", "pending"),
        adminClient.from("staff_registry").select("*", { count: "exact", head: true }).eq("city", cityUpper),
        adminClient.from("athletes").select("city, country, status", { count: "exact", head: false }).eq("city", cityUpper).eq("country", countryUpper),
        // ✅ STANDARD : Signaux récents depuis pending_signals
        adminClient.from("pending_signals")
          .select("*")
          .eq("city", cityUpper)
          .eq("country", countryUpper)
          .eq("is_read", false)
          .eq("confirmed", true)
          .order("created_at", { ascending: false }).limit(3),
        adminClient.from("game_launches").select("*").eq("city", cityUpper).eq("country", countryUpper).order("created_at", { ascending: false }).limit(3),
        adminClient.from("match_history").select("*, athletes(pseudo, full_name)").eq("city", cityUpper).eq("country", countryUpper).order("date", { ascending: false }).limit(3),
        adminClient.from("athletes").select("id, pseudo, full_name, points, rank").eq("city", cityUpper).eq("country", countryUpper).order("points", { ascending: false }).limit(5),
      ]);
    }

    const totalAthletesCount = athletesResult.count || 0;
    const activeAthletesCount = activeAthletesResult.count || 0;
    totalMessagesCount = messagesResult.count || 0;
    const totalGameLaunches = launchesResult.count || 0;
    pendingMessagerieCount = messagerieRequestsResult?.count || 0;
    totalStaffCount = staffResult?.count || 0;

    // ✅ CALCUL DES VILLES UNIQUES
    const uniqueCities = new Map<string, CityStats>();
    if (citiesResult.data) {
      const cityMap = new Map<string, { athletes: number; active: number; messages: number }>();
      
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

      // ✅ Pour MASTER : compter les messages par ville depuis messagerie_messages
      if (isAdmin) {
        const { data: accounts } = await adminClient
          .from("messagerie_accounts")
          .select("dossier_ref, city, country");
        
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
        // ✅ Pour les agents standards : compter les signaux par ville depuis pending_signals
        const { data: signals } = await adminClient
          .from("pending_signals")
          .select("city, country")
          .eq("city", cityUpper)
          .eq("country", countryUpper)
          .eq("is_read", false)
          .eq("confirmed", true);
        
        if (signals) {
          const count = signals.length;
          if (cityMap.has(cityUpper)) {
            cityMap.get(cityUpper)!.messages += count;
          } else {
            cityMap.set(cityUpper, { athletes: 0, active: 0, messages: count });
          }
        }
      }

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

    const globalStats: GlobalStats = {
      totalAthletes: totalAthletesCount,
      totalCities: totalCitiesCount,
      totalStaff: totalStaffCount,
      totalMessages: totalMessagesCount,
      pendingMessagerieRequests: pendingMessagerieCount,
      activeAthletes: activeAthletesCount,
      newAthletesThisMonth: newAthletesThisMonth
    };

    // ✅ TRAITEMENT DES ACTIVITÉS RÉCENTES
    const activities: Activity[] = [];

    if (recentMessagesResult.data) {
      recentMessagesResult.data.forEach((msg: { id: string; content: string; sender_name: string; created_at: string }) => {
        // ✅ SUPPRESSION de la variable 'type' non utilisée
        activities.push({
          id: msg.id,
          type: "message",
          title: isAdmin ? "Nouveau message non lu" : "Nouveau signal",
          description: `De: ${msg.sender_name || "inconnu"}`,
          timestamp: msg.created_at,
          link: isAdmin ? "/staff/admin/messagerie" : "/staff/interface",
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

    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // ✅ TRAITEMENT DES TOP JOUEURS
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

    // ✅ CONSTRUCTION DE LA RÉPONSE
    return NextResponse.json({
      global: globalStats,
      cities: Array.from(uniqueCities.values()),
      totalAthletes: totalAthletesCount,
      activeAthletes: activeAthletesCount,
      pendingMessages: totalMessagesCount,
      totalGameLaunches: totalGameLaunches,
      recentActivities: activities,
      topPlayers: topPlayers,
    });

  } catch (error) {
    console.error("Erreur API dashboard:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
