
/**
 * ==========================================================
 * API PLAYER MESSAGE - ENVOI DE MESSAGE JOUEUR
 * ==========================================================
 * POST /api/player/message
 * Body: { dossierRef, content, targetCity?, subject?, fileUrl?, fileKey? }
 * 
 * Cette API est dédiée aux joueurs authentifiés.
 * Elle écrit UNIQUEMENT dans GitHub (comme l'interface Super Admin).
 * 
 * ✅ CORRECTION : Écriture UNIQUEMENT dans GitHub
 * ✅ CORRECTION : Plus d'écriture dans pending_signals (réservé au formulaire de contact)
 * ✅ CORRECTION : Plus d'écriture dans communication_replies (réservé au staff)
 * ✅ CORRECTION : fileKey n'est pas utilisé (seul fileUrl est nécessaire pour le joueur)
 * ✅ NOUVEAU : Ajout du paramètre subject (objet du signal)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendGeneralEmail } from "@/lib/email/gmail";
import { GitHubDB } from "@/lib/github-db/client";

// ==========================================================
// CONFIGURATION
// ==========================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ==========================================================
// TYPES
// ==========================================================

interface PlayerMessageRequest {
  dossierRef: string;
  content: string;
  targetCity?: string;
  subject?: string;
  fileUrl?: string;
  fileKey?: string;
}

interface PlayerInfo {
  userId: string;
  userEmail: string;
  userName: string;
  playerCity: string;
  playerCountry: string;
}

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

// ==========================================================
// FONCTIONS UTILITAIRES
// ==========================================================

/**
 * Vérifie l'authentification et récupère les infos du joueur
 */
async function authenticateAndGetPlayerInfo(
  request: NextRequest
): Promise<PlayerInfo | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    console.error("❌ [player/message] Token manquant");
    return null;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("❌ [player/message] Configuration Supabase manquante");
    return null;
  }

  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await supabaseClient.auth.getUser(token);

  if (error || !user) {
    console.error("❌ [player/message] Auth invalide:", error?.message);
    return null;
  }

  const userEmail = user.email?.toLowerCase() || "";
  const userId = user.id;
  const userName = user.user_metadata?.full_name || user.user_metadata?.pseudo || "Joueur";

  console.log(`🔐 [player/message] Utilisateur authentifié: ${userEmail}`);

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ [player/message] Service key manquante");
    return null;
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  let { data: registry } = await supabaseAdmin
    .from("athletes_registry")
    .select("dossier_ref, city, country")
    .eq("user_id", userId)
    .maybeSingle();

  if (!registry) {
    const { data: registryByEmail } = await supabaseAdmin
      .from("athletes_registry")
      .select("dossier_ref, city, country")
      .eq("email", userEmail)
      .maybeSingle();
    registry = registryByEmail;
  }

  if (!registry || !registry.dossier_ref) {
    console.error("❌ [player/message] Aucun dossier_ref trouvé pour", { userId, userEmail });
    return null;
  }

  console.log(`📍 [player/message] Joueur: ${registry.city}/${registry.country}`);

  return {
    userId,
    userEmail,
    userName,
    playerCity: registry.city || "NANTES",
    playerCountry: registry.country || "FR",
  };
}

/**
 * ✅ Sauvegarde le message UNIQUEMENT dans GitHub
 */
async function saveMessageToGitHub(
  dossierRef: string,
  playerEmail: string,
  playerName: string,
  content: string,
  subject?: string,
  fileUrl?: string,
  fileKey?: string
): Promise<boolean> {
  const path = `conversations/${dossierRef}/messages.json.gz`;
  console.log(`💾 [player/message] Écriture GitHub: ${path}`);

  try {
    // Lire les messages existants
    let existingMessages: GitHubMessage[] = [];
    try {
      const existing = await GitHubDB.read<GitHubMessage[]>(path);
      if (existing && Array.isArray(existing)) {
        existingMessages = existing;
        console.log(`📖 [player/message] ${existingMessages.length} messages existants lus`);
      }
    } catch {
      existingMessages = [];
    }

    // Préparer le nouveau message
    const now = new Date().toISOString();
    const messageId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

    const newMessage: GitHubMessage = {
      id: messageId,
      dossier_ref: dossierRef,
      sender_email: playerEmail,
      sender_name: playerName,
      content: content.trim(),
      file_url: fileUrl || null,
      file_key: fileKey || null,
      is_read: false,
      created_at: now,
    };

    // Ajouter le message
    existingMessages.push(newMessage);
    console.log(`📊 [player/message] Total messages après ajout: ${existingMessages.length}`);

    // Écrire dans GitHub (compressé)
    await GitHubDB.write(path, existingMessages, { compress: true });
    console.log(`✅ [player/message] Message écrit dans GitHub: ${path}`);

    return true;
  } catch (err) {
    console.error(`❌ [player/message] Erreur écriture GitHub:`, err);
    return false;
  }
}

