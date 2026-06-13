
import { NextRequest, NextResponse } from "next/server";
import { sendWelcomeAthleteEmail, sendStaffNotificationEmail } from "@/lib/email/gmail";
import { getAthleteCity, getAthleteCountry, consumeEmailToken, syncAthleteReference, masterAdmin } from "@/lib/supabase/master";
import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Route GET /api/confirm-email?token=...
 * - Vérifie token dans email_confirmations (MASTER)
 * - Identifie la station (VILLE) via l'email (getAthleteCity)
 * - Si valide : marque token used (MASTER)
 * - GÉNÈRE LE MATRICULE VGD-XXXXXXXX (100% Aléatoire) dans la base UNIQUE
 * - RÉCUPÈRE LE SIGNALEMENT (PENDING_SIGNALS) dans la base UNIQUE
 * - Envoie l'archive sur le GITHUB UNIQUE (via city_code)
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

/**
 * ✅ NOUVELLE FONCTION : Recherche un dossier_ref existant pour un email
 * Ordre de recherche :
 * 1. athletes_registry
 * 2. pending_signals
 * 3. Archive GitHub
 */
async function findExistingDossierRef(
  email: string,
  supabaseAdmin: SupabaseClient,
  siteUrl: string
): Promise<string | null> {
  const cleanEmail = email.toLowerCase().trim();
  
  console.log(`🔍 [confirm-email] Recherche dossier_ref existant pour ${cleanEmail}`);

  // 1. Recherche dans athletes_registry
  try {
    const { data: registry } = await supabaseAdmin
      .from("athletes_registry")
      .select("dossier_ref")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (registry?.dossier_ref && registry.dossier_ref !== "0") {
      console.log(`✅ [confirm-email] dossier_ref trouvé dans athletes_registry: ${registry.dossier_ref}`);
      return registry.dossier_ref;
    }
  } catch (err) {
    console.warn("⚠️ [confirm-email] Erreur recherche athletes_registry:", err);
  }

  // 2. Recherche dans pending_signals
  try {
    const { data: pendingSignal } = await supabaseAdmin
      .from("pending_signals")
      .select("dossier_ref")
      .eq("payload->>email", cleanEmail)
      .not("dossier_ref", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingSignal?.dossier_ref && pendingSignal.dossier_ref !== "0") {
      console.log(`✅ [confirm-email] dossier_ref trouvé dans pending_signals: ${pendingSignal.dossier_ref}`);
      return pendingSignal.dossier_ref;
    }
  } catch (err) {
    console.warn("⚠️ [confirm-email] Erreur recherche pending_signals:", err);
  }

  // 3. Recherche dans Archive GitHub
  try {
    const emailSlug = cleanEmail.replace(/[@.]/g, "_");
    const searchUrl = `${siteUrl}/api/archive-external?search=${emailSlug}`;
    const searchRes = await fetch(searchUrl);
    
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.dossier_ref) {
        console.log(`✅ [confirm-email] dossier_ref trouvé dans GitHub: ${searchData.dossier_ref}`);
        return searchData.dossier_ref;
      }
    }
  } catch (err) {
    console.warn("⚠️ [confirm-email] Erreur recherche GitHub:", err);
  }

  console.log(`ℹ️ [confirm-email] Aucun dossier_ref existant trouvé pour ${cleanEmail}`);
  return null;
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
    
    // ✅ Récupération des variables (Version Option B - un seul projet)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    // ✅ Vérification des variables
    if (!supabaseUrl || !supabaseKey) {
      console.error("Variables Supabase manquantes");
      return NextResponse.redirect(new URL("/inscription?status=error&reason=config_error", frontendUrl));
    }
    
    // Client Admin pour le projet UNIQUE - créé à l'exécution
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, { 
      auth: { 
        autoRefreshToken: false, 
        persistSession: false 
      } 
    });

    // 1. Récupérer l'enregistrement du token
    const { data, error: fetchErr } = await supabaseAdmin
      .from("email_confirmations")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    const record = data as EmailConfirmationRecord | null;

    if (fetchErr || !record) {
      console.error("Token non trouvé ou erreur:", fetchErr);
      return NextResponse.redirect(new URL("/inscription?status=error&reason=invalid_token", frontendUrl));
    }

    if (record.used) {
      return NextResponse.redirect(new URL("/inscription?status=error&reason=already_used", frontendUrl));
    }

    const now = new Date();
    if (record.expires_at && new Date(record.expires_at) < now) {
      return NextResponse.redirect(new URL("/inscription?status=error&reason=expired", frontendUrl));
    }

    // --- IDENTIFICATION DE LA STATION VIA LE MASTER (Version Option B) ---
    const userEmail = record.email.toLowerCase();
    
    // Vérifier que masterAdmin n'est pas null avant de l'utiliser
    if (!masterAdmin) {
      console.error("masterAdmin non disponible");
      return NextResponse.redirect(new URL("/inscription?status=error&reason=master_admin_unavailable", frontendUrl));
    }
    
    const athleteCity = await getAthleteCity(userEmail);
    const athleteCountry = await getAthleteCountry(userEmail);
    
    if (!athleteCity) {
       console.error("Impossible de localiser la ville pour:", userEmail);
       return NextResponse.redirect(new URL("/inscription?status=error&reason=city_not_found", frontendUrl));
    }
    
    const stationCityCode = athleteCity;
    const stationCountryCode = athleteCountry || "FR";

    // --- MARQUAGE DU TOKEN COMME UTILISÉ ---
    const consumed = await consumeEmailToken(token);
    if (!consumed) {
      console.error("Erreur critique lors du marquage used: true du token");
    }

    // 3. Traitement dans la base UNIQUE (Option B)
    const userId = record.user_id;
    if (userId) {
      
      // ✅ RECHERCHE DU DOSSIER_REF EXISTANT AVANT D'EN GÉNÉRER UN NOUVEAU
      // ✅ CORRECTION : utilisation de 'const' car jamais réassigné
      const existingDossierRef = await findExistingDossierRef(userEmail, supabaseAdmin, frontendUrl);
      
      // ✅ GÉNÉRATION DE MATRICULE UNIQUE AVEC VÉRIFICATION DB (seulement si pas d'existant)
      let newDossierRef = "";
      let isRefUnique = false;
      let attempts = 0;

      if (existingDossierRef) {
        // ✅ On réutilise le dossier_ref existant
        newDossierRef = existingDossierRef;
        isRefUnique = true;
        console.log(`📦 [confirm-email] RÉUTILISATION du dossier_ref existant: ${newDossierRef}`);
      } else {
        // ✅ Génération d'un nouveau dossier_ref
        while (!isRefUnique && attempts < 5) {
          newDossierRef = generateVGDReference();
          const { data: existingRef } = await supabaseAdmin
            .from("athletes")
            .select("dossier_ref")
            .eq("dossier_ref", newDossierRef)
            .maybeSingle();
          
          if (!existingRef) {
            isRefUnique = true;
          }
          attempts++;
        }
        console.log(`📦 [confirm-email] NOUVEAU dossier_ref généré: ${newDossierRef}`);
      }

      // Récupération sécurisée des infos de l'athlète
      const { data: athleteData, error: athleteErr } = await supabaseAdmin
        .from("athletes")
        .select("*")
        .eq("id", userId)
        .single();

      if (athleteErr) {
        console.error("Erreur récupération athlète:", athleteErr.message);
      }

      // Récupération du signalement (avec gestion d'erreur)
      let pendingSignal = null;
      try {
        const { data: signal } = await supabaseAdmin
          .from("pending_signals")
          .select("*")
          .eq("payload->>email", userEmail)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        pendingSignal = signal;
      } catch (err) {
        console.warn("Table pending_signals absente ou inaccessible.", err);
      }

      if (athleteData) {
        // --- ARCHIVAGE GITHUB (Vers le repo UNIQUE) ---
        const archivePayload = {
          message: {
            dossier_ref: newDossierRef,
            created_at: new Date().toISOString(),
            payload: {
              name: athleteData.full_name,
              pseudo: athleteData.pseudo,
              email: userEmail,
              phone: athleteData.phone,
              city: athleteData.city || stationCityCode,
              country: athleteData.country || stationCountryCode,
              subject: "ENRÔLEMENT ATHLÈTE",
              message: `FÉLICITATIONS : COMPTE ACTIF POUR LA STATION ${stationCityCode.toUpperCase()}. BIENVENUE.`
            }
          },
          history: [], 
          purgeActive: false,
          city_code: stationCityCode,
          country_code: stationCountryCode
        };

        try {
          const archiveRes = await fetch(`${frontendUrl}/api/archive-external`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(archivePayload)
          });
          if (!archiveRes.ok) throw new Error(`Status ${archiveRes.status}`);
        } catch (gitErr) {
          console.error("Erreur archive GitHub:", gitErr);
        }

        // 4. Mise à jour de la base (Activation du profil)
        const { error: updAth } = await supabaseAdmin
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

            // ENVOIS D'EMAILS
            await sendWelcomeAthleteEmail(
              userEmail, 
              athleteData.pseudo || athleteData.full_name, 
              stationCityCode,
              newDossierRef
            );
            await sendStaffNotificationEmail(userEmail, stationCityCode);
          } catch (mailErr) {
            console.error("Erreur emails / synchro master:", mailErr);
          }
        } else {
            console.error("Erreur lors de l'update de l'athlète:", updAth.message);
        }

        // Mise à jour du signalement si trouvé
        if (pendingSignal) {
           await supabaseAdmin
            .from("pending_signals")
            .update({ 
              confirmed: true, 
              dossier_ref: newDossierRef,
              is_read: false,
              is_new_athlete: !existingDossierRef // ✅ false si dossier existant, true si nouveau
            })
            .eq("id", pendingSignal.id);
        }
      }

      // 5. Activation finale de l'utilisateur côté Auth
      try {
        await supabaseAdmin.auth.admin.updateUserById(userId, { 
          email_confirm: true,
          user_metadata: { 
            city: stationCityCode,
            country: stationCountryCode,
            dossier_ref: newDossierRef // ✅ Ajout du dossier_ref dans metadata
          },
          app_metadata: { 
            city: stationCityCode,
            country: stationCountryCode,
            dossier_ref: newDossierRef // ✅ Ajout du dossier_ref dans app_metadata
          }
        });
      } catch (authErr) {
        console.error("Erreur finale Auth:", authErr);
      }
    }

    const cleanCityName = stationCityCode;
    const successUrl = new URL("/activation-reussie", url.origin);
    successUrl.searchParams.set("city", cleanCityName);
    
    return NextResponse.redirect(successUrl);

  } catch (err: unknown) {
    const errorLog = err instanceof Error ? err.message : "Inconnu";
    console.error("confirm-email critical error:", errorLog);
    return NextResponse.redirect(new URL(`/inscription?status=error&reason=internal&detail=${encodeURIComponent(errorLog)}`, frontendUrl));
  }
}
