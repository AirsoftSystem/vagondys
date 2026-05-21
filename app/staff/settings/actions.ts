"use server";

import { createClient } from "@supabase/supabase-js";

/**
 * ACTION : searchAthleteAction
 * Recherche un athlète dans la base globale via son pseudo ou son email.
 * Utilise obligatoirement les clés de service pour un accès administratif complet.
 */
export async function searchAthleteAction(searchTerm: string) {
  try {
    const cleanSearch = searchTerm.trim();
    if (!cleanSearch) return null;

    // Utilisation des clés Admin (Service Role) pour un accès total sans restrictions RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL_VAGONDYS!,
      process.env.SUPABASE_SERVICE_ROLE_KEY_VAGONDYS!
    );

    // Recherche par pseudo ou email avec insensibilité à la casse (ilike)
    const { data, error } = await supabaseAdmin
      .from('athletes')
      .select('*')
      .or(`pseudo.ilike.%${cleanSearch}%,email.ilike.%${cleanSearch}%`)
      .maybeSingle();

    if (error) {
      console.error("Erreur DB:", error.message);
      throw new Error("ERREUR BASE DE DONNÉES");
    }

    return data; // Renvoie l'objet athlète complet ou null si aucun résultat
  } catch (err) {
    console.error("Action Error:", err);
    throw new Error("ERREUR SERVEUR");
  }
}
