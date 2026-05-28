
import nodemailer from "nodemailer";
import crypto from "crypto";
import type { Transporter, SentMessageInfo, SendMailOptions } from "nodemailer";
// getAthleteCountry est importé pour compatibilité future mais non utilisé actuellement
// import { getAthleteCountry } from "../supabase/master";

/**
 * Utilitaire d'envoi d'e-mails via Gmail SMTP (App Password).
 * Version adaptée pour l'Option B (un seul projet Supabase)
 */

/** Crée et retourne le transporter nodemailer configuré pour Gmail SMTP */
function createTransporter(): Transporter<SentMessageInfo> {
  const user = process.env.GMAIL_SMTP_USER;
  const pass = process.env.GMAIL_SMTP_APP_PASSWORD;

  if (!user || !pass) {
    console.error("[EMAIL] GMAIL_SMTP_USER ou GMAIL_SMTP_APP_PASSWORD manquants");
    throw new Error("GMAIL_SMTP_USER et GMAIL_SMTP_APP_PASSWORD doivent être définis dans les env.");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: user,
      pass: pass,
    },
    tls: {
      ciphers: 'SSLv3',
      rejectUnauthorized: false
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  return transporter;
}

/** Génère un token URL-safe pour la confirmation par e-mail */
export function generateVerificationToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * ENVOI GÉNÉRIQUE (Pour Formulaire de Contact et notifications Staff)
 */
export async function sendGeneralEmail(
  to: string,
  subject: string,
  text: string,
  html: string,
  alias?: string
): Promise<SentMessageInfo> {
  const transporter = createTransporter();
  const fromEmail = alias || process.env.GMAIL_SMTP_USER;
  const noReplyEmail = process.env.GMAIL_NOREPLY || "no-reply@vagondys.com";

  const mailOptions: SendMailOptions = {
    from: `"Staff VAGONDYS" <${fromEmail}>`,
    to,
    replyTo: noReplyEmail,
    subject,
    text,
    html,
    priority: "high",
  };

  return await transporter.sendMail(mailOptions);
}

/**
 * ENVOI DE CONFIRMATION (Spécifique Inscription)
 * Version adaptée pour l'Option B (plus de getStationConfig)
 * @param cityCode Code de la ville (ex: NANTES)
 */
export async function sendVerificationEmail(
  to: string,
  confirmUrl: string,
  userName: string,
  cityCode: string,
  sectorName: string = "CELLULE D'ENRÔLEMENT"
): Promise<SentMessageInfo> {
  console.log(`[EMAIL] sendVerificationEmail début - ${to} pour ${cityCode}`);
  
  try {
    const transporter = createTransporter();
    
    // ✅ Option B : Plus de getStationConfig, utilisation directe du cityCode
    const cityName = cityCode.toUpperCase().trim();
    
    const fromEmail = process.env.GMAIL_SMTP_USER || "vagondys@gmail.com";
    const noReplyEmail = process.env.GMAIL_NOREPLY || "no-reply@vagondys.com";
    const fromName = `Staff VAGONDYS ${cityName} (${sectorName})`;
    const senderFull = `"${fromName}" <${fromEmail}>`;

    // FIX ANTI-LOCALHOST : On force l'usage du domaine de production
    const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://vagondys.com";
    let finalConfirmUrl = confirmUrl;
    if (confirmUrl.includes("localhost") || confirmUrl.includes("127.0.0.1")) {
      finalConfirmUrl = confirmUrl.replace(/http:\/\/localhost:\d+/, frontendUrl);
      finalConfirmUrl = finalConfirmUrl.replace(/http:\/\/127\.0\.0\.1:\d+/, frontendUrl);
    }
    
    console.log(`[EMAIL] URL confirmation finale: ${finalConfirmUrl}`);

    const subject = `[ACTION REQUISE] Confirmation Inscription ${cityName} — ${userName}`;

    const html = `
      <div style="background:black; color:white; padding:40px; font-family:sans-serif; text-align:center; max-width: 600px; margin: 0 auto; border-radius: 12px;">
        <h1 style="font-size:18px; font-weight:900; letter-spacing:-1px; text-transform:uppercase; font-style:italic; color:white;">
          <span style="color:#dc2626;">VAGONDYS</span> ${cityName}
        </h1>
        
        <p style="font-size:12px; color:#a1a1aa; margin: 30px 0;">
          Bonjour ${userName}, <br/><br/>
          Pour valider votre dossier d'inscription à la station <strong>${cityName}</strong> et sécuriser votre accès, veuillez confirmer votre adresse e‑mail en cliquant sur le bouton ci-dessous.
        </p>

        <p style="text-align:center; margin:32px 0;">
          <a href="${finalConfirmUrl}" style="background:#dc2626; color:white; padding:20px 40px; text-decoration:none; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:3px; border-radius:8px; display:inline-block;">
            ACTIVER MON ACCÈS
          </a>
        </p>

        <div style="margin-top:40px; padding-top:20px; border-top:1px solid #18181b;">
          <p style="font-size:8px; color:#3f3f46; text-transform:uppercase; letter-spacing:1px; line-height:1.5;">
            SÉCURITÉ : CET EMAIL EST GÉNÉRÉ PAR LA STATION ${cityName}.<br/>
            TOUTE RÉPONSE DIRECTE EST BLOQUÉE PAR LE SERVEUR.<br/>
            TOUTE QUESTION : WWW.VAGONDYS.COM/CONTACT
          </p>
        </div>
      </div>
    `;

    const mailOptions: SendMailOptions = {
      from: senderFull,
      to,
      replyTo: noReplyEmail,
      subject,
      text: `Bonjour ${userName}, pour valider votre dossier VAGONDYS (${cityName}), veuillez confirmer votre e-mail ici : ${finalConfirmUrl}`,
      html,
      priority: "high",
    };

    console.log(`[EMAIL] Envoi de l'email de confirmation à ${to}`);
    const result = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Email de confirmation envoyé avec succès à ${to}`);
    return result;
    
  } catch (error) {
    console.error(`[EMAIL] Erreur lors de l'envoi de l'email de confirmation à ${to}:`, error);
    throw error;
  }
}

/**
 * ENVOI DE BIENVENUE (Après confirmation du compte)
 * Version adaptée pour l'Option B (plus de getStationConfig)
 * @param dossierRef Le matricule unique généré (ex: VGD-A1AA11)
 */
export async function sendWelcomeAthleteEmail(
  to: string,
  userName: string,
  cityCode: string,
  dossierRef: string
): Promise<SentMessageInfo> {
  console.log(`[EMAIL] sendWelcomeAthleteEmail début - ${to} pour ${cityCode}`);
  
  try {
    const transporter = createTransporter();
    
    // ✅ Option B : Utilisation directe du cityCode
    const cityName = cityCode.toUpperCase().trim();
    
    const fromEmail = process.env.GMAIL_SMTP_USER || "vagondys@gmail.com";
    const subject = `[CONFIRMATION] Compte Activé ${cityName} — Bienvenue chez VAGONDYS`;
    
    const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://vagondys.com";
    let finalLoginUrl = `${frontendUrl}/connexion`;
    
    if (finalLoginUrl.includes("localhost")) {
      finalLoginUrl = "https://vagondys.com/connexion";
    }

    const html = `
      <div style="background:black; color:white; padding:40px; font-family:sans-serif; text-align:center; max-width: 600px; margin: 0 auto; border-radius: 12px; border: 1px solid #22c55e;">
        <h1 style="font-size:18px; font-weight:900; letter-spacing:-1px; text-transform:uppercase; font-style:italic; color:white;">
          <span style="color:#22c55e;">VAGONDYS</span> ${cityName}
        </h1>
        <p style="font-size:12px; color:#a1a1aa; margin: 30px 0; line-height:1.6;">
          Bonjour ${userName}, <br/><br/>
          Félicitations ! Votre adresse e-mail pour la station <strong>${cityName}</strong> a été validée avec succès.<br/>
          <strong style="color:white;">VOTRE COMPTE EST DÉSORMAIS PLEINEMENT OPÉRATIONNEL.</strong>
        </p>

        <div style="background:#09090b; border: 1px dashed #22c55e; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <p style="font-size:10px; color:#71717a; text-transform:uppercase; margin-bottom:10px; letter-spacing:1px;">Votre Matricule Unique (N° Dossier) :</p>
          <p style="font-size:24px; font-weight:900; color:#22c55e; letter-spacing:4px; margin:0;">${dossierRef}</p>
        </div>

        <p style="font-size:11px; color:#a1a1aa; margin-bottom: 30px;">
          Veuillez conserver ce matricule précieusement, il sera requis pour toutes vos interactions officielles.
        </p>

        <p style="text-align:center; margin:32px 0;">
          <a href="${finalLoginUrl}" style="background:#22c55e; color:white; padding:20px 40px; text-decoration:none; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:3px; border-radius:8px; display:inline-block;">
            ACCÉDER À MON ESPACE
          </a>
        </p>

        <div style="margin-top:40px; padding-top:20px; border-top:1px solid #18181b;">
          <p style="font-size:8px; color:#3f3f46; text-transform:uppercase; letter-spacing:1px;">
            ÉMIS PAR : DÉPARTEMENT ATHLÈTES | VAGONDYS AUTO-SYSTEM (${cityName})
          </p>
        </div>
      </div>
    `;

    console.log(`[EMAIL] Envoi de l'email de bienvenue à ${to}`);
    const result = await transporter.sendMail({
      from: `"VAGONDYS ${cityName}" <${fromEmail}>`,
      to,
      subject,
      html,
      priority: "high"
    });
    console.log(`[EMAIL] Email de bienvenue envoyé avec succès à ${to}`);
    return result;
    
  } catch (error) {
    console.error(`[EMAIL] Erreur lors de l'envoi de l'email de bienvenue à ${to}:`, error);
    throw error;
  }
}

/**
 * NOTIFICATION STAFF (Nouvelle inscription validée)
 * Version adaptée pour l'Option B (plus de getStationConfig)
 */
export async function sendStaffNotificationEmail(
  athleteEmail: string,
  cityCode: string
): Promise<SentMessageInfo> {
  console.log(`[EMAIL] sendStaffNotificationEmail début - ${athleteEmail} pour ${cityCode}`);
  
  try {
    const transporter = createTransporter();
    
    // ✅ Option B : Utilisation directe du cityCode
    const cityName = cityCode.toUpperCase().trim();
    
    const staffEmail = "vagondys@gmail.com"; 
    const fromEmail = process.env.GMAIL_SMTP_USER || "vagondys@gmail.com";

    const html = `
      <div style="background:#18181b; color:white; padding:20px; font-family:monospace; border-left: 4px solid #dc2626;">
        <p style="font-size:10px; font-weight:bold; color:#dc2626; text-transform:uppercase;">[ALERTE INSCRIPTION - ${cityName}]</p>
        <p style="font-size:12px;">Un nouveau compte athlète vient d'être activé pour la ville : ${cityName}.</p>
        <p style="font-size:12px; color:#facc15;">EMAIL : ${athleteEmail}</p>
        <p style="font-size:10px; color:#52525b; margin-top:20px;">VAGONDYS AUTO-MONITORING | STATION: ${cityCode}</p>
      </div>
    `;

    console.log(`[EMAIL] Envoi de la notification staff pour ${athleteEmail}`);
    const result = await transporter.sendMail({
      from: `"VAGONDYS SYSTEM ${cityName}" <${fromEmail}>`,
      to: staffEmail,
      subject: `[STAFF ${cityCode}] Nouveau compte créé : ${athleteEmail}`,
      html,
      priority: "normal"
    });
    console.log(`[EMAIL] Notification staff envoyée avec succès`);
    return result;
    
  } catch (error) {
    console.error(`[EMAIL] Erreur lors de l'envoi de la notification staff:`, error);
    throw error;
  }
}

/**
 * ENVOI DE NOTIFICATION DE TRANSFERT D'IDENTITÉ
 * Version adaptée pour l'Option B (plus de getStationConfig)
 */
export async function sendIdentityTransferEmail(
  to: string,
  loginUrl: string,
  userName: string,
  cityCode: string,
  sectorName: string = "DÉPARTEMENT SÉCURITÉ"
): Promise<SentMessageInfo> {
  console.log(`[EMAIL] sendIdentityTransferEmail début - ${to} pour ${cityCode}`);
  
  try {
    const transporter = createTransporter();
    
    // ✅ Option B : Utilisation directe du cityCode
    const cityName = cityCode.toUpperCase().trim();

    const fromEmail = process.env.GMAIL_SMTP_USER || "vagondys@gmail.com";
    const noReplyEmail = process.env.GMAIL_NOREPLY || "no-reply@vagondys.com";
    
    const subject = `[ALERTE] Transfert d'Identité ${cityName} — ${userName}`;

    // FIX ANTI-LOCALHOST : On force l'usage du domaine de production
    const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://vagondys.com";
    let finalLoginUrl = loginUrl;
    if (loginUrl.includes("localhost") || loginUrl.includes("127.0.0.1")) {
      finalLoginUrl = loginUrl.replace(/http:\/\/localhost:\d+/, frontendUrl);
      finalLoginUrl = finalLoginUrl.replace(/http:\/\/127\.0\.0\.1:\d+/, frontendUrl);
    }

    const html = `
      <div style="background:black; color:white; padding:40px; font-family:sans-serif; text-align:center; max-width: 600px; margin: 0 auto; border-radius: 12px; border: 1px solid #dc2626;">
        <h1 style="font-size:18px; font-weight:900; letter-spacing:-1px; text-transform:uppercase; font-style:italic; color:white;">
          <span style="color:#dc2626;">VAGONDYS</span> SÉCURITÉ ${cityName}
        </h1>
        
        <p style="font-size:12px; color:#a1a1aa; margin: 30px 0; line-height: 1.6;">
          Bonjour ${userName}, <br/><br/>
          Votre transfert d'identité pour la station <strong>${cityName}</strong> a été validé par nos services. <br/>
          <strong style="color:white;">VOTRE COMPTE EST DÉSORMAIS ACTIF AVEC CETTE ADRESSE EMAIL.</strong><br/><br/>
          L'ancien identifiant a été révoqué. Vous pouvez dès maintenant accéder à votre espace personnel.
        </p>

        <p style="text-align:center; margin:32px 0;">
          <a href="${finalLoginUrl}" style="background:#dc2626; color:white; padding:20px 40px; text-decoration:none; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:3px; border-radius:8px; display:inline-block;">
            ACCÉDER À MON COMPTE
          </a>
        </p>

        <div style="margin-top:40px; padding-top:20px; border-top:1px solid #18181b;">
          <p style="font-size:8px; color:#3f3f46; text-transform:uppercase; letter-spacing:1px; line-height:1.5;">
            INFO : CE MESSAGE CONFIRME LA VALIDATION DE VOTRE NOUVELLE IDENTITÉ POUR ${cityName}.<br/>
            ÉMIS PAR : ${sectorName}.<br/>
            TOUTE CONNEXION AVEC L'ANCIEN MAIL EST DÉSORMAIS IMPOSSIBLE.
          </p>
        </div>
      </div>
    `;

    const mailOptions: SendMailOptions = {
      from: `"VAGONDYS SECURITY ${cityName}" <${fromEmail}>`,
      to,
      replyTo: noReplyEmail,
      subject,
      text: `Bonjour ${userName}, votre transfert d'identité pour ${cityName} est terminé. Connectez-vous ici : ${finalLoginUrl}`,
      html,
      priority: "high",
    };

    console.log(`[EMAIL] Envoi de l'email de transfert d'identité à ${to}`);
    const result = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Email de transfert d'identité envoyé avec succès à ${to}`);
    return result;
    
  } catch (error) {
    console.error(`[EMAIL] Erreur lors de l'envoi de l'email de transfert d'identité à ${to}:`, error);
    throw error;
  }
}
