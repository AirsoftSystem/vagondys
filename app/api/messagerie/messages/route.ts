
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendGeneralEmail } from "@/lib/email/gmail";
import { GitHubDB } from "@/lib/github-db/client";

/**
 * Interface pour un message (GitHub)
 * ✅ CORRECTION : plus de conversation_id, on utilise dossier_ref comme identifiant
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
 * API de gestion des messages de la messagerie privée
 * * GET /api/messagerie/messages?dossierRef=xxx
 * - Récupère tous les messages d’une conversation depuis GitHub
 * * POST /api/messagerie/messages
 * - Envoie un nouveau message (écriture uniquement dans GitHub)
 * - Body: { dossierRef, content, fileUrl?, fileKey? }
 * 
 * ✅ CORRECTION : Plus d'utilisation de messagerie_conversations
 * ✅ CORRECTION : Utilisation directe de dossier_ref comme identifiant
 * ✅ CORRECTION : Vérification des droits via messagerie_accounts
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Vérification des variables d’environnement
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error("Variables Supabase manquantes");
      return NextResponse.json(
        { error: "Configuration serveur invalide" },
        { status: 500 }
      );
    }

    // 2. Récupérer l’utilisateur authentifié
    const { createServerClient } = await import("@supabase/ssr");
    const { cookies } = await import("next/headers");
    
    const cookieStore = await cookies();
    const supabaseServer = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    });

    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const userEmail = user.email?.toLowerCase() || "";
    const isStaff = userEmail.endsWith("@vagondys.com");

    // 3. Récupérer le paramètre dossierRef (au lieu de conversationId)
    const { searchParams } = new URL(request.url);
    const dossierRef = searchParams.get("dossierRef");

    if (!dossierRef) {
      return NextResponse.json(
        { error: "dossierRef manquant" },
        { status: 400 }
      );
    }

    // 4. Connexion admin pour les opérations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Vérifier que l’utilisateur a accès à ce dossier
    // Le dossier_ref doit exister dans messagerie_accounts (lien email ↔ dossier)
    let hasAccess = false;
    let participantName = "";
    let participantEmail = "";

    if (isStaff) {
      // Le staff a accès à tous les dossiers
      hasAccess = true;
      
      // Récupérer les infos du participant pour l'affichage
      const { data: account } = await supabaseAdmin
        .from("messagerie_accounts")
        .select("full_name, email")
        .eq("dossier_ref", dossierRef)
        .maybeSingle();
      
      if (account) {
        participantName = account.full_name;
        participantEmail = account.email;
      }
    } else {
      // Un partenaire ne peut voir que son propre dossier
      const { data: account, error: accountError } = await supabaseAdmin
        .from("messagerie_accounts")
        .select("dossier_ref, full_name, email")
        .eq("email", userEmail)
        .eq("dossier_ref", dossierRef)
        .maybeSingle();

      if (accountError) {
        console.error("Erreur vérification accès:", accountError);
      }

      if (account) {
        hasAccess = true;
        participantName = account.full_name;
        participantEmail = account.email;
      }
    }

    if (!hasAccess) {
      console.error(`Accès non autorisé au dossier ${dossierRef} pour ${userEmail}`);
      return NextResponse.json(
        { error: "Accès non autorisé à cette conversation" },
        { status: 403 }
      );
    }

    // ✅ 6. Lire les messages depuis GITHUB (uniquement)
    const gitHubPath = `conversations/${dossierRef}/messages.json.gz`;
    
    let messages: GitHubMessage[] = [];
    try {
      const existing = await GitHubDB.read<GitHubMessage[]>(gitHubPath);
      if (existing) {
        messages = existing;
        console.log(`📦 Lecture de ${messages.length} messages depuis GitHub: ${gitHubPath}`);
      }
    } catch {
      console.log(`ℹ️ Aucun message trouvé dans GitHub pour ${dossierRef}`);
      messages = [];
    }

    // 7. Trier par date croissante
    messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return NextResponse.json({
      success: true,
      dossier_ref: dossierRef,
      participant_email: participantEmail,
      participant_name: participantName,
      messages: messages,
    });
  } catch (error) {
    console.error("Erreur API messagerie/messages GET:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/messagerie/messages
 * Envoie un nouveau message
 * 
 * ✅ CORRECTION : Écriture UNIQUEMENT dans GitHub (plus de Supabase)
 * ✅ CORRECTION : Plus de mise à jour de messagerie_conversations
 * 
 * - Notification email au partenaire lorsque le staff envoie un message
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Vérification des variables d’environnement
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error("Variables Supabase manquantes");
      return NextResponse.json(
        { error: "Configuration serveur invalide" },
        { status: 500 }
      );
    }

    // 2. Récupérer l’utilisateur authentifié
    const { createServerClient } = await import("@supabase/ssr");
    const { cookies } = await import("next/headers");
    
    const cookieStore = await cookies();
    const supabaseServer = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    });

    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const userEmail = user.email?.toLowerCase() || "";
    const userName = user.user_metadata?.full_name || userEmail.split("@")[0];
    const isStaff = userEmail.endsWith("@vagondys.com");

    // 3. Récupérer le body (avec dossierRef au lieu de conversationId)
    const body = await request.json();
    const { dossierRef, content, fileUrl, fileKey } = body;

    if (!dossierRef || !content || !content.trim()) {
      return NextResponse.json(
        { error: "dossierRef et content sont requis" },
        { status: 400 }
      );
    }

    // 4. Connexion admin pour les opérations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Vérifier que l’utilisateur a accès à ce dossier
    let hasAccess = false;
    let participantEmail = "";
    let participantName = "";

    if (isStaff) {
      // Le staff a accès à tous les dossiers
      hasAccess = true;
      
      // Récupérer les infos du participant
      const { data: account } = await supabaseAdmin
        .from("messagerie_accounts")
        .select("full_name, email")
        .eq("dossier_ref", dossierRef)
        .maybeSingle();
      
      if (account) {
        participantName = account.full_name;
        participantEmail = account.email;
      } else {
        console.error(`Dossier ${dossierRef} non trouvé dans messagerie_accounts`);
        return NextResponse.json(
          { error: "Dossier introuvable" },
          { status: 404 }
        );
      }
    } else {
      // Un partenaire ne peut envoyer que depuis son propre dossier
      const { data: account, error: accountError } = await supabaseAdmin
        .from("messagerie_accounts")
        .select("full_name, email")
        .eq("email", userEmail)
        .eq("dossier_ref", dossierRef)
        .maybeSingle();

      if (accountError) {
        console.error("Erreur vérification accès:", accountError);
      }

      if (account) {
        hasAccess = true;
        participantName = account.full_name;
        participantEmail = account.email;
      }
    }

    if (!hasAccess) {
      console.error(`Accès non autorisé pour envoyer un message dans ${dossierRef} (${userEmail})`);
      return NextResponse.json(
        { error: "Accès non autorisé à cette conversation" },
        { status: 403 }
      );
    }

    // 6. Préparer le nouveau message
    const now = new Date().toISOString();
    const messageId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

    const newMessage: GitHubMessage = {
      id: messageId,
      dossier_ref: dossierRef,
      sender_email: userEmail,
      sender_name: isStaff ? `Staff ${userName}` : participantName,
      content: content.trim(),
      file_url: fileUrl || null,
      file_key: fileKey || null,
      is_read: false,
      created_at: now,
    };

    // ✅ 7. Écrire le message UNIQUEMENT dans GITHUB
    const gitHubPath = `conversations/${dossierRef}/messages.json.gz`;
    
    try {
      // Lire les messages existants
      let existingMessages: GitHubMessage[] = [];
      try {
        const existing = await GitHubDB.read<GitHubMessage[]>(gitHubPath);
        if (existing) existingMessages = existing;
      } catch {
        // Fichier n'existe pas encore
        existingMessages = [];
      }
      
      // Ajouter le nouveau message
      existingMessages.push(newMessage);
      
      // Écrire dans GitHub (compressé)
      await GitHubDB.write(gitHubPath, existingMessages, { compress: true });
      console.log(`✅ Message écrit dans GitHub: ${gitHubPath}`);
    } catch (gitHubError) {
      console.error("❌ Erreur écriture GitHub:", gitHubError);
      return NextResponse.json(
        { error: "Erreur lors de l’envoi du message (GitHub)" },
        { status: 500 }
      );
    }

    // ✅ 8. Plus de mise à jour de messagerie_conversations (cette table est supprimée de l'architecture)
    // Les métadonnées de conversation sont implicites via le dossier_ref

    // 9. Envoyer une notification email au partenaire lorsque le staff envoie un message
    if (isStaff && participantEmail) {
      const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://vagondys.com";
      
      const notificationHtml = `
        <div style="background:black; color:white; padding:40px; font-family:sans-serif; text-align:center;">
          <div style="margin-bottom:30px;">
            <div style="display:inline-block; padding:10px 20px; border:1px solid #dc2626; border-radius:8px; margin-bottom:20px;">
              <span style="color:#dc2626; font-size:12px; font-weight:900; letter-spacing:3px;">VAGONDYS</span>
            </div>
          </div>
          <h1 style="font-size:18px; font-weight:900; letter-spacing:-1px; text-transform:uppercase; font-style:italic; margin-bottom:20px;">
            Nouveau <span style="color:#22c55e;">message</span>
          </h1>
          <p style="font-size:10px; color:#52525b; text-transform:uppercase; letter-spacing:2px; margin-bottom:30px;">
            Référence Dossier : ${dossierRef}
          </p>
          <div style="margin-bottom:30px; padding:20px; border:1px solid #18181b; background:#09090b; border-radius:12px; text-align:left;">
            <p style="font-size:9px; color:#71717a; text-transform:uppercase; margin-bottom:10px;">
              Vous avez reçu un nouveau message de la part de l'équipe VAGONDYS.
            </p>
            <p style="font-size:11px; color:#a1a1aa; line-height:1.6;">
              Connectez-vous à votre messagerie privée pour consulter et répondre à ce message.
            </p>
          </div>
          <a href="${frontendUrl}/messagerie" style="background:#dc2626; color:white; padding:15px 30px; text-decoration:none; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:3px; border-radius:8px; display:inline-block; margin:20px 0;">
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

      const textContent = `VAGONDYS - Nouveau message\n\nBonjour ${participantName},\n\nVous avez reçu un nouveau message de l'équipe VAGONDYS.\n\nConnectez-vous à votre messagerie privée pour le consulter : ${frontendUrl}/messagerie\n\nRéférence dossier : ${dossierRef}`;

      await sendGeneralEmail(
        participantEmail,
        "📩 VAGONDYS - Nouveau message dans votre messagerie",
        textContent,
        notificationHtml,
        "no-reply@vagondys.com"
      ).catch(console.error);
      
      console.log(`📧 Email de notification envoyé à ${participantEmail} (nouveau message staff)`);
    }
    
    // 10. Si le message vient d’un partenaire, notifier le staff
    if (!isStaff) {
      const staffEmails = ["admin@vagondys.com", "vagondys@gmail.com"];
      const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://vagondys.com";
      
      const notificationHtml = `
        <div style="background:black; color:white; padding:20px; font-family:sans-serif;">
          <h2 style="color:#dc2626;">📩 Nouveau message de ${participantName}</h2>
          <p><strong>Dossier :</strong> ${dossierRef}</p>
          <p><strong>Message :</strong></p>
          <div style="background:#09090b; padding:15px; border-radius:8px; margin:10px 0;">
            ${content.trim()}
          </div>
          <a href="${frontendUrl}/staff/admin/messagerie" style="background:#dc2626; color:white; padding:10px 20px; text-decoration:none; display:inline-block; margin-top:20px;">
            Voir la conversation
          </a>
        </div>
      `;

      await sendGeneralEmail(
        staffEmails.join(","),
        `📩 Nouveau message de ${participantName}`,
        `Nouveau message dans le dossier ${dossierRef}:\n\n${content.trim()}`,
        notificationHtml,
        "no-reply@vagondys.com"
      ).catch(console.error);
    }

    return NextResponse.json({
      success: true,
      message: newMessage,
    });
  } catch (error) {
    console.error("Erreur API messagerie/messages POST:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
