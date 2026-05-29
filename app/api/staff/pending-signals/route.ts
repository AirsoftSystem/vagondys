
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

    let query = adminClient
      .from("pending_signals")
      .select("*")
      .eq("city", cityUpper)
      .eq("country", countryUpper)
      .order("created_at", { ascending: false });

    // Filtrer par statut de lecture
    if (view === "pending") {
      query = query.eq("is_read", false);
    } else {
      query = query.eq("is_read", true);
    }

    query = query.eq("confirmed", true);

    // ✅ NOUVELLE LOGIQUE DE FILTRAGE PAR MOT-CLÉ
    // Récupérer les catégories centralisées (vont à admin@vagondys.com)
    // et les catégories filtrées par ville
    const lowerEmail = agentEmail.toLowerCase();
    
    // Les admins voient TOUS les messages (pas de filtre)
    const admins = ["contact@vagondys.com", "vagondys@gmail.com", "admin@vagondys.com"];
    const isAdmin = admins.includes(lowerEmail);
    
    if (!isAdmin) {
      // ✅ Déterminer le rôle de l'agent à partir de son email
      let agentRole: string | null = null;
      
      if (lowerEmail.includes("communication")) agentRole = "COMMUNICATION";
      else if (lowerEmail.includes("sponsors")) agentRole = "SPONSORS";
      else if (lowerEmail.includes("ligue")) agentRole = "LIGUE";
      else if (lowerEmail.includes("competition")) agentRole = "COMPETITION";
      else if (lowerEmail.includes("tournois")) agentRole = "TOURNOIS";
      else if (lowerEmail.includes("player")) agentRole = "PLAYER";
      else if (lowerEmail.includes("licence")) agentRole = "LICENCE";
      else if (lowerEmail.includes("reservations")) agentRole = "RESERVATIONS";
      
      // ✅ Si l'agent a un rôle spécifique, filtrer par ce rôle
      if (agentRole) {
        // Les messages avec ce sujet sont envoyés à cet agent
        query = query.eq("payload->>subject", agentRole);
        console.log(`🔍 Filtrage par rôle: ${agentRole} pour agent ${agentEmail}`);
      } else {
        // Fallback : filtrer par la ville (pour les agents génériques comme nantes@vagondys.com)
        console.log(`🔍 Aucun rôle spécifique, filtrage uniquement par ville: ${cityUpper}`);
      }
    } else {
      console.log(`🔍 Admin ${agentEmail}: voit tous les messages`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("❌ API pending-signals error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`✅ ${data?.length || 0} messages trouvés pour ${agentEmail} (${cityUpper})`);
    return NextResponse.json({ messages: data || [], city, country });

  } catch (error) {
    console.error("❌ API pending-signals exception:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
