
import { NextRequest, NextResponse } from "next/server";
import { sendWelcomeAthleteEmail, sendStaffNotificationEmail } from "@/lib/email/gmail";
import { locateAthleteStation, createDynamicClient, consumeEmailToken, syncAthleteReference } from "@/lib/supabase/master";

/**
 * Route GET /api/confirm-email?token=...
 * - Vérifie token dans email_confirmations (MASTER)
 * - Identifie la station (VILLE) via l'email
 * - Si valide : marque token used (MASTER)
 * - GÉNÈRE LE MATRICULE VGD-XXXXXXXX (100% Aléatoire) dans la base de la VILLE
 * - RÉCUPÈRE LE SIGNALEMENT (PENDING_SIGNALS) dans la base STAFF de la VILLE
 * - Envoie l'archive sur le GITHUB de la VILLE (via city_code)
 * - Active la confirmation d'email côté Supabase Auth via Admin API (MASTER)
 * - SYNCHRONISE le dossier_ref dans athletes_registry (MASTER)
 */

interface EmailConfirmationRecord {
  id: string;
  user_id: string;
  email: string;
  token: string;
  expires_at: string;
  used: boolean;
  used_at: string | null;
  created_at: string;
}

/**
 * GÉNÉRATEUR DE MATRICULE 100% ALÉATOIRE
 * Format : VGD- + 8 caractères (Mélange aléatoire Lettres/Chiffres)
 */
function generateVGDReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; 
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `VGD-${result}`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  
  // --- PROTECTION RADICALE ANTI-LOCALHOST ---
  let frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://vagondys.com";
  if (frontendUrl.includes("localhost")) {
    frontendUrl = "https://vagondys.com";
  }

  try {
    const token = url.searchParams.get("token");
    if (!token) {
      return NextResponse.redirect(new URL("/inscription?status=error&reason=missing_token", frontendUrl));
    }

    // ✅ IMPORT DYNAMIQUE - Chargé UNIQUEMENT à l'exécution, pas au build
    const { createClient } = await import("@supabase/supabase-js");
    
    // ✅ Récupération des variables (existent à l'exécution)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY_MASTER;
    
    // ✅ Vérification des variables (sans valeurs en dur)
    if (!supabaseUrl || !supabaseKey) {
      console.error("Variables Supabase MASTER manquantes");
      return NextResponse.redirect(new URL("/inscription?status=error&reason=config_error", frontendUrl));
    }
    
    // Client Admin pour la base centrale MASTER (Auth & Tokens) - créé à l'exécution
    const supabaseMasterAdmin = createClient(supabaseUrl, supabaseKey, { 
      auth: { 
        autoRefreshToken: false, 
        persistSession: false 
      } 
    });

    // 1. Récupérer l'enregistrement du token sur le MASTER
    const { data, error: fetchErr } = await supabaseMasterAdmin
      .from("email_confirmations")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    const record = data as EmailConfirmationRecord | null;

    if (fetchErr || !record) {
      console.error("Token non trouvé sur Master ou erreur:", fetchErr);
      return NextResponse.redirect(new URL("/inscription?status=error&reason=invalid_token", frontendUrl));
    }

    if (record.used) {
      return NextResponse.redirect(new URL("/inscription?status=error&reason=already_used", frontendUrl));
    }

    const now = new Date();
    if (record.expires_at && new Date(record.expires_at) < now) {
      return NextResponse.redirect(new URL("/inscription?status=error&reason=expired", frontendUrl));
    }

    // --- IDENTIFICATION DE LA STATION VIA LE MASTER (City-Aware) ---
    const userEmail = record.email.toLowerCase();
    const station = await locateAthleteStation(userEmail);
    
    if (!station) {
       console.error("Impossible de localiser la station pour:", userEmail);
       return NextResponse.redirect(new URL("/inscription?status=error&reason=station_not_found", frontendUrl));
    }

    // --- SOLUTION PRIORITAIRE : MARQUAGE DU TOKEN COMME UTILISÉ ---
    const consumed = await consumeEmailToken(token);
    if (!consumed) {
      console.error("Erreur critique lors du marquage used: true du token");
    }

    // Création des clients dynamiques sécurisés avec le Country Code
    const cityPublicAdmin = await createDynamicClient(station.city_code, station.country_code, 'PUBLIC');
    const cityStaffAdmin = await createDynamicClient(station.city_code, station.country_code, 'STAFF');

    // 3. Traitement dans la base de la VILLE
    const userId = record.user_id;
    if (userId) {
      
      // --- GÉNÉRATION DE MATRICULE UNIQUE AVEC VÉRIFICATION DB ---
      let newDossierRef = "";
      let isRefUnique = false;
      let attempts = 0;

      while (!isRefUnique && attempts < 5) {
        newDossierRef = generateVGDReference();
        const { data: existingRef } = await cityPublicAdmin
          .from("athletes")
          .select("dossier_ref")
          .eq("dossier_ref", newDossierRef)
          .maybeSingle();
        
        if (!existingRef) {
          isRefUnique = true;
        }
        attempts++;
      }

      // Récupération sécurisée des infos de l'athlète
      const { data: athleteData, error: athleteErr } = await cityPublicAdmin
        .from("athletes")
        .select("*")
        .eq("id", userId)
        .single();

      if (athleteErr) {
        console.error("Erreur récupération athlète local:", athleteErr.message);
      }

      // Récupération du signalement dans la base Staff (avec gestion d'erreur JSON)
      let pendingSignal = null;
      try {
        const { data: signal } = await cityStaffAdmin
          .from("pending_signals")
          .select("*")
          .eq("payload->>email", userEmail)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        pendingSignal = signal;
      } catch (err) {
        console.warn("Table pending_signals absente ou inaccessible pour cette ville.", err);
      }

      if (athleteData) {
        // --- ARCHIVAGE GITHUB (Envoi vers la Gare de Triage / Engine) ---
        const archivePayload = {
          message: {
            dossier_ref: newDossierRef,
            created_at: new Date().toISOString(),
            payload: {
              name: athleteData.full_name,
              pseudo: athleteData.pseudo,
              email: userEmail,
              phone: athleteData.phone,
              city: athleteData.city || station.city_code,
              country: athleteData.country || station.country_code || "FR",
              subject: "ENRÔLEMENT ATHLÈTE",
              message: `FÉLICITATIONS : COMPTE ACTIF POUR LA STATION ${station.name.toUpperCase()}. BIENVENUE.`
            }
          },
          history: [], 
          purgeActive: false,
          city_code: station.city_code,
          country_code: station.country_code
        };

        try {
          const archiveRes = await fetch(`${frontendUrl}/api/archive-external`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(archivePayload)
          });
          if (!archiveRes.ok) throw new Error(`Status ${archiveRes.status}`);
        } catch (gitErr) {
          console.error("Erreur archive GitHub spécifique ville:", gitErr);
        }

        // 4. Mise à jour de la base ville (Activation du profil local)
        const { error: updAth } = await cityPublicAdmin
          .from("athletes")
          .update({ 
            status: "ACTIF",
            dossier_ref: newDossierRef
          })
          .eq("id", userId);

        if (!updAth) {
          try {
            // --- SYNCHRONISATION MASTER REGISTRY ---
            await syncAthleteReference(userEmail, newDossierRef);

            // ENVOIS D'EMAILS CITY-AWARE
            await sendWelcomeAthleteEmail(
              userEmail, 
              athleteData.pseudo || athleteData.full_name, 
              station.city_code,
              newDossierRef
            );
            await sendStaffNotificationEmail(userEmail, station.city_code);
          } catch (mailErr) {
            console.error("Erreur emails / synchro master:", mailErr);
          }
        } else {
            console.error("Erreur lors de l'update de l'athlète local:", updAth.message);
        }

        // Mise à jour du signalement si trouvé
        if (pendingSignal) {
           await cityStaffAdmin
            .from("pending_signals")
            .update({ 
              confirmed: true, 
              dossier_ref: newDossierRef,
              is_read: false,
              is_new_athlete: true 
            })
            .eq("id", pendingSignal.id);
        }
      }

      // 5. Activation finale de l'utilisateur côté Auth (Base MASTER uniquement)
      try {
        await supabaseMasterAdmin.auth.admin.updateUserById(userId, { 
          email_confirm: true,
          user_metadata: { 
            city: station.city_code,
            country: station.country_code 
          },
          app_metadata: { 
            city: station.city_code,
            country: station.country_code
          }
        });
      } catch (authErr) {
        console.error("Erreur finale Auth Master:", authErr);
      }
    }

    const cleanCityName = station.name.replace(/VAGONDYS/gi, "").trim().toUpperCase();
    const successUrl = new URL("/activation-reussie", url.origin);
    successUrl.searchParams.set("city", cleanCityName);
    
    return NextResponse.redirect(successUrl);

  } catch (err: unknown) {
    const errorLog = err instanceof Error ? err.message : "Inconnu";
    console.error("confirm-email critical error:", errorLog);
    return NextResponse.redirect(new URL(`/inscription?status=error&reason=internal&detail=${encodeURIComponent(errorLog)}`, frontendUrl));
  }
}
