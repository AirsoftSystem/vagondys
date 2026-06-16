
/**
 * ==========================================================
 * API PLAYER MESSAGE - ENVOI DE MESSAGE JOUEUR VERS STAFF
 * ==========================================================
 * POST /api/player/message
 * Body: { dossierRef, content, targetCity?, fileUrl?, fileKey? }
 * 
 * Cette API est dédiée aux joueurs authentifiés.
 * Elle route le message vers le staff de la ville choisie (targetCity).
 * Si targetCity n'est pas fourni, utilise la ville du joueur par défaut.
 * 
 * ✅ Différence avec /api/send-reply :
 * - send-reply est conçu pour le STAFF répondant aux joueurs
 * - player/message est conçu pour les JOUEURS envoyant des messages
 * 
 * ✅ CORRECTION : Le joueur écrit UNIQUEMENT dans pending_signals (messages_history)
 * ✅ CORRECTION : Plus d'écriture dans communication_replies (réservé au staff)
 * ✅ CORRECTION : L'archive GitHub est mise à jour en parallèle (non bloquant)
 * ✅ CORRECTION : fileKey n'est pas utilisé (seul fileUrl est nécessaire pour le joueur)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendGeneralEmail } from "@/lib/email/gmail";

// ==========================================================
// CONFIGURATION
// ==========================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Mapping ville → email staff
const STAFF_EMAILS: Record<string, string> = {
  "NANTES": "nantes@vagondys.com",
  "LYON": "lyon@vagondys.com",
  "PARIS": "paris@vagondys.com",
  "MARSEILLE": "marseille@vagondys.com",
  "BORDEAUX": "bordeaux@vagondys.com",
  "LILLE": "lille@vagondys.com",
  "TOULOUSE": "toulouse@vagondys.com",
  "MADRID": "madrid@vagondys.com",
  "MASTER": "admin@vagondys.com",
};

// ==========================================================
// TYPES
// ==========================================================

interface PlayerMessageRequest {
  dossierRef: string;
  content: string;
  targetCity?: string;
  fileUrl?: string;
  // fileKey est conservé dans l'interface mais marqué comme inutilisé
}

interface PlayerInfo {
  userId: string;
  userEmail: string;
  userName: string;
  playerCity: string;
  playerCountry: string;
}

interface FullThreadMessage {
  role?: string;
  sender?: string;
  content?: string;
  created_at?: string;
  agent_email?: string;
  id?: string;
  document_url?: string | null;
  [key: string]: unknown;
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

  const playerCity = registry.city || "NANTES";
  const playerCountry = registry.country || "FR";

  console.log(`📍 [player/message] Joueur: ${playerCity}/${playerCountry}`);

  return {
    userId,
    userEmail,
    userName,
    playerCity,
    playerCountry,
  };
}

/**
 * Récupère l'email du staff pour une ville donnée
 */
function getStaffEmailForCity(city: string): string {
  const upperCity = city.toUpperCase().trim();
  return STAFF_EMAILS[upperCity] || STAFF_EMAILS["MASTER"];
}

/**
 * Envoie un email au staff de la ville cible
 */
async function notifyStaff(
  targetCity: string,
  playerName: string,
  playerEmail: string,
  dossierRef: string,
  content: string,
  fileUrl?: string
): Promise<boolean> {
  const staffEmail = getStaffEmailForCity(targetCity);
  const cityDisplayName = targetCity === "MASTER" ? "ADMINISTRATION CENTRALE" : targetCity;
  
  console.log(`📧 [player/message] Envoi email à ${staffEmail} (${cityDisplayName})`);

  try {
    const html = `
      <div style="font-family:sans-serif; padding:20px; border:1px solid #eee; background:#fff; color:#000;">
        <h2 style="color:#cc0000; border-bottom:2px solid #cc0000; padding-bottom:10px;">
          📩 NOUVEAU MESSAGE JOUEUR - ${cityDisplayName}
        </h2>
        <p><strong>EXPÉDITEUR :</strong> ${playerName}</p>
        <p><strong>EMAIL :</strong> ${playerEmail}</p>
        <p><strong>RÉFÉRENCE DOSSIER :</strong> ${dossierRef}</p>
        <hr>
        <p><strong>MESSAGE :</strong></p>
        <div style="background:#f9f9f9; padding:15px; border-radius:5px; white-space: pre-wrap; border-left:4px solid #cc0000;">
          ${content.replace(/\n/g, "<br>")}
        </div>
        ${fileUrl ? `<p><strong>PIÈCE JOINTE :</strong> <a href="${fileUrl}">Voir le document</a></p>` : ""}
        <hr>
        <p style="font-size:11px; color:#666;">
          Répondez à ce message depuis l'interface staff VAGONDYS.
        </p>
      </div>
    `;

    await sendGeneralEmail(
      staffEmail,
      `[VAGONDYS] Nouveau message de ${playerName} (${dossierRef}) - ${cityDisplayName}`,
      `Nouveau message de ${playerName} (${dossierRef})\n\n${content}`,
      html,
      "contact@vagondys.com"
    );

    console.log(`📧 [player/message] Email envoyé avec succès à ${staffEmail}`);
    return true;
  } catch (err) {
    console.error(`❌ [player/message] Erreur envoi email:`, err);
    return false;
  }
}

