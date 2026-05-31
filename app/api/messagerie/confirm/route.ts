
import { NextRequest, NextResponse } from "next/server";

/**
 * API de confirmation du compte messagerie
 * GET /api/messagerie/confirm?token=xxx&email=xxx
 * 
 * Vérifie le token, active le compte, puis redirige vers une page de définition du mot de passe
 */
export async function GET(request: NextRequest) {
  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://vagondys.com";
  
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const email = searchParams.get("email");

    if (!token || !email) {
      return NextResponse.redirect(
        new URL("/connexion?error=missing_params", frontendUrl)
      );
    }

    // Connexion à Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("Variables Supabase manquantes");
      return NextResponse.redirect(
        new URL("/connexion?error=config_error", frontendUrl)
      );
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Vérifier le token
    const { data: confirmation, error: tokenError } = await supabaseAdmin
      .from("email_confirmations")
      .select("*")
      .eq("token", token)
      .eq("email", email.toLowerCase())
      .eq("used", false)
      .single();

    if (tokenError || !confirmation) {
      console.error("Token invalide ou déjà utilisé:", tokenError);
      return NextResponse.redirect(
        new URL("/connexion?error=invalid_token", frontendUrl)
      );
    }

    // 2. Vérifier l’expiration
    const now = new Date();
    const expiresAt = new Date(confirmation.expires_at);
    if (expiresAt < now) {
      return NextResponse.redirect(
        new URL("/connexion?error=token_expired", frontendUrl)
      );
    }

    // 3. Récupérer l’utilisateur
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      confirmation.user_id
    );

    if (userError || !userData.user) {
      console.error("Utilisateur introuvable:", userError);
      return NextResponse.redirect(
        new URL("/connexion?error=user_not_found", frontendUrl)
      );
    }

    const userId = userData.user.id;

    // 4. Marquer le token comme utilisé
    const { error: updateTokenError } = await supabaseAdmin
      .from("email_confirmations")
      .update({ used: true, used_at: now.toISOString() })
      .eq("id", confirmation.id);

    if (updateTokenError) {
      console.error("Erreur mise à jour token:", updateTokenError);
      // Non bloquant
    }

    // 5. Mettre à jour le compte messagerie (statut actif)
    const { error: updateAccountError } = await supabaseAdmin
      .from("messagerie_accounts")
      .update({ status: "active", updated_at: now.toISOString() })
      .eq("user_id", userId);

    if (updateAccountError) {
      console.error("Erreur mise à jour messagerie_accounts:", updateAccountError);
      // Non bloquant
    }

    // 6. Mettre à jour l’utilisateur Auth (email confirmé)
    const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { email_confirm: true }
    );

    if (updateAuthError) {
      console.error("Erreur confirmation email Auth:", updateAuthError);
    }

    // 7. Rediriger vers la page de définition du mot de passe
    // Le token de confirmation est passé pour permettre la réinitialisation
    const setPasswordUrl = new URL("/messagerie/set-password", frontendUrl);
    setPasswordUrl.searchParams.set("token", token);
    setPasswordUrl.searchParams.set("email", email.toLowerCase());
    
    return NextResponse.redirect(setPasswordUrl);

  } catch (error) {
    console.error("Erreur API messagerie/confirm:", error);
    return NextResponse.redirect(
      new URL("/connexion?error=internal_error", frontendUrl)
    );
  }
}
