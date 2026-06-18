
import { NextRequest, NextResponse } from "next/server";
import { sendGeneralEmail } from "@/lib/email/gmail";
import { GitHubDB } from "@/lib/github-db/client";

/**
 * Interface pour un message GitHub
 */
interface GitHubMessage {
  id: string;
  dossier_ref: string;
  sender_email: string;
  sender_name: string;
  content: string;
  file_url: string | null;
  file_key: string | null;
  is_read: boolean;
  created_at: string;
}

/**
 * API de définition du mot de passe pour un compte messagerie
 * POST /api/messagerie/set-password
 * Body: { token, email, password }
 * 
 * Vérifie le token de confirmation, puis met à jour le mot de passe de l’utilisateur
 * 
 * ✅ CORRECTION : Passage du statut de "pending" à "active" uniquement ici
 *                 (après que l'utilisateur a défini son mot de passe)
 * ✅ AJOUT : Création du message de bienvenue dans Supabase + GitHub + Email
 * ✅ AJOUT : Logs détaillés pour debug (token, utilisateur, mise à jour)
 * ✅ CORRECTION 2026-06-18 : Envoi d'une notification email au staff pour le message de bienvenue
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

    // 3. Vérifier le token de confirmation
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

    // ✅ 10. CRÉATION DU MESSAGE DE BIENVENUE (Supabase + GitHub + Email + STAFF)
    console.log(`📝 [set-password] Création du message de bienvenue pour ${messagerieAccount.dossier_ref}`);
    
    try {
      const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://vagondys.com";
      const welcomeContent = "Bienvenue sur la messagerie privée VAGONDYS. Notre équipe prendra contact avec vous sous 48h.";
      
      // 10a. Créer le message dans Supabase (instantané)
      const welcomeMessage = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        dossier_ref: messagerieAccount.dossier_ref,
        sender_email: "system@vagondys.com",
        sender_name: "Système VAGONDYS",
        content: welcomeContent,
        file_url: null,
        file_key: null,
        is_read: false,
        created_at: now.toISOString(),
      };

      const { error: insertWelcomeError } = await supabaseAdmin
        .from("messagerie_messages")
        .insert([welcomeMessage]);

      if (insertWelcomeError) {
        console.error(`❌ [set-password] Erreur insertion message bienvenue dans Supabase:`, insertWelcomeError);
      } else {
        console.log(`✅ [set-password] Message de bienvenue créé dans Supabase pour ${messagerieAccount.dossier_ref}`);
      }

      // 10b. Synchroniser vers GitHub (asynchrone, non bloquant)
      try {
        const gitHubPath = `conversations/${messagerieAccount.dossier_ref}/messages.json.gz`;
        let existingMessages: GitHubMessage[] = [];
        try {
          const existing = await GitHubDB.read<GitHubMessage[]>(gitHubPath);
          if (existing && Array.isArray(existing)) {
            existingMessages = existing;
          }
        } catch {
          existingMessages = [];
        }
        
        const exists = existingMessages.some((m: GitHubMessage) => m.id === welcomeMessage.id);
        if (!exists) {
          existingMessages.push(welcomeMessage);
          await GitHubDB.write(gitHubPath, existingMessages, { compress: true });
          console.log(`✅ [set-password] Message de bienvenue synchronisé vers GitHub`);
        }
      } catch (gitHubError) {
        console.error(`⚠️ [set-password] Erreur synchro GitHub (non bloquante):`, gitHubError);
      }

      // 10c. Envoyer l'email de bienvenue au demandeur
      if (userData.user.email) {
        const messagerieUrl = `${frontendUrl}/messagerie/connexion`;
        
        const welcomeEmailHtml = `
          <div style="background:black; color:white; padding:40px; font-family:sans-serif; text-align:center;">
            <div style="margin-bottom:30px;">
              <div style="display:inline-block; padding:10px 20px; border:1px solid #dc2626; border-radius:8px; margin-bottom:20px;">
                <span style="color:#dc2626; font-size:12px; font-weight:900; letter-spacing:3px;">VAGONDYS</span>
              </div>
            </div>
            <h1 style="font-size:18px; font-weight:900; letter-spacing:-1px; text-transform:uppercase; font-style:italic; margin-bottom:20px;">
              Bienvenue <span style="color:#22c55e;">sur VAGONDYS</span>
            </h1>
            <p style="font-size:10px; color:#52525b; text-transform:uppercase; letter-spacing:2px; margin-bottom:30px;">
              Référence Dossier : ${messagerieAccount.dossier_ref}
            </p>
            <div style="margin-bottom:30px; padding:20px; border:1px solid #18181b; background:#09090b; border-radius:12px; text-align:left;">
              <p style="font-size:9px; color:#71717a; text-transform:uppercase; margin-bottom:10px;">Votre compte est maintenant actif.</p>
              <p style="font-size:11px; color:#a1a1aa; line-height:1.6;">
                Bienvenue sur la messagerie privée VAGONDYS. Notre équipe prendra contact avec vous sous 48h.
              </p>
              <p style="font-size:9px; color:#a1a1aa; margin-top:10px;">
                Vous pouvez dès à présent consulter vos messages et échanger avec notre équipe.
              </p>
            </div>
            <a href="${messagerieUrl}" style="background:#dc2626; color:white; padding:15px 30px; text-decoration:none; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:3px; border-radius:8px; display:inline-block; margin:20px 0;">
              ACCÉDER À MA MESSAGERIE
            </a>
            <p style="margin-top:30px; font-size:8px; color:#3f3f46; text-transform:uppercase; letter-spacing:1px;">
              Cet email est généré automatiquement. Merci de ne pas y répondre.
            </p>
            <hr style="margin:30px 0; border-color:#18181b;" />
            <p style="font-size:7px; color:#52525b;">
              VAGONDYS - Messagerie sécurisée
            </p>
          </div>
        `;

        const welcomeTextContent = `VAGONDYS - Bienvenue\n\nBonjour,\n\nBienvenue sur la messagerie privée VAGONDYS.\nNotre équipe prendra contact avec vous sous 48h.\n\nRéférence dossier : ${messagerieAccount.dossier_ref}\n\nAccéder à votre messagerie : ${messagerieUrl}`;

        await sendGeneralEmail(
          userData.user.email,
          "Bienvenue sur VAGONDYS - Messagerie privée",
          welcomeTextContent,
          welcomeEmailHtml,
          "no-reply@vagondys.com"
        );
        
        console.log(`✅ [set-password] Email de bienvenue envoyé à ${userData.user.email}`);
      } else {
        console.warn(`⚠️ [set-password] Email non envoyé - userData.user.email est undefined`);
      }

      // ✅ 10d. CORRECTION : Envoyer une notification au staff
      console.log(`📧 [set-password] Envoi notification staff pour ${messagerieAccount.dossier_ref}`);
      
      const staffEmails = ["vagondys@gmail.com", "admin@vagondys.com"];
      const messagerieAdminUrl = `${frontendUrl}/staff/admin/messagerie`;
      
      const staffNotificationHtml = `
        <div style="background:black; color:white; padding:20px; font-family:sans-serif;">
          <h2 style="color:#22c55e;">✅ Nouveau compte messagerie activé</h2>
          <p><strong>Demandeur :</strong> ${messagerieAccount.full_name}</p>
          <p><strong>Email :</strong> ${messagerieAccount.email}</p>
          <p><strong>Société :</strong> ${messagerieAccount.company || "Non renseignée"}</p>
          <p><strong>Téléphone :</strong> ${messagerieAccount.phone || "Non renseigné"}</p>
          <p><strong>Rôle :</strong> ${messagerieAccount.role || "partner"}</p>
          <p><strong>Référence Dossier :</strong> ${messagerieAccount.dossier_ref}</p>
          <hr style="border-color:#18181b; margin:15px 0;" />
          <p style="color:#a1a1aa; font-size:11px;">
            Un message de bienvenue a été envoyé au partenaire.
            Connectez-vous à l'administration pour lui répondre dans les plus brefs délais.
          </p>
          <a href="${messagerieAdminUrl}" style="background:#dc2626; color:white; padding:10px 20px; text-decoration:none; display:inline-block; margin-top:15px; border-radius:6px; font-size:11px; font-weight:bold; text-transform:uppercase; letter-spacing:1px;">
            Voir la conversation
          </a>
          <hr style="border-color:#18181b; margin:15px 0;" />
          <p style="font-size:8px; color:#52525b; text-transform:uppercase; letter-spacing:1px;">
            VAGONDYS - Notification automatique
          </p>
        </div>
      `;

      const staffTextContent = `✅ Nouveau compte messagerie activé\n\nDemandeur: ${messagerieAccount.full_name}\nEmail: ${messagerieAccount.email}\nSociété: ${messagerieAccount.company || "Non renseignée"}\nRôle: ${messagerieAccount.role || "partner"}\nDossier: ${messagerieAccount.dossier_ref}\n\nVoir la conversation: ${messagerieAdminUrl}`;

      await sendGeneralEmail(
        staffEmails.join(","),
        `✅ VAGONDYS - Nouveau compte activé : ${messagerieAccount.full_name}`,
        staffTextContent,
        staffNotificationHtml,
        "no-reply@vagondys.com"
      );
      
      console.log(`✅ [set-password] Notification staff envoyée pour ${messagerieAccount.dossier_ref}`);

    } catch (welcomeError) {
      console.error(`❌ [set-password] Erreur création message bienvenue:`, welcomeError);
      // Non bloquant - on continue
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