/**
 * ✅ CORRECTION : Sauvegarde le message UNIQUEMENT dans pending_signals (messages_history)
 */
async function updatePendingSignalsHistory(
  dossierRef: string,
  playerEmail: string,
  playerName: string,
  content: string,
  playerCity: string,
  playerCountry: string
): Promise<boolean> {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ [player/message] Impossible de sauvegarder, configuration manquante");
    return false;
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Récupérer le signal existant
    const { data: signal } = await supabaseAdmin
      .from("pending_signals")
      .select("payload, dossier_ref")
      .eq("dossier_ref", dossierRef)
      .maybeSingle();

    if (signal && signal.payload) {
      const payload = signal.payload as Record<string, unknown>;
      const messagesHistory = (payload.messages_history as Array<{ content: string; created_at: string }>) || [];

      // Ajouter le nouveau message à l'historique
      messagesHistory.push({
        content: content,
        created_at: new Date().toISOString(),
      });

      // Mettre à jour le payload
      const updatedPayload = {
        ...payload,
        messages_history: messagesHistory,
        message: content,
        name: playerName,
        email: playerEmail,
        city: playerCity,
        country: playerCountry,
      };

      const { error } = await supabaseAdmin
        .from("pending_signals")
        .update({
          payload: updatedPayload,
          is_read: false,
        })
        .eq("dossier_ref", dossierRef);

      if (error) {
        console.error("❌ [player/message] Erreur mise à jour pending_signals:", error);
        return false;
      }

      console.log(`📝 [player/message] pending_signals mis à jour (${messagesHistory.length} messages)`);
      return true;
    } else {
      // ✅ Si aucun signal n'existe, en créer un nouveau
      const now = new Date().toISOString();
      const { error } = await supabaseAdmin
        .from("pending_signals")
        .insert({
          dossier_ref: dossierRef,
          payload: {
            name: playerName,
            email: playerEmail,
            city: playerCity,
            country: playerCountry,
            message: content,
            messages_history: [
              {
                content: content,
                created_at: now,
              }
            ],
            subject: "MESSAGE JOUEUR",
          },
          confirmed: true,
          is_read: false,
          is_new_athlete: false,
          city: playerCity,
          country: playerCountry,
          created_at: now,
        });

      if (error) {
        console.error("❌ [player/message] Erreur création pending_signals:", error);
        return false;
      }

      console.log(`📝 [player/message] Nouveau pending_signals créé pour ${dossierRef}`);
      return true;
    }
  } catch (err) {
    console.error("❌ [player/message] Exception mise à jour pending_signals:", err);
    return false;
  }
}

/**
 * ✅ Sauvegarde le message dans l'archive GitHub (non bloquant)
 */
