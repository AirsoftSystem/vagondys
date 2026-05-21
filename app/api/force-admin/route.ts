
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // ✅ IMPORT DYNAMIQUE - Chargé UNIQUEMENT à l'exécution, pas au build
    const { createClient } = await import("@supabase/supabase-js");
    
    // ✅ Récupération des variables d'environnement à l'exécution
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY_MASTER;
    
    // ✅ Vérification des variables critiques
    if (!supabaseUrl || !supabaseKey) {
      console.error("Variables Supabase MASTER manquantes");
      return NextResponse.json({ 
        success: false, 
        error: "Configuration serveur invalide - Variables manquantes" 
      }, { status: 500 });
    }
    
    // Client Admin MASTER - créé à l'exécution seulement
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, { 
      auth: { autoRefreshToken: false, persistSession: false } 
    });

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: 'admin@vagondys.com',
      password: 'Admin/FR/44?',
      email_confirm: true,
      user_metadata: { email_verified: true }
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message });
    }
    return NextResponse.json({ success: true, user: data.user });
    
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("Erreur force-admin:", errorMessage);
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
