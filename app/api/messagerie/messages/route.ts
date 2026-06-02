
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendGeneralEmail } from "@/lib/email/gmail";

/**
 * Interface pour un message
 */
interface Message {
  id: string;
  conversation_id: string;
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
 * * GET /api/messagerie/messages?conversationId=xxx
 * - Récupère tous les messages d’une conversation
 * - Marque les messages comme lus (sauf ceux de l’utilisateur)
 * * POST /api/messagerie/messages
 * - Envoie un nouveau message
 * - Body: { conversationId, content, fileUrl?, fileKey? }
 * * Sécurité : L’utilisateur doit être authentifié
 * Ne peut accéder qu’à ses propres conversations
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

    // 3. Récupérer le paramètre conversationId
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId manquant" },
        { status: 400 }
      );
    }

    // 4. Connexion admin pour les opérations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Vérifier que l’utilisateur a accès à cette conversation
    const { data: conversation, error: convError } = await supabaseAdmin
      .from("messagerie_conversations")
      .select("*")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      console.error("Conversation introuvable:", convError);
      return NextResponse.json(
        { error: "Conversation introuvable" },
        { status: 404 }
      );
    }

    // Vérification d’accès
    const hasAccess = isStaff || conversation.participant_email === userEmail;
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Accès non autorisé à cette conversation" },
        { status: 403 }
      );
    }

    // 6. Récupérer les messages
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from("messagerie_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      console.error("Erreur récupération messages:", messagesError);
      return NextResponse.json(
        { error: "Erreur lors de la récupération des messages" },
        { status: 500 }
      );
    }

    // 7. Marquer les messages comme lus (sauf ceux envoyés par l’utilisateur)
    if (messages && messages.length > 0) {
      const unreadMessageIds = (messages as Message[])
        .filter((msg) => !msg.is_read && msg.sender_email !== userEmail)
        .map((msg) => msg.id);

      if (unreadMessageIds.length > 0) {
        const { error: updateError } = await supabaseAdmin
          .from("messagerie_messages")
          .update({ is_read: true })
          .in("id", unreadMessageIds);

        if (updateError) {
          console.error("Erreur marquage messages lus:", updateError);
          // Non bloquant
        }
      }
    }

    return NextResponse.json({
      success: true,
      conversation: {
        id: conversation.id,
        dossier_ref: conversation.dossier_ref,
        participant_email: conversation.participant_email,
        participant_name: conversation.participant_name,
      },
      messages: (messages as Message[]) || [],
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

    // 3. Récupérer le body
    const body = await request.json();
    const { conversationId, content, fileUrl, fileKey } = body;

    if (!conversationId || !content || !content.trim()) {
      return NextResponse.json(
        { error: "conversationId et content sont requis" },
        { status: 400 }
      );
    }

    // 4. Connexion admin pour les opérations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Vérifier que l’utilisateur a accès à cette conversation
    const { data: conversation, error: convError } = await supabaseAdmin
      .from("messagerie_conversations")
      .select("*")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      console.error("Conversation introuvable:", convError);
      return NextResponse.json(
        { error: "Conversation introuvable" },
        { status: 404 }
      );
    }

    // Vérification d’accès
    const hasAccess = isStaff || conversation.participant_email === userEmail;
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Accès non autorisé à cette conversation" },
        { status: 403 }
      );
    }

    // 6. Insérer le nouveau message
    const newMessage: Omit<Message, "id"> = {
      conversation_id: conversationId,
      sender_email: userEmail,
      sender_name: isStaff ? `Staff ${userName}` : userName,
      content: content.trim(),
      file_url: fileUrl || null,
      file_key: fileKey || null,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    const { data: insertedMessage, error: insertError } = await supabaseAdmin
      .from("messagerie_messages")
      .insert([newMessage])
      .select()
      .single();

    if (insertError) {
      console.error("Erreur insertion message:", insertError);
      return NextResponse.json(
        { error: "Erreur lors de l’envoi du message" },
        { status: 500 }
      );
    }

    // 7. Mettre à jour la conversation (last_message, last_message_at)
    const { error: updateConvError } = await supabaseAdmin
      .from("messagerie_conversations")
      .update({
        last_message: content.trim().substring(0, 200),
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    if (updateConvError) {
      console.error("Erreur mise à jour conversation:", updateConvError);
      // Non bloquant
    }

    // 8. Envoyer une notification email (optionnel)
    // Si le message vient d’un partenaire, notifier le staff
    if (!isStaff) {
      const staffEmails = ["admin@vagondys.com", "vagondys@gmail.com"];
      
      const notificationHtml = `
        <div style="background:black; color:white; padding:20px; font-family:sans-serif;">
          <h2 style="color:#dc2626;">📩 Nouveau message de ${conversation.participant_name}</h2>
          <p><strong>Conversation :</strong> ${conversation.dossier_ref}</p>
          <p><strong>Message :</strong></p>
          <div style="background:#09090b; padding:15px; border-radius:8px; margin:10px 0;">
            ${content.trim()}
          </div>
          <a href="https://staff.vagondys.com/staff/admin/messagerie" style="background:#dc2626; color:white; padding:10px 20px; text-decoration:none; display:inline-block; margin-top:20px;">
            Voir la conversation
          </a>
        </div>
      `;

      await sendGeneralEmail(
        staffEmails.join(","),
        `📩 Nouveau message de ${conversation.participant_name}`,
        `Nouveau message dans la conversation ${conversation.dossier_ref}:\n\n${content.trim()}`,
        notificationHtml,
        "no-reply@vagondys.com"
      ).catch(console.error);
    }

    return NextResponse.json({
      success: true,
      message: insertedMessage as Message,
    });
  } catch (error) {
    console.error("Erreur API messagerie/messages POST:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