async function saveMessageToGitHubArchive(
  dossierRef: string,
  playerEmail: string,
  playerName: string,
  content: string,
  playerCity: string,
  playerCountry: string,
  fileUrl?: string
): Promise<boolean> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vagondys.com";
    const now = new Date().toISOString();

    // Vérifier si l'archive existe
    const checkRes = await fetch(`${baseUrl}/api/archive-external?ref=${dossierRef}&city_code=${playerCity}&country_code=${playerCountry}`);
    let fullThread: FullThreadMessage[] = [];
    let archiveExists = false;

    if (checkRes.ok) {
      const archiveData = await checkRes.json();
      archiveExists = true;
      
      if (archiveData && archiveData.fullThread && Array.isArray(archiveData.fullThread)) {
        fullThread = archiveData.fullThread;
      } else if (archiveData && archiveData.fil_de_discussion && Array.isArray(archiveData.fil_de_discussion)) {
        fullThread = archiveData.fil_de_discussion;
      }
      console.log(`📦 [player/message] Archive existante, ${fullThread.length} messages`);
    }

    const newMessage: FullThreadMessage = {
      role: "public",
      sender: playerEmail,
      content: content,
      created_at: now,
      is_initial: false,
    };
    if (fileUrl) {
      newMessage.document_url = fileUrl;
    }

    fullThread.push(newMessage);

    const archivePayload = {
      message: {
        dossier_ref: dossierRef,
        created_at: archiveExists ? undefined : now,
        payload: {
          name: playerName,
          email: playerEmail,
          city: playerCity,
          country: playerCountry,
          message: content,
          messages_history: [],
        },
      },
      fullThread: fullThread,
      echanges_staff: [],
      fil_de_discussion: fullThread,
      city_code: playerCity,
      country_code: playerCountry,
      purgeActive: false,
    };

    const updateRes = await fetch(`${baseUrl}/api/archive-external`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(archivePayload),
    });

    if (!updateRes.ok) {
      const errorText = await updateRes.text();
      console.error(`❌ [player/message] Erreur archivage GitHub: ${updateRes.status} - ${errorText}`);
      return false;
    }

    console.log(`📦 [player/message] Message archivé dans GitHub (${fullThread.length} messages)`);
    return true;
  } catch (err) {
    console.error(`❌ [player/message] Erreur archivage GitHub:`, err);
    return false;
  }
}

// ==========================================================
// API ROUTES
// ==========================================================

/**
 * POST /api/player/message
 * Envoie un message du joueur vers le staff de la ville choisie
 * ✅ CORRECTION : Écrit UNIQUEMENT dans pending_signals (messages_history)
 * ✅ CORRECTION : Plus d'écriture dans communication_replies
 * ✅ CORRECTION : fileKey est ignoré (seul fileUrl est utilisé)
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
    // ✅ CORRECTION : fileKey n'est pas utilisé, on ne le récupère pas
    const { dossierRef, content, targetCity, fileUrl }: PlayerMessageRequest = body;

    if (!dossierRef || !content) {
      return NextResponse.json(
        { success: false, error: "Paramètres manquants: dossierRef et content requis" },
        { status: 400 }
      );
    }

    let effectiveTargetCity = playerInfo.playerCity;
    if (targetCity) {
      const upperTarget = targetCity.toUpperCase().trim();
      if (STAFF_EMAILS[upperTarget] || upperTarget === "MASTER") {
        effectiveTargetCity = upperTarget;
        console.log(`📍 [player/message] Ville cible sélectionnée: ${effectiveTargetCity}`);
      } else {
        console.warn(`⚠️ [player/message] Ville cible inconnue: ${targetCity}, utilisation de la ville du joueur`);
      }
    }

    console.log(`📝 [player/message] Traitement message pour dossier ${dossierRef}`);

    // ✅ 1. Sauvegarder UNIQUEMENT dans pending_signals (messages_history)
    const saved = await updatePendingSignalsHistory(
      dossierRef,
      playerInfo.userEmail,
      playerInfo.userName,
      content,
      playerInfo.playerCity,
      playerInfo.playerCountry
    );

    if (!saved) {
      return NextResponse.json(
        { success: false, error: "Erreur lors de la sauvegarde du message" },
        { status: 500 }
      );
    }

    // ✅ 2. Sauvegarder dans l'archive GitHub (non bloquant)
    const archived = await saveMessageToGitHubArchive(
      dossierRef,
      playerInfo.userEmail,
      playerInfo.userName,
      content,
      playerInfo.playerCity,
      playerInfo.playerCountry,
      fileUrl
    );

    if (!archived) {
      console.warn(`⚠️ [player/message] Échec archivage GitHub (non bloquant)`);
    }

    // ✅ 3. Envoyer l'email au staff
    const emailSent = await notifyStaff(
      effectiveTargetCity,
      playerInfo.userName,
      playerInfo.userEmail,
      dossierRef,
      content,
      fileUrl
    );

    const duration = Date.now() - startTime;
    console.log(`✅ [player/message] Terminé en ${duration}ms, email: ${emailSent}, archivage: ${archived}`);

    return NextResponse.json({
      success: true,
      message: `Message envoyé avec succès à ${effectiveTargetCity}`,
      staffNotified: emailSent,
      archived: archived,
      targetCity: effectiveTargetCity,
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
