
// app/api/check-athlete/route.ts
import { NextResponse } from "next/server";

/**
 * GET : Recherche d'un athlète par email dans le registre MASTER
 * 
 * @param email - Email de l'athlète (query parameter)
 * @returns { city, country, dossier_ref } ou null si non trouvé
 */
export async function GET(req: Request) {
  try {
    // ✅ IMPORT DYNAMIQUE - Chargé UNIQUEMENT à l'exécution, pas au build
    const { createClient } = await import("@supabase/supabase-js");
    
    // ✅ Récupération des variables (existent à l'exécution)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY_MASTER;
    
    // ✅ Vérification des variables (sans valeurs en dur)
    if (!supabaseUrl || !supabaseKey) {
      console.error("Variables Supabase MASTER manquantes");
      return NextResponse.json(
        { error: "Configuration serveur invalide" },
        { status: 500 }
      );
    }
    
    // Client MASTER (pour le registre) - créé à l'exécution seulement
    const supabaseMaster = createClient(supabaseUrl, supabaseKey);

    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "Paramètre 'email' manquant" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    console.log(`🔍 Recherche athlète dans MASTER: ${normalizedEmail}`);

    // Recherche dans la table athletes_registry du MASTER
    const { data, error } = await supabaseMaster
      .from('athletes_registry')
      .select('city, country, dossier_ref')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (error) {
      console.error("❌ Erreur recherche MASTER:", error.message);
      return NextResponse.json(
        { error: "Erreur lors de la recherche", details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      console.log(`📭 Aucun athlète trouvé pour: ${normalizedEmail}`);
      return NextResponse.json({ found: false, athlete: null });
    }

    console.log(`✅ Athlète trouvé: ${data.city}/${data.country} - Dossier: ${data.dossier_ref}`);

    return NextResponse.json({
      found: true,
      athlete: {
        city: data.city,
        country: data.country,
        dossier_ref: data.dossier_ref
      }
    });

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Erreur interne";
    console.error("❌ Erreur API check-athlete:", errorMessage);
    return NextResponse.json(
      { error: "Erreur serveur", details: errorMessage },
      { status: 500 }
    );
  }
}
