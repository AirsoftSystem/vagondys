
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Interface pour une conversation
 */
interface Conversation {
  id: string;
  dossier_ref: string;
  participant_email: string;
  participant_name: string;
  participant_company: string | null;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  unread_count: number;
}

/**
 * API de récupération des conversations d’un partenaire
 * GET /api/messagerie/conversations
 * * Sécurité : L’utilisateur doit être authentifié
 * Ne retourne que ses propres conversations
 */
export async function GET() {
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

    // 3. Vérifier que l’utilisateur a un compte messagerie actif
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: messagerieAccount, error: accountError } = await supabaseAdmin
      .from("messagerie_accounts")
      .select("status, role")
      .eq("email", userEmail)
      .maybeSingle();

    if (accountError) {
      console.error("Erreur vérification compte messagerie:", accountError);
    }

    const isStaff = userEmail.endsWith("@vagondys.com");
    const isActivePartner = messagerieAccount?.status === "active";

    if (!isStaff && !isActivePartner) {
      return NextResponse.json(
        { error: "Accès non autorisé. Compte messagerie non actif." },
        { status: 403 }
      );
    }

    // 4. Récupérer les conversations
    let query = supabaseAdmin
      .from("messagerie_conversations")
      .select("*")
      .order("last_message_at", { ascending: false });

    // Si l’utilisateur n’est pas staff, filtrer par son email
    if (!isStaff) {
      query = query.eq("participant_email", userEmail);
    }

    const { data: conversations, error: fetchError } = await query;

    if (fetchError) {
      console.error("Erreur récupération conversations:", fetchError);
      return NextResponse.json(
        { error: "Erreur lors de la récupération des conversations" },
        { status: 500 }
      );
    }

    // 5. Pour chaque conversation, compter les messages non lus
    const conversationsWithUnread: Conversation[] = await Promise.all(
      (conversations || []).map(async (conv) => {
        // Compter les messages non lus où l’utilisateur n’est pas l’expéditeur
        const { count: unreadCount, error: countError } = await supabaseAdmin
          .from("messagerie_messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", conv.id)
          .eq("is_read", false)
          .neq("sender_email", userEmail);

        if (countError) {
          console.error("Erreur comptage messages non lus:", countError);
        }

        return {
          ...conv,
          unread_count: unreadCount || 0,
        };
      })
    );

    return NextResponse.json({
      success: true,
      conversations: conversationsWithUnread,
    });
  } catch (error) {
    console.error("Erreur API messagerie/conversations:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
