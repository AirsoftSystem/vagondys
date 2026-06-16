
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
 * - Body: { dossierRef, content, fileUrl?, fileKey?, targetCity?, subject? }
 * 
 * ✅ CORRECTION : Plus d'utilisation de messagerie_conversations
 * ✅ CORRECTION : Utilisation directe de dossier_ref comme identifiant
 * ✅ CORRECTION : Vérification des droits via messagerie_accounts
 * ✅ AJOUT : Logs détaillés pour debug
 * ✅ NOUVEAU : Ajout des paramètres targetCity et subject pour l'archivage
 * ✅ NOUVEAU : Synchronisation avec pending_signals (comme le formulaire de contact)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log(`🔍 [GET] Début - ${new Date().toISOString()}`);
  
  try {
    // 1. Vérification des variables d’environnement
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error("❌ [GET] Variables Supabase manquantes");
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
      console.error(`❌ [GET] Non authentifié - authError: ${authError?.message || "no user"}`);
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const userEmail = user.email?.toLowerCase() || "";
    const isStaff = userEmail.endsWith("@vagondys.com");
    console.log(`👤 [GET] Utilisateur: ${userEmail}, isStaff: ${isStaff}`);

    // 3. Récupérer le paramètre dossierRef (au lieu de conversationId)
    const { searchParams } = new URL(request.url);
    const dossierRef = searchParams.get("dossierRef");

    if (!dossierRef) {
      console.error(`❌ [GET] dossierRef manquant`);
      return NextResponse.json(
        { error: "dossierRef manquant" },
        { status: 400 }
      );
    }
    console.log(`📁 [GET] dossierRef: ${dossierRef}`);

    // 4. Connexion admin pour les opérations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Vérifier que l’utilisateur a accès à ce dossier
    let hasAccess = false;
    let participantName = "";
    let participantEmail = "";

    if (isStaff) {
      hasAccess = true;
      console.log(`🔓 [GET] Staff - accès automatique au dossier ${dossierRef}`);
      
      const { data: account, error: accountError } = await supabaseAdmin
        .from("messagerie_accounts")
        .select("full_name, email")
        .eq("dossier_ref", dossierRef)
        .maybeSingle();
      
      if (accountError) {
        console.error(`⚠️ [GET] Erreur récupération compte pour ${dossierRef}:`, accountError.message);
      }
      
      if (account) {
        participantName = account.full_name;
        participantEmail = account.email;
        console.log(`👤 [GET] Participant trouvé: ${participantName} (${participantEmail})`);
      } else {
        console.log(`⚠️ [GET] Aucun compte trouvé pour le dossier ${dossierRef}`);
      }
    } else {
      console.log(`🔍 [GET] Vérification accès partenaire pour ${userEmail} sur ${dossierRef}`);
      
      const { data: account, error: accountError } = await supabaseAdmin
        .from("messagerie_accounts")
        .select("dossier_ref, full_name, email")
        .eq("email", userEmail)
        .eq("dossier_ref", dossierRef)
        .maybeSingle();

      if (accountError) {
        console.error(`⚠️ [GET] Erreur vérification accès partenaire:`, accountError.message);
      }

      if (account) {
        hasAccess = true;
        participantName = account.full_name;
        participantEmail = account.email;
        console.log(`✅ [GET] Accès partenaire validé pour ${dossierRef}`);
      } else {
        console.log(`❌ [GET] Aucun compte trouvé pour ${userEmail} avec dossier ${dossierRef}`);
      }
    }

    if (!hasAccess) {
      console.error(`❌ [GET] Accès non autorisé au dossier ${dossierRef} pour ${userEmail}`);
      return NextResponse.json(
        { error: "Accès non autorisé à cette conversation" },
        { status: 403 }
      );
    }

    // ✅ 6. Lire les messages depuis GITHUB (uniquement)
    const gitHubPath = `conversations/${dossierRef}/messages.json.gz`;
    console.log(`📖 [GET] Lecture GitHub: ${gitHubPath}`);
    
    let messages: GitHubMessage[] = [];
    try {
      const existing = await GitHubDB.read<GitHubMessage[]>(gitHubPath);
      if (existing && Array.isArray(existing)) {
        messages = existing;
        console.log(`✅ [GET] ${messages.length} messages lus depuis GitHub (${gitHubPath})`);
      } else if (existing) {
        console.log(`⚠️ [GET] Données lues mais pas un tableau:`, typeof existing);
        messages = [];
      } else {
        console.log(`ℹ️ [GET] Aucun message trouvé dans GitHub pour ${dossierRef}`);
        messages = [];
      }
    } catch (readError) {
      console.log(`⚠️ [GET] Erreur lecture GitHub (probablement fichier inexistant):`, readError instanceof Error ? readError.message : String(readError));
      messages = [];
    }

    // 7. Trier par date croissante
    messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    if (messages.length > 0) {
      console.log(`📅 [GET] Messages triés, premier: ${messages[0]?.created_at}, dernier: ${messages[messages.length-1]?.created_at}`);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [GET] Terminé en ${duration}ms - ${messages.length} messages retournés`);

    return NextResponse.json({
      success: true,
      dossier_ref: dossierRef,
      participant_email: participantEmail,
      participant_name: participantName,
      messages: messages,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [GET] Erreur après ${duration}ms:`, error instanceof Error ? error.message : String(error));
    console.error("❌ [GET] Stack:", error instanceof Error ? error.stack : "no stack");
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
 * ✅ AJOUT : Logs détaillés pour debug
 * ✅ NOUVEAU : Ajout des paramètres targetCity et subject
 * ✅ NOUVEAU : Synchronisation avec pending_signals (comme le formulaire de contact)
 * 
 * - Notification email au partenaire lorsque le staff envoie un message
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log(`✏️ [POST] Début - ${new Date().toISOString()}`);
  
  try {
    // 1. Vérification des variables d’environnement
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error("❌ [POST] Variables Supabase manquantes");
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
      console.error(`❌ [POST] Non authentifié - authError: ${authError?.message || "no user"}`);
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const userEmail = user.email?.toLowerCase() || "";
    const userName = user.user_metadata?.full_name || userEmail.split("@")[0];
    const isStaff = userEmail.endsWith("@vagondys.com");
    console.log(`👤 [POST] Utilisateur: ${userEmail}, isStaff: ${isStaff}, userName: ${userName}`);

    // 3. Récupérer le body (avec dossierRef + targetCity + subject)
    const body = await request.json();
    const { dossierRef, content, fileUrl, fileKey, targetCity, subject } = body;

    if (!dossierRef || !content || !content.trim()) {
      console.error(`❌ [POST] Paramètres invalides - dossierRef: ${dossierRef}, content length: ${content?.length || 0}`);
      return NextResponse.json(
        { error: "dossierRef et content sont requis" },
        { status: 400 }
      );
    }
    console.log(`📁 [POST] dossierRef: ${dossierRef}, targetCity: ${targetCity || "MASTER"}, subject: ${subject || "COMMUNICATION"}`);

    // 4. Connexion admin pour les opérations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Vérifier que l’utilisateur a accès à ce dossier
    let hasAccess = false;
    let participantEmail = "";
    let participantName = "";

    if (isStaff) {
      hasAccess = true;
      console.log(`🔓 [POST] Staff - accès automatique au dossier ${dossierRef}`);
      
      const { data: account, error: accountError } = await supabaseAdmin
        .from("messagerie_accounts")
        .select("full_name, email")
        .eq("dossier_ref", dossierRef)
        .maybeSingle();
      
      if (accountError) {
        console.error(`⚠️ [POST] Erreur récupération compte:`, accountError.message);
      }
      
      if (account) {
        participantName = account.full_name;
        participantEmail = account.email;
        console.log(`👤 [POST] Participant trouvé: ${participantName} (${participantEmail})`);
      } else {
        console.error(`❌ [POST] Dossier ${dossierRef} non trouvé dans messagerie_accounts`);
        return NextResponse.json(
          { error: "Dossier introuvable" },
          { status: 404 }
        );
      }
    } else {
      console.log(`🔍 [POST] Vérification accès partenaire pour ${userEmail} sur ${dossierRef}`);
      
      const { data: account, error: accountError } = await supabaseAdmin
        .from("messagerie_accounts")
        .select("full_name, email")
        .eq("email", userEmail)
        .eq("dossier_ref", dossierRef)
        .maybeSingle();

      if (accountError) {
        console.error(`⚠️ [POST] Erreur vérification accès partenaire:`, accountError.message);
      }

      if (account) {
        hasAccess = true;
        participantName = account.full_name;
        participantEmail = account.email;
        console.log(`✅ [POST] Accès partenaire validé pour ${dossierRef}`);
      } else {
        console.error(`❌ [POST] Aucun compte trouvé pour ${userEmail} avec dossier ${dossierRef}`);
      }
    }

    if (!hasAccess) {
      console.error(`❌ [POST] Accès non autorisé pour envoyer un message dans ${dossierRef} (${userEmail})`);
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
    console.log(`📝 [POST] Message préparé - id: ${messageId}, sender: ${newMessage.sender_name}`);

    // ✅ 7. Écrire le message UNIQUEMENT dans GITHUB
    const gitHubPath = `conversations/${dossierRef}/messages.json.gz`;
    console.log(`💾 [POST] Tentative d'écriture GitHub: ${gitHubPath}`);
    
    try {
      let existingMessages: GitHubMessage[] = [];
      try {
        const existing = await GitHubDB.read<GitHubMessage[]>(gitHubPath);
        if (existing && Array.isArray(existing)) {
          existingMessages = existing;
          console.log(`📖 [POST] ${existingMessages.length} messages existants lus`);
        } else {
          console.log(`ℹ️ [POST] Aucun message existant, création du fichier`);
          existingMessages = [];
        }
      } catch (readError) {
        console.log(`ℹ️ [POST] Lecture existante échouée:`, readError instanceof Error ? readError.message : String(readError));
        existingMessages = [];
      }
      
      existingMessages.push(newMessage);
      console.log(`📊 [POST] Total messages après ajout: ${existingMessages.length}`);
      
      const writeStartTime = Date.now();
      await GitHubDB.write(gitHubPath, existingMessages, { compress: true });
      const writeDuration = Date.now() - writeStartTime;
      console.log(`✅ [POST] Message écrit dans GitHub en ${writeDuration}ms: ${gitHubPath}`);
      
    } catch (gitHubError) {
      const errorMessage = gitHubError instanceof Error ? gitHubError.message : String(gitHubError);
      const errorStatus = (gitHubError as { status?: number })?.status;
      console.error(`❌ [POST] Erreur écriture GitHub - status: ${errorStatus}, message: ${errorMessage}`);
      
      return NextResponse.json(
        { 
          error: "Erreur lors de l’envoi du message (GitHub)", 
          details: errorMessage,
          status: errorStatus 
        },
        { status: 500 }
      );
    }

    // ✅ 8. Synchronisation avec pending_signals (comme le formulaire de contact)
    try {
      // Récupérer le signal existant pour ce dossier_ref
      const { data: existingSignal } = await supabaseAdmin
        .from("pending_signals")
        .select("payload, dossier_ref")
        .eq("dossier_ref", dossierRef)
        .maybeSingle();

      const signalPayload = {
        name: participantName || userName,
        email: userEmail,
        phone: "",
        subject: subject || "COMMUNICATION",
        message: content.trim(),
        city: targetCity || "MASTER",
        country: "FR",
        messages_history: []
      };

      if (existingSignal) {
        // Mettre à jour le signal existant
        const payload = existingSignal.payload as Record<string, unknown>;
        const messagesHistory = (payload.messages_history as Array<{ content: string; created_at: string }>) || [];
        
        messagesHistory.push({
          content: content.trim(),
          created_at: now
        });

        const updatedPayload = {
          ...payload,
          messages_history: messagesHistory,
          message: content.trim(),
          name: participantName || userName,
          email: userEmail,
          city: targetCity || "MASTER",
          country: "FR",
          subject: subject || "COMMUNICATION"
        };

        await supabaseAdmin
          .from("pending_signals")
          .update({
            payload: updatedPayload,
            is_read: false,
            updated_at: now
          })
          .eq("dossier_ref", dossierRef);

        console.log(`📝 [POST] pending_signals mis à jour pour ${dossierRef}`);
      } else {
        // Créer un nouveau signal
        await supabaseAdmin
          .from("pending_signals")
          .insert({
            dossier_ref: dossierRef,
            payload: signalPayload,
            confirmed: false,
            is_read: false,
            is_new_athlete: false,
            city: targetCity || "MASTER",
            country: "FR",
            created_at: now
          });

        console.log(`📝 [POST] Nouveau pending_signals créé pour ${dossierRef}`);
      }
    } catch (signalError) {
      console.error(`❌ [POST] Erreur synchronisation pending_signals:`, signalError);
      // Non bloquant - on continue
    }

    // ✅ 9. Plus de mise à jour de messagerie_conversations

    // 10. Envoyer une notification email au partenaire lorsque le staff envoie un message
    if (isStaff && participantEmail) {
      console.log(`📧 [POST] Envoi notification email à ${participantEmail}`);
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

      try {
        await sendGeneralEmail(
          participantEmail,
          "📩 VAGONDYS - Nouveau message dans votre messagerie",
          textContent,
          notificationHtml,
          "no-reply@vagondys.com"
        );
        console.log(`✅ [POST] Email notification envoyé à ${participantEmail}`);
      } catch (emailError) {
        console.error(`❌ [POST] Erreur envoi email à ${participantEmail}:`, emailError instanceof Error ? emailError.message : String(emailError));
        // Non bloquant
      }
    }
    
    // 11. Si le message vient d’un partenaire, notifier le staff
    if (!isStaff) {
      console.log(`📧 [POST] Notification staff pour nouveau message de ${participantName}`);
      const staffEmails = ["admin@vagondys.com", "vagondys@gmail.com"];
      const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://vagondys.com";
      
      const notificationHtml = `
        <div style="background:black; color:white; padding:20px; font-family:sans-serif;">
          <h2 style="color:#dc2626;">📩 Nouveau message de ${participantName}</h2>
          <p><strong>Dossier :</strong> ${dossierRef}</p>
          <p><strong>Objet :</strong> ${subject || "COMMUNICATION"}</p>
          <p><strong>Ville cible :</strong> ${targetCity || "MASTER"}</p>
          <p><strong>Message :</strong></p>
          <div style="background:#09090b; padding:15px; border-radius:8px; margin:10px 0;">
            ${content.trim()}
          </div>
          <a href="${frontendUrl}/staff/admin/messagerie" style="background:#dc2626; color:white; padding:10px 20px; text-decoration:none; display:inline-block; margin-top:20px;">
            Voir la conversation
          </a>
        </div>
      `;

      try {
        await sendGeneralEmail(
          staffEmails.join(","),
          `📩 Nouveau message de ${participantName} - ${subject || "COMMUNICATION"}`,
          `Nouveau message dans le dossier ${dossierRef}:\n\nObjet: ${subject || "COMMUNICATION"}\nVille: ${targetCity || "MASTER"}\n\n${content.trim()}`,
          notificationHtml,
          "no-reply@vagondys.com"
        );
        console.log(`✅ [POST] Notification staff envoyée pour ${dossierRef}`);
      } catch (emailError) {
        console.error(`❌ [POST] Erreur envoi notification staff:`, emailError instanceof Error ? emailError.message : String(emailError));
        // Non bloquant
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [POST] Terminé en ${duration}ms - Message envoyé avec succès (targetCity: ${targetCity || "MASTER"}, subject: ${subject || "COMMUNICATION"})`);

    return NextResponse.json({
      success: true,
      message: newMessage,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [POST] Erreur après ${duration}ms:`, error instanceof Error ? error.message : String(error));
    console.error("❌ [POST] Stack:", error instanceof Error ? error.stack : "no stack");
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
