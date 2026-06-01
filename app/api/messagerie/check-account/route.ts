
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * API de vérification d’un compte messagerie
 * POST /api/messagerie/check-account
 * Body: { userId }
 * 
 * Vérifie si l’utilisateur a un compte messagerie actif
 * Utilisé par la page de connexion pour éviter d’exposer la clé service role côté client
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Récupération du userId
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId manquant" },
        { status: 400 }
      );
    }

    // 2. Connexion à Supabase avec la clé service role (côté serveur uniquement)
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
    const { data: messagerieAccount, error: fetchError } = await supabaseAdmin
      .from("messagerie_accounts")
      .select("status, role, dossier_ref")
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError) {
      console.error("Erreur vérification messagerie_accounts:", fetchError);
      return NextResponse.json(
        { error: "Erreur lors de la vérification du compte" },
        { status: 500 }
      );
    }

    // 4. Retourner le statut
    if (!messagerieAccount) {
      return NextResponse.json({
        isActive: false,
        exists: false,
        message: "Aucun compte messagerie trouvé pour cet utilisateur",
      });
    }

    return NextResponse.json({
      isActive: messagerieAccount.status === "active",
      exists: true,
      role: messagerieAccount.role,
      dossier_ref: messagerieAccount.dossier_ref,
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
