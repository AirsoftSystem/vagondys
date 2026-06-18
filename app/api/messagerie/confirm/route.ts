
import { NextRequest, NextResponse } from "next/server";

/**
 * API de confirmation du compte messagerie
 * GET /api/messagerie/confirm?token=xxx&email=xxx
 * 
 * Vérifie le token, confirme l'email, puis redirige vers la page de définition du mot de passe
 * 
 * ✅ CORRECTION : Récupère la référence dossier_ref depuis messagerie_accounts
 * ✅ AJOUT : Archivage GitHub après activation (comme pour les athlètes)
 * ✅ CORRECTION : NE PAS modifier le status de messagerie_accounts (reste "pending")
 *                Le passage à "active" se fera uniquement après définition du mot de passe
 * 
 * ⚠️ CORRECTION : Le message de bienvenue a été supprimé (sera envoyé après définition du mot de passe)
 * 
 * ✅ CORRECTION 2026-06-18 : Vérification que le token est bien marqué comme utilisé
 * ✅ CORRECTION 2026-06-18 : Ajout de logs détaillés pour le debug
 * ✅ CORRECTION 2026-06-18 : Redirection vers set-password uniquement si tout est OK
 */
export async function GET(request: NextRequest) {
  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://vagondys.com";
  
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const email = searchParams.get("email");

    console.log(`🔑 [confirm] Début - token: ${token?.substring(0, 8)}..., email: ${email}`);

    if (!token || !email) {
      console.error("❌ [confirm] Paramètres manquants");
      return NextResponse.redirect(
        new URL("/connexion?error=missing_params", frontendUrl)
      );
    }

    // Connexion à Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("❌ [confirm] Variables Supabase manquantes");
      return NextResponse.redirect(
        new URL("/connexion?error=config_error", frontendUrl)
      );
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Vérifier le token
    console.log(`🔍 [confirm] Vérification du token ${token.substring(0, 8)}... pour ${email.toLowerCase()}`);
    
    const { data: confirmation, error: tokenError } = await supabaseAdmin
      .from("email_confirmations")
      .select("*")
      .eq("token", token)
      .eq("email", email.toLowerCase())
      .eq("used", false)
      .single();

    if (tokenError || !confirmation) {
      console.error("❌ [confirm] Token invalide ou déjà utilisé:", tokenError);
      return NextResponse.redirect(
        new URL("/connexion?error=invalid_token", frontendUrl)
      );
    }
    console.log(`✅ [confirm] Token trouvé - id: ${confirmation.id}, user_id: ${confirmation.user_id}`);

    // 2. Vérifier l’expiration
    const now = new Date();
    const expiresAt = new Date(confirmation.expires_at);
    if (expiresAt < now) {
      console.error(`❌ [confirm] Token expiré - expires_at: ${confirmation.expires_at}, now: ${now.toISOString()}`);
      return NextResponse.redirect(
        new URL("/connexion?error=token_expired", frontendUrl)
      );
    }
    console.log(`✅ [confirm] Token valide (non expiré)`);

    // 3. Récupérer l’utilisateur
    console.log(`👤 [confirm] Récupération utilisateur ${confirmation.user_id}`);
    
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      confirmation.user_id
    );

    if (userError || !userData.user) {
      console.error("❌ [confirm] Utilisateur introuvable:", userError);
      return NextResponse.redirect(
        new URL("/connexion?error=user_not_found", frontendUrl)
      );
    }

    const userId = userData.user.id;
    console.log(`✅ [confirm] Utilisateur trouvé - id: ${userId}, email: ${userData.user.email}`);

    // ✅ CORRECTION : Récupérer la référence depuis messagerie_accounts AVANT activation
    const { data: messagerieAccount, error: accountFetchError } = await supabaseAdmin
      .from("messagerie_accounts")
      .select("dossier_ref, full_name, company")
      .eq("user_id", userId)
      .single();

    if (accountFetchError || !messagerieAccount) {
      console.error("❌ [confirm] Compte messagerie introuvable:", accountFetchError);
      return NextResponse.redirect(
        new URL("/connexion?error=account_not_found", frontendUrl)
      );
    }

    const dossierRef = messagerieAccount.dossier_ref;
    const fullName = messagerieAccount.full_name;

    console.log(`✅ [confirm] Dossier trouvé: ${dossierRef} pour ${fullName}`);

    // ✅ 4. CORRECTION : Marquer le token comme utilisé AVEC VÉRIFICATION
    console.log(`🔑 [confirm] Marquage du token ${confirmation.id} comme utilisé`);
    
    const { data: updatedToken, error: updateTokenError } = await supabaseAdmin
      .from("email_confirmations")
      .update({ used: true, used_at: now.toISOString() })
      .eq("id", confirmation.id)
      .select(); // ✅ Vérifier que l'update a bien fonctionné

    if (updateTokenError) {
      console.error("❌ [confirm] Erreur mise à jour token:", {
        message: updateTokenError.message,
        details: updateTokenError.details,
        hint: updateTokenError.hint,
        code: updateTokenError.code,
      });
      // ✅ CORRECTION : Si l'update échoue, on bloque la redirection
      return NextResponse.redirect(
        new URL("/connexion?error=token_update_failed", frontendUrl)
      );
    }
    
    if (!updatedToken || updatedToken.length === 0) {
      console.error("❌ [confirm] Aucune ligne mise à jour pour le token");
      return NextResponse.redirect(
        new URL("/connexion?error=token_update_failed", frontendUrl)
      );
    }
    
    console.log(`✅ [confirm] Token ${confirmation.id} marqué comme utilisé avec succès`);

    // ❌ SUPPRESSION : Ne pas mettre à jour le statut de messagerie_accounts ici
    // Le statut reste "pending" jusqu'à la définition du mot de passe
    // La mise à jour de last_login_at sera faite dans set-password

    // 6. Mettre à jour l’utilisateur Auth (email confirmé)
    console.log(`📧 [confirm] Confirmation email pour ${userId}`);
    
    const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { email_confirm: true }
    );

    if (updateAuthError) {
      console.error("❌ [confirm] Erreur confirmation email Auth:", updateAuthError);
      // Non bloquant - on continue
    } else {
      console.log(`✅ [confirm] Email confirmé dans Auth pour ${userId}`);
    }

    // ✅ Le message de bienvenue a été SUPPRIMÉ d’ici
    // Il sera envoyé dans set-password/page.tsx après définition du mot de passe

    // ✅ AJOUT : Archivage GitHub (comme pour les athlètes dans confirm-email)
    try {
      console.log(`📦 [confirm] Archivage GitHub pour ${dossierRef}`);
      
      const archivePayload = {
        message: {
          dossier_ref: dossierRef,
          created_at: now.toISOString(),
          payload: {
            name: fullName,
            email: email.toLowerCase(),
            company: messagerieAccount.company || null,
            subject: "CONFIRMATION EMAIL MESSAGERIE",
            message: `Email confirmé le ${now.toLocaleString()}`,
            type: "messagerie_confirmation_email",
          },
        },
        history: [],
        purgeActive: false,
        city_code: "MASTER",
        country_code: "FR",
      };

      const archiveRes = await fetch(`${frontendUrl}/api/archive-external`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(archivePayload),
      });

      if (!archiveRes.ok) {
        const errorText = await archiveRes.text();
        console.error("❌ [confirm] Erreur archivage GitHub confirmation:", errorText);
      } else {
        console.log(`✅ [confirm] Archivage GitHub réussi pour ${dossierRef} (confirmation email)`);
      }
    } catch (archiveErr) {
      console.error("❌ [confirm] Erreur lors de l'archivage GitHub (confirmation):", archiveErr);
    }

    // 7. Rediriger vers la page de définition du mot de passe
    console.log(`🔄 [confirm] Redirection vers /messagerie/set-password pour ${email.toLowerCase()}`);
    
    const setPasswordUrl = new URL("/messagerie/set-password", frontendUrl);
    setPasswordUrl.searchParams.set("token", token);
    setPasswordUrl.searchParams.set("email", email.toLowerCase());
    
    return NextResponse.redirect(setPasswordUrl);

  } catch (error) {
    console.error("❌ [confirm] Erreur API messagerie/confirm:", error);
    return NextResponse.redirect(
      new URL("/connexion?error=internal_error", frontendUrl)
    );
  }
}