// ==========================================================
// API ROUTES
// ==========================================================

/**
 * POST /api/player/message
 * Envoie un message du joueur
 * ✅ CORRECTION : Écrit UNIQUEMENT dans GitHub
 * ✅ CORRECTION : Plus d'écriture dans pending_signals
 * ✅ CORRECTION : Plus d'écriture dans communication_replies
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log(`📤 [player/message] Début requête`);

  try {
    const playerInfo = await authenticateAndGetPlayerInfo(request);
    if (!playerInfo) {
      return NextResponse.json(
        { success: false, error: "Non authentifié ou compte non trouvé" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { dossierRef, content, targetCity, subject, fileUrl, fileKey }: PlayerMessageRequest = body;

    if (!dossierRef || !content) {
      return NextResponse.json(
        { success: false, error: "Paramètres manquants: dossierRef et content requis" },
        { status: 400 }
      );
    }

    const finalSubject = subject || "COMMUNICATION";
    const targetCityDisplay = targetCity || playerInfo.playerCity || "MASTER";

    console.log(`📝 [player/message] Traitement message pour dossier ${dossierRef} - subject: ${finalSubject} - targetCity: ${targetCityDisplay}`);

    // ✅ 1. Sauvegarder UNIQUEMENT dans GitHub
    const saved = await saveMessageToGitHub(
      dossierRef,
      playerInfo.userEmail,
      playerInfo.userName,
      content,
      finalSubject,
      fileUrl,
      fileKey
    );

    if (!saved) {
      return NextResponse.json(
        { success: false, error: "Erreur lors de la sauvegarde du message dans GitHub" },
        { status: 500 }
      );
    }

    // ✅ 2. Envoyer une notification email au staff (non bloquant)
    // Récupérer l'email du staff pour la ville cible
    const staffEmail = `${targetCityDisplay.toLowerCase()}@vagondys.com`;
    const adminEmail = "admin@vagondys.com";
    
    const emailHtml = `
      <div style="font-family:sans-serif; padding:20px; border:1px solid #eee; background:#fff; color:#000;">
        <h2 style="color:#cc0000; border-bottom:2px solid #cc0000; padding-bottom:10px;">
          📩 NOUVEAU MESSAGE JOUEUR
        </h2>
        <p><strong>EXPÉDITEUR :</strong> ${playerInfo.userName}</p>
        <p><strong>EMAIL :</strong> ${playerInfo.userEmail}</p>
        <p><strong>RÉFÉRENCE DOSSIER :</strong> ${dossierRef}</p>
        <p><strong>OBJET :</strong> ${finalSubject}</p>
        <p><strong>VILLE CIBLE :</strong> ${targetCityDisplay}</p>
        <hr>
        <p><strong>MESSAGE :</strong></p>
        <div style="background:#f9f9f9; padding:15px; border-radius:5px; white-space: pre-wrap; border-left:4px solid #cc0000;">
          ${content.trim()}
        </div>
        ${fileUrl ? `<p><strong>PIÈCE JOINTE :</strong> <a href="${fileUrl}">Voir le document</a></p>` : ""}
        <hr>
        <p style="font-size:11px; color:#666;">
          Répondez à ce message depuis l'interface staff VAGONDYS.
        </p>
      </div>
    `;

    try {
      await sendGeneralEmail(
        [staffEmail, adminEmail].join(","),
        `📩 Nouveau message de ${playerInfo.userName} (${dossierRef}) - ${finalSubject}`,
        `Nouveau message de ${playerInfo.userName} (${dossierRef})\n\nObjet: ${finalSubject}\n\n${content.trim()}`,
        emailHtml,
        "no-reply@vagondys.com"
      );
      console.log(`📧 [player/message] Email notification envoyé à ${staffEmail}, ${adminEmail}`);
    } catch (emailErr) {
      console.error(`⚠️ [player/message] Erreur envoi email:`, emailErr);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [player/message] Terminé en ${duration}ms - Message envoyé avec succès`);

    return NextResponse.json({
      success: true,
      message: `Message envoyé avec succès à ${targetCityDisplay} (Objet: ${finalSubject})`,
      targetCity: targetCityDisplay,
      subject: finalSubject,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : "Erreur inconnue";
    console.error(`❌ [player/message] Erreur après ${duration}ms:`, errorMsg);
    return NextResponse.json(
      { success: false, error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS - Gestion CORS
 */
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    }
  );
}
