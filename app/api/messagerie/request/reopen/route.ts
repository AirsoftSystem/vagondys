
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendGeneralEmail } from "@/lib/email/gmail";

/**
 * API de réouverture d’une demande d’inscription à la messagerie privée
 * POST /api/messagerie/request/reopen
 * Body: { requestId }
 * 
 * Remet une demande en statut "pending" (en attente)
 * 
 * Sécurité : Seul le staff/admin peut réouvrir une demande
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Récupération des paramètres
    const body = await request.json();
    const { requestId } = body;

    if (!requestId) {
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
      .eq("id", requestId)
      .single();

    if (fetchError || !existingRequest) {
      return NextResponse.json(
        { error: "Demande introuvable" },
        { status: 404 }
      );
    }

    // 5. Vérifier que la demande n'est pas déjà en attente
    if (existingRequest.status === "pending") {
      return NextResponse.json(
        { error: "Cette demande est déjà en attente." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // 6. Mettre à jour le statut de la demande
    const { error: updateError } = await supabaseAdmin
      .from("pending_messagerie_requests")
      .update({
        status: "pending",
        reviewed_by: null,
        reviewed_at: null,
        updated_at: now,
      })
      .eq("id", requestId);

    if (updateError) {
      console.error("Erreur mise à jour demande:", updateError);
      return NextResponse.json(
        { error: "Erreur lors de la réouverture de la demande" },
        { status: 500 }
      );
    }

    // 7. Envoyer un email de notification au demandeur
    const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://vagondys.com";
    const displayId = requestId.substring(0, 8).toUpperCase();

    const reopenHtml = `
      <div style="background:black; color:white; padding:40px; font-family:sans-serif; text-align:center;">
        <h1 style="font-size:18px; font-weight:900; letter-spacing:-1px; text-transform:uppercase; font-style:italic;">
          Demande <span style="color:#facc15;">réouverte</span>
        </h1>
        <p style="font-size:10px; color:#52525b; text-transform:uppercase; letter-spacing:2px; margin-bottom:30px;">
          Référence : ${displayId}
        </p>
        <div style="margin-bottom:30px; padding:20px; border:1px solid #18181b; background:#09090b; border-radius:12px; text-align:left;">
          <p style="font-size:9px; color:#71717a; text-transform:uppercase; margin-bottom:10px;">Votre demande a été réouverte.</p>
          <p style="font-size:12px; color:#a1a1aa;">
            Notre équipe va réexaminer votre dossier. Vous recevrez une réponse dans les plus brefs délais.
          </p>
        </div>
        <a href="${frontendUrl}/messagerie/connexion" style="background:#dc2626; color:white; padding:15px 30px; text-decoration:none; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:3px; border-radius:8px; display:inline-block; margin:20px 0;">
          Suivre ma demande
        </a>
        <p style="font-size:10px; color:#52525b;">
          Vous pouvez vous connecter pour suivre l'évolution de votre dossier.
        </p>
      </div>
    `;

    await sendGeneralEmail(
      existingRequest.email,
      "VAGONDYS - Votre demande a été réouverte",
      `Votre demande (${displayId}) a été réouverte par notre équipe.`,
      reopenHtml,
      "no-reply@vagondys.com"
    ).catch(console.error);

    // 8. Envoyer un email de notification au staff (optionnel)
    const adminEmail = process.env.ADMIN_EMAIL || "admin@vagondys.com";
    
    const staffNotificationHtml = `
      <div style="background:black; color:white; padding:20px; font-family:sans-serif;">
        <h2 style="color:#facc15;">🔄 Demande réouverte</h2>
        <p><strong>Demandeur :</strong> ${existingRequest.full_name}</p>
        <p><strong>Email :</strong> ${existingRequest.email}</p>
        <p><strong>Société :</strong> ${existingRequest.company || "Non renseignée"}</p>
        <p><strong>Motif :</strong> ${existingRequest.reason}</p>
        <hr />
        <p><strong>Référence :</strong> ${displayId}</p>
        <p><strong>Réouverte par :</strong> ${user.email}</p>
        <a href="${frontendUrl}/staff/admin/messagerie" style="background:#dc2626; color:white; padding:10px 20px; text-decoration:none; display:inline-block; margin-top:20px;">
          Voir la demande
        </a>
      </div>
    `;

    await sendGeneralEmail(
      adminEmail,
      "🔄 VAGONDYS - Une demande a été réouverte",
      `La demande de ${existingRequest.full_name} (${displayId}) a été réouverte.`,
      staffNotificationHtml,
      "no-reply@vagondys.com"
    ).catch(console.error);

    return NextResponse.json({
      success: true,
      message: "Demande réouverte avec succès",
      status: "pending",
    });
  } catch (error) {
    console.error("Erreur API messagerie/request/reopen:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
