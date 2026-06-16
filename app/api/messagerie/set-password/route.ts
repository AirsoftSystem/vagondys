
import { NextRequest, NextResponse } from "next/server";

/**
 * API de définition du mot de passe pour un compte messagerie
 * POST /api/messagerie/set-password
 * Body: { token, email, password }
 * 
 * Vérifie le token de confirmation, puis met à jour le mot de passe de l’utilisateur
 * 
 * ✅ CORRECTION : Passage du statut de "pending" à "active" uniquement ici
 *                 (après que l'utilisateur a défini son mot de passe)
 * 
 * ✅ AJOUT : Logs détaillés pour debug (token, utilisateur, mise à jour)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log(`🔑 [set-password] Début - ${new Date().toISOString()}`);
  
  try {
    const body = await request.json();
    const { token, email, password } = body;

    console.log(`📝 [set-password] Paramètres reçus - email: ${email?.toLowerCase()}, token: ${token?.substring(0, 8)}..., password length: ${password?.length || 0}`);

    // 1. Validation des paramètres
    if (!token || !email || !password) {
      console.error(`❌ [set-password] Paramètres manquants - token: ${!!token}, email: ${!!email}, password: ${!!password}`);
      return NextResponse.json(
        { error: "Paramètres manquants (token, email, password requis)" },
        { status: 400 }
      );
    }

    // Validation du mot de passe (sécurité)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;
    if (!passwordRegex.test(password)) {
      console.error(`❌ [set-password] Mot de passe invalide - ne respecte pas les règles de sécurité`);
      return NextResponse.json(
        { error: "SÉCURITÉ INSUFFISANTE : 8 CARACTÈRES (MAJ, MIN, CHIFFRE, SYMBOLE) REQUIS." },
        { status: 400 }
      );
    }
    console.log(`✅ [set-password] Mot de passe valide`);

    // 2. Connexion à Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("❌ [set-password] Variables Supabase manquantes");
      return NextResponse.json(
        { error: "Configuration serveur invalide" },
        { status: 500 }
      );
    }
    console.log(`✅ [set-password] Connexion Supabase établie`);

    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 3. Vérifier le token de confirmation (non utilisé)
    console.log(`🔍 [set-password] Recherche token ${token.substring(0, 8)}... pour email ${email.toLowerCase()}`);
    
    const { data: confirmation, error: tokenError } = await supabaseAdmin
      .from("email_confirmations")
      .select("*")
      .eq("token", token)
      .eq("email", email.toLowerCase())
      .eq("used", false)
      .single();

    if (tokenError || !confirmation) {
      console.error(`❌ [set-password] Token invalide ou déjà utilisé - error: ${tokenError?.message}, found: ${!!confirmation}`);
      return NextResponse.json(
        { error: "Lien de confirmation invalide ou expiré" },
        { status: 400 }
      );
    }
    console.log(`✅ [set-password] Token trouvé - id: ${confirmation.id}, user_id: ${confirmation.user_id}, expires_at: ${confirmation.expires_at}`);

    // 4. Vérifier l’expiration du token
    const now = new Date();
    const expiresAt = new Date(confirmation.expires_at);
    if (expiresAt < now) {
      console.error(`❌ [set-password] Token expiré - expires_at: ${confirmation.expires_at}, now: ${now.toISOString()}`);
      return NextResponse.json(
        { error: "Ce lien de confirmation a expiré" },
        { status: 400 }
      );
    }
    console.log(`✅ [set-password] Token valide (non expiré)`);

    // 5. Récupérer l’utilisateur
    console.log(`👤 [set-password] Récupération utilisateur ${confirmation.user_id}`);
    
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      confirmation.user_id
    );

    if (userError || !userData.user) {
      console.error(`❌ [set-password] Utilisateur introuvable - user_id: ${confirmation.user_id}, error: ${userError?.message}`);
      return NextResponse.json(
        { error: "Utilisateur introuvable" },
        { status: 404 }
      );
    }

    const userId = userData.user.id;
    console.log(`✅ [set-password] Utilisateur trouvé - id: ${userId}, email: ${userData.user.email}, email_confirmed_at: ${userData.user.email_confirmed_at}`);

    // 6. Vérifier que l’utilisateur a bien un compte messagerie
    console.log(`🔍 [set-password] Vérification compte messagerie pour user_id ${userId}`);
    
    const { data: messagerieAccount, error: accountError } = await supabaseAdmin
      .from("messagerie_accounts")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (accountError || !messagerieAccount) {
      console.error(`❌ [set-password] Compte messagerie introuvable - user_id: ${userId}, error: ${accountError?.message}`);
      return NextResponse.json(
        { error: "Compte messagerie non trouvé" },
        { status: 404 }
      );
    }
    console.log(`✅ [set-password] Compte messagerie trouvé - dossier_ref: ${messagerieAccount.dossier_ref}, status: ${messagerieAccount.status}`);

    // 7. Mettre à jour le mot de passe de l’utilisateur
    console.log(`🔐 [set-password] Mise à jour du mot de passe pour ${userId}`);
    
    const { error: updatePasswordError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: password }
    );

    if (updatePasswordError) {
      console.error(`❌ [set-password] Erreur mise à jour mot de passe:`, updatePasswordError);
      return NextResponse.json(
        { error: "Erreur lors de la mise à jour du mot de passe" },
        { status: 500 }
      );
    }
    console.log(`✅ [set-password] Mot de passe mis à jour avec succès`);

    // 8. Marquer le token comme utilisé
    console.log(`🔑 [set-password] Marquage du token ${confirmation.id} comme utilisé`);
    
    const { error: updateTokenError } = await supabaseAdmin
      .from("email_confirmations")
      .update({ used: true, used_at: now.toISOString() })
      .eq("id", confirmation.id);

    if (updateTokenError) {
      console.error(`❌ [set-password] Erreur mise à jour token:`, {
        message: updateTokenError.message,
        details: updateTokenError.details,
        hint: updateTokenError.hint,
        code: updateTokenError.code,
      });
      // Non bloquant - on continue
    } else {
      console.log(`✅ [set-password] Token ${confirmation.id} marqué utilisé avec succès`);
    }

    // 9. Mettre à jour le compte messagerie (passage à actif + dernière connexion)
    console.log(`📅 [set-password] Activation du compte pour ${userId} (status: pending → active)`);
    
    const { error: updateAccountError } = await supabaseAdmin
      .from("messagerie_accounts")
      .update({ 
        status: "active",
        last_login_at: now.toISOString(),
        updated_at: now.toISOString()
      })
      .eq("user_id", userId);

    if (updateAccountError) {
      console.error(`❌ [set-password] Erreur mise à jour compte:`, {
        message: updateAccountError.message,
        details: updateAccountError.details,
        hint: updateAccountError.hint,
        code: updateAccountError.code,
      });
      // Non bloquant
    } else {
      console.log(`✅ [set-password] Compte ${messagerieAccount.dossier_ref} activé (status: active, last_login_at mis à jour)`);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [set-password] Terminé en ${duration}ms - Mot de passe défini avec succès pour ${email.toLowerCase()}`);

    return NextResponse.json({
      success: true,
      message: "Mot de passe défini avec succès. Vous pouvez maintenant vous connecter.",
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [set-password] Erreur après ${duration}ms:`, error instanceof Error ? error.message : String(error));
    console.error("❌ [set-password] Stack:", error instanceof Error ? error.stack : "no stack");
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
