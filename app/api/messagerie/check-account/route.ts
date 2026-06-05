
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * API de vérification d’un compte messagerie
 * POST /api/messagerie/check-account
 * Body: { userId?, email? }
 * 
 * Vérifie si l’utilisateur a un compte messagerie actif
 * Utilisé par la page de connexion pour éviter d’exposer la clé service role côté client
 * 
 * ✅ CORRECTION : Normalisation de l'email + logs
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Récupération des paramètres
    const body = await request.json();
    const { userId, email: rawEmail } = body;
    
    // Normaliser l'email (casse, espaces)
    let email = rawEmail;
    if (email && typeof email === "string") {
      email = email.toLowerCase().trim();
    }

    // Au moins un des deux est requis
    if (!userId && !email) {
      return NextResponse.json(
        { error: "userId ou email requis" },
        { status: 400 }
      );
    }

    console.log(`🔍 check-account: recherche pour userId=${userId}, email=${email}`);

    // 2. Connexion à Supabase avec la clé service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Variables Supabase manquantes pour check-account");
      return NextResponse.json(
        { error: "Configuration serveur invalide" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 3. Vérifier l’existence du compte messagerie
    // Priorité à l'email si fourni (plus fiable, car user_id peut être null après restauration)
    let query = supabaseAdmin
      .from("messagerie_accounts")
      .select("status, role, dossier_ref, user_id, email");

    if (email) {
      query = query.eq("email", email);
    } else if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data: messagerieAccount, error: fetchError } = await query.maybeSingle();

    if (fetchError) {
      console.error("Erreur vérification messagerie_accounts:", fetchError);
      return NextResponse.json(
        { error: "Erreur lors de la vérification du compte" },
        { status: 500 }
      );
    }

    // 4. Retourner le statut
    if (!messagerieAccount) {
      console.log(`❌ check-account: aucun compte trouvé pour email=${email} ou userId=${userId}`);
      return NextResponse.json({
        isActive: false,
        exists: false,
        message: "Aucun compte messagerie trouvé",
      });
    }

    console.log(`✅ check-account: compte trouvé pour ${messagerieAccount.email}, status=${messagerieAccount.status}`);

    return NextResponse.json({
      isActive: messagerieAccount.status === "active",
      exists: true,
      role: messagerieAccount.role,
      dossier_ref: messagerieAccount.dossier_ref,
      user_id: messagerieAccount.user_id,
      status: messagerieAccount.status,
    });
  } catch (error) {
    console.error("Erreur API check-account:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
