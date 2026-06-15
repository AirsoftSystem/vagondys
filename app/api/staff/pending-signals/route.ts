
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
      // ✅ AGENTS STANDARDS : filtrés par ville uniquement (pas de filtre par rôle)
      console.log(`🔍 Agent standard ${agentEmail}: filtré par ville ${cityUpper} (sans filtre rôle)`);
      
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

    // ✅ CORRECTION CRITIQUE :
    // - Vue "pending" : montrer les messages NON confirmés (en attente de validation)
    // - Vue "archived" : montrer les messages confirmés (déjà traités)
    if (view === "pending") {
      query = query.eq("confirmed", false);
      console.log(`🔍 Filtrage: confirmed=false pour la vue pending`);
    } else {
      query = query.eq("confirmed", true);
      console.log(`🔍 Filtrage: confirmed=true pour la vue archived`);
    }

    // ❌ FILTRAGE PAR RÔLE SUPPRIMÉ
    // Les agents standards voient désormais TOUS les messages de leur ville,
    // quel que soit le sujet (PLAYER, COMPETITION, MESSAGE_JOUEUR, etc.)

    const { data, error } = await query;

    if (error) {
      console.error("❌ API pending-signals error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`✅ ${data?.length || 0} messages trouvés pour ${agentEmail} (vue: ${view})`);
    return NextResponse.json({ messages: data || [], city, country });

  } catch (error) {
    console.error("❌ API pending-signals exception:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
