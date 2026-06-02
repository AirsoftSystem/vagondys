
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * API de gestion des demandes d'inscription à la messagerie privée
 * 
 * ⚠️ NOTE : La méthode POST a été REMPLACÉE par la Server Action `submitMessagerieRequest`
 * située dans `app/(public)/messagerie/inscription/actions.ts`
 * 
 * La méthode DELETE est conservée pour permettre au staff/admin de supprimer des demandes.
 * 
 * DELETE /api/messagerie/request?id=xxx
 * 
 * Sécurité : Seul le staff/admin peut supprimer une demande
 */
export async function DELETE(request: NextRequest) {
  try {
    // 1. Récupération de l'ID
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID de la demande manquant" },
        { status: 400 }
      );
    }

    // 2. Connexion à Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Variables Supabase manquantes");
      return NextResponse.json(
        { error: "Configuration serveur invalide" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 3. Récupérer l’utilisateur authentifié (vérifier que c'est le staff)
    const { createServerClient } = await import("@supabase/ssr");
    const { cookies } = await import("next/headers");
    
    const cookieStore = await cookies();
    const supabaseServer = createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
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

    // Vérifier que l’utilisateur est staff
    const userEmail = user.email?.toLowerCase() || "";
    const isStaff = userEmail.endsWith("@vagondys.com");
    
    if (!isStaff) {
      const { data: staffRecord } = await supabaseAdmin
        .from("staff_registry")
        .select("email")
        .eq("email", userEmail)
        .maybeSingle();
      
      if (!staffRecord) {
        return NextResponse.json(
          { error: "Accès réservé au staff" },
          { status: 403 }
        );
      }
    }

    // 4. Vérifier que la demande existe
    const { data: existingRequest, error: fetchError } = await supabaseAdmin
      .from("pending_messagerie_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingRequest) {
      return NextResponse.json(
        { error: "Demande introuvable" },
        { status: 404 }
      );
    }

    // 5. Supprimer la demande
    const { error: deleteError } = await supabaseAdmin
      .from("pending_messagerie_requests")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Erreur suppression demande:", deleteError);
      return NextResponse.json(
        { error: "Erreur lors de la suppression" },
        { status: 500 }
      );
    }

    // 6. (Optionnel) Supprimer le fichier KBis de R2 si nécessaire
    if (existingRequest.kbis_key) {
      try {
        const { R2Client } = await import("@/lib/storage/r2-client");
        await R2Client.deletePlayerDocument(existingRequest.kbis_key);
        console.log(`🗑️ Fichier KBis supprimé: ${existingRequest.kbis_key}`);
      } catch (r2Error) {
        console.error("Erreur suppression fichier R2:", r2Error);
        // Non bloquant
      }
    }

    return NextResponse.json({
      success: true,
      message: "Demande supprimée avec succès",
    });
  } catch (error) {
    console.error("Erreur API messagerie/request DELETE:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
