
import { NextRequest, NextResponse } from "next/server";

/**
 * API de définition du mot de passe pour un compte messagerie
 * POST /api/messagerie/set-password
 * Body: { token, email, password }
 * 
 * Vérifie le token de confirmation, puis met à jour le mot de passe de l’utilisateur
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, email, password } = body;

    // 1. Validation des paramètres
    if (!token || !email || !password) {
      return NextResponse.json(
        { error: "Paramètres manquants (token, email, password requis)" },
        { status: 400 }
      );
    }

    // Validation du mot de passe (sécurité)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return NextResponse.json(
        { error: "SÉCURITÉ INSUFFISANTE : 8 CARACTÈRES (MAJ, MIN, CHIFFRE, SYMBOLE) REQUIS." },
        { status: 400 }
      );
    }

    // 2. Connexion à Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("Variables Supabase manquantes");
      return NextResponse.json(
        { error: "Configuration serveur invalide" },
        { status: 500 }
      );
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 3. Vérifier le token de confirmation (non utilisé)
    const { data: confirmation, error: tokenError } = await supabaseAdmin
      .from("email_confirmations")
      .select("*")
      .eq("token", token)
      .eq("email", email.toLowerCase())
      .eq("used", false)
      .single();

    if (tokenError || !confirmation) {
      console.error("Token invalide ou déjà utilisé:", tokenError);
      return NextResponse.json(
        { error: "Lien de confirmation invalide ou expiré" },
        { status: 400 }
      );
    }

    // 4. Vérifier l’expiration du token
    const now = new Date();
    const expiresAt = new Date(confirmation.expires_at);
    if (expiresAt < now) {
      return NextResponse.json(
        { error: "Ce lien de confirmation a expiré" },
        { status: 400 }
      );
    }

    // 5. Récupérer l’utilisateur
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      confirmation.user_id
    );

    if (userError || !userData.user) {
      console.error("Utilisateur introuvable:", userError);
      return NextResponse.json(
        { error: "Utilisateur introuvable" },
        { status: 404 }
      );
    }

    const userId = userData.user.id;

    // 6. Vérifier que l’utilisateur a bien un compte messagerie
    const { data: messagerieAccount, error: accountError } = await supabaseAdmin
      .from("messagerie_accounts")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (accountError || !messagerieAccount) {
      console.error("Compte messagerie introuvable:", accountError);
      return NextResponse.json(
        { error: "Compte messagerie non trouvé" },
        { status: 404 }
      );
    }

    // 7. Mettre à jour le mot de passe de l’utilisateur
    const { error: updatePasswordError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: password }
    );

    if (updatePasswordError) {
      console.error("Erreur mise à jour mot de passe:", updatePasswordError);
      return NextResponse.json(
        { error: "Erreur lors de la mise à jour du mot de passe" },
        { status: 500 }
      );
    }

    // 8. Marquer le token comme utilisé
    const { error: updateTokenError } = await supabaseAdmin
      .from("email_confirmations")
      .update({ used: true, used_at: now.toISOString() })
      .eq("id", confirmation.id);

    if (updateTokenError) {
      console.error("Erreur mise à jour token:", updateTokenError);
      // Non bloquant
    }

    // 9. Mettre à jour le compte messagerie (dernière connexion)
    const { error: updateAccountError } = await supabaseAdmin
      .from("messagerie_accounts")
      .update({ last_login_at: now.toISOString() })
      .eq("user_id", userId);

    if (updateAccountError) {
      console.error("Erreur mise à jour last_login:", updateAccountError);
      // Non bloquant
    }

    return NextResponse.json({
      success: true,
      message: "Mot de passe défini avec succès. Vous pouvez maintenant vous connecter.",
    });
  } catch (error) {
    console.error("Erreur API messagerie/set-password:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
