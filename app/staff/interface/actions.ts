
"use server";

export async function getAgentCity(email: string): Promise<string | null> {
  try {
    // ✅ IMPORT DYNAMIQUE - Chargé UNIQUEMENT à l'exécution, pas au build
    const { createClient } = await import("@supabase/supabase-js");
    
    // ✅ Récupération des variables d'environnement à l'exécution
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY_MASTER;
    
    // ✅ Vérification des variables critiques
    if (!supabaseUrl || !supabaseKey) {
      console.error("Variables Supabase MASTER manquantes dans getAgentCity");
      return null;
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabaseAdmin
      .from("staff_registry")
      .select("city")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (error || !data) return null;
    return data.city;
    
  } catch (error) {
    console.error("Erreur getAgentCity:", error);
    return null;
  }
}
