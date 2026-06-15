
// app/api/staff/pending-signals/route.ts
import { NextResponse } from "next/server";
import { getStaffCity } from "@/actions/staff-actions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "pending";

    // ✅ Récupérer la ville de l'agent DEPUIS LA SESSION (Server Action)
    const { city, country, email: agentEmail } = await getStaffCity();

    if (!city || !agentEmail) {
      return NextResponse.json({ error: "Agent non identifié" }, { status: 401 });
    }

    console.log(`🔍 API pending-signals pour ${city} (${country}) - vue: ${view}`);

    // ✅ IMPORT DYNAMIQUE - Chargé UNIQUEMENT à l'exécution, pas au build
    const { createClient } = await import("@supabase/supabase-js");
    
    // ✅ Récupération des variables d'environnement (Version Option B - un seul projet)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    // ✅ VÉRIFICATION CRITIQUE : Les variables doivent exister
    if (!supabaseUrl) {
      console.error("❌ pending-signals API: NEXT_PUBLIC_SUPABASE_URL manquante");
      return NextResponse.json({ error: "Configuration serveur invalide" }, { status: 500 });
    }
    
    if (!supabaseServiceKey) {
      console.error("❌ pending-signals API: SUPABASE_SERVICE_ROLE_KEY manquante");
      return NextResponse.json({ error: "Configuration serveur invalide" }, { status: 500 });
    }
    
    // ✅ Client ADMIN avec SERVICE_ROLE (côté serveur, créé à l'exécution)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const cityUpper = city.toUpperCase().trim();
    const countryUpper = (country || "FR").toUpperCase().trim();
    
    // ✅ DÉTERMINER SI L'AGENT EST ADMIN
    const lowerEmail = agentEmail.toLowerCase();
    const admins = ["contact@vagondys.com", "vagondys@gmail.com", "admin@vagondys.com"];
    const isAdmin = admins.includes(lowerEmail);
    
    // ✅ CONSTRUCTION DE LA REQUÊTE
    let query;
    
    if (isAdmin) {
      // ✅ LES ADMINS VOIENT TOUS LES MESSAGES (y compris ceux avec city = 'MASTER')
      // Pas de filtre par ville pour les admins
      console.log(`🔍 Admin ${agentEmail}: voit TOUS les messages (sans filtre ville)`);
      
      query = adminClient
        .from("pending_signals")
        .select("*")
        .order("created_at", { ascending: false });
    } else {
      // ✅ AGENTS STANDARDS : filtrés par ville
      console.log(`🔍 Agent standard ${agentEmail}: filtré par ville ${cityUpper}`);
      
      query = adminClient
        .from("pending_signals")
        .select("*")
        .eq("city", cityUpper)
        .eq("country", countryUpper)
        .order("created_at", { ascending: false });
    }

    // Filtrer par statut de lecture
    if (view === "pending") {
      query = query.eq("is_read", false);
    } else {
      query = query.eq("is_read", true);
    }

    query = query.eq("confirmed", true);

    // ✅ FILTRAGE PAR RÔLE (pour les agents non-admins uniquement)
    if (!isAdmin) {
      // Déterminer le rôle de l'agent à partir de son email
      let agentRole: string | null = null;
      
      if (lowerEmail.includes("communication")) agentRole = "COMMUNICATION";
      else if (lowerEmail.includes("sponsors")) agentRole = "SPONSORS";
      else if (lowerEmail.includes("ligue")) agentRole = "LIGUE";
      else if (lowerEmail.includes("competition")) agentRole = "COMPETITION";
      else if (lowerEmail.includes("tournois")) agentRole = "TOURNOIS";
      else if (lowerEmail.includes("player")) agentRole = "PLAYER";
      else if (lowerEmail.includes("licence")) agentRole = "LICENCE";
      else if (lowerEmail.includes("reservations")) agentRole = "RESERVATIONS";
      
      if (agentRole) {
        query = query.eq("payload->>subject", agentRole);
        console.log(`🔍 Filtrage par rôle: ${agentRole} pour agent ${agentEmail}`);
      } else {
        console.log(`🔍 Aucun rôle spécifique pour ${agentEmail}, filtrage uniquement par ville: ${cityUpper}`);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error("❌ API pending-signals error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`✅ ${data?.length || 0} messages trouvés pour ${agentEmail}`);
    return NextResponse.json({ messages: data || [], city, country });

  } catch (error) {
    console.error("❌ API pending-signals exception:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
