

"use server";

import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { sendGeneralEmail } from "@/lib/email/gmail";
import { createDynamicClient } from "@/lib/supabase/master";

// --- DÉFINITION DES TYPES ---
interface SignalPayload {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  city: string;
  country: string;
}

/**
 * ACTION 1 : Envoi du formulaire initial (calqué sur l'inscription)
 */
export async function submitContact(formData: FormData) {
  console.log("🚀 submitContact - Début");
  
  // ✅ Récupération des variables d'environnement à l'exécution
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY_MASTER;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.vagondys.com";
  
  // ✅ Vérification des variables critiques
  if (!supabaseUrl || !supabaseKey) {
    console.error("Variables Supabase MASTER manquantes");
    redirect("/contact?status=error");
  }
  
  // ✅ IMPORT DYNAMIQUE - Chargé UNIQUEMENT à l'exécution, pas au build
  const { createClient } = await import("@supabase/supabase-js");
  
  // CLIENT MASTER (uniquement pour le registre) - créé à l'exécution
  const supabaseMaster = createClient(supabaseUrl, supabaseKey);
  
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const phone = String(formData.get("phone") || "").trim();
  const subject = String(formData.get("subject") || "").trim();
  const message = String(formData.get("message") || "").trim();
  
  // ✅ Récupération du pays et de la ville
  const country = String(formData.get("country") || "FR").trim().toUpperCase();
  const city = String(formData.get("city") || "NANTES").trim().toUpperCase();

  console.log(`📧 Email: ${email}, Sujet: ${subject}, Pays: ${country}, Ville: ${city}`);

  const token = formData.get("cf-turnstile-response");
  if (!token) {
    console.error("❌ Token Turnstile manquant");
    redirect("/contact?status=security_error");
  }

  try {
    // 1. RECHERCHE DANS LE REGISTRE MASTER (athletes_registry)
    console.log("🔍 Recherche dans athletes_registry...");
    const { data: registryEntry } = await supabaseMaster
      .from('athletes_registry')
      .select('city, country, dossier_ref')
      .eq('email', email)
      .maybeSingle();

    console.log("📋 Registry entry:", registryEntry);

    // ✅ AJOUT 1 : Vérifier si un dossier existe déjà pour cet email
    let existingDossierRef: string | null = registryEntry?.dossier_ref || null;
    
    // ✅ AJOUT 2 : Si non trouvé dans MASTER, chercher dans pending_signals (STAFF)
    if (!existingDossierRef) {
      console.log(`🔍 Recherche dans pending_signals de ${city}...`);
      try {
        const cityStaffClient = await createDynamicClient(city, country, 'STAFF');
        const { data: existingSignal } = await cityStaffClient
          .from('pending_signals')
          .select('dossier_ref')
          .eq('payload->>email', email)
          .not('dossier_ref', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (existingSignal?.dossier_ref) {
          existingDossierRef = existingSignal.dossier_ref;
          console.log(`✅ Dossier existant trouvé dans STAFF: ${existingDossierRef}`);
        }
      } catch (staffErr) {
        console.warn("⚠️ Erreur recherche STAFF:", staffErr);
      }
    }
    
    // ✅ AJOUT 3 : Si non trouvé, chercher dans les archives GitHub
    if (!existingDossierRef) {
      console.log(`🔍 Recherche dans GitHub pour ${email}...`);
      try {
        const searchUrl = `${siteUrl}/api/archive-external?search=${email.toLowerCase().replace(/[@.]/g, '_')}&city_code=${city}&country_code=${country}`;
        const searchRes = await fetch(searchUrl);
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData.dossier_ref) {
            existingDossierRef = searchData.dossier_ref;
            console.log(`✅ Dossier existant trouvé dans GitHub: ${existingDossierRef}`);
          }
        }
      } catch (gitErr) {
        console.warn("⚠️ Erreur recherche GitHub:", gitErr);
      }
    }

    // ✅ AJOUT 4 : Si un dossier existe déjà, on le réutilise
    let dossier_ref: string;
    let isNewDossier = false;
    
    if (existingDossierRef) {
      dossier_ref = existingDossierRef;
      console.log(`📁 Réutilisation du dossier existant: ${dossier_ref}`);
    } else {
      // Génération d'un nouveau dossier
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const generateSegment = (length: number) => {
        let result = '';
        for (let i = 0; i < length; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };
      dossier_ref = `VGD-${generateSegment(4)}${generateSegment(4)}`;
      isNewDossier = true;
      console.log(`📁 Nouveau dossier généré: ${dossier_ref}`);
    }

    // 5. CRÉATION DU CLIENT DYNAMIQUE POUR LA VILLE
    console.log(`🏙️ Création du client pour ${city} (${country})...`);
    const cityStaffClient = await createDynamicClient(city, country, 'STAFF');
    
    // 6. GESTION DU SIGNAL ET DE L'HISTORIQUE
    const insertPayload: SignalPayload = { 
      name, email, phone, subject, message,
      city: registryEntry?.city || city,
      country: registryEntry?.country || country
    };

    let insertData;
    
    // Vérifier si un signal existe déjà pour cet email
    const { data: existingSignal } = await cityStaffClient
      .from('pending_signals')
      .select('id, dossier_ref, payload, confirmed')
      .eq('payload->>email', email)
      .maybeSingle();
    
    if (existingSignal) {
      // ✅ CORRECTION : Ne PAS écraser le signal existant
      // On met simplement à jour is_read = false pour signaler un nouveau message
      console.log(`📝 Mise à jour du signal existant (is_read=false) pour ${email}`);
      
      const { data: updatedData, error: updateError } = await cityStaffClient
        .from('pending_signals')
        .update({
          is_read: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSignal.id)
        .select()
        .single();
      
      if (updateError) {
        console.error("❌ Erreur mise à jour:", updateError);
        throw new Error(updateError.message);
      }
      insertData = updatedData;
      
      // ✅ AJOUT : Créer un nouvel enregistrement dans communication_replies
      console.log(`📝 Ajout du nouveau message dans communication_replies pour ${dossier_ref}`);
      const replyId = randomUUID();
      const { error: replyError } = await cityStaffClient
        .from('communication_replies')
        .insert([{
          id: replyId,
          dossier_ref: dossier_ref,
          content: message,
          agent_email: "CLIENT",
          created_at: new Date().toISOString()
        }]);
      
      if (replyError) {
        console.error("❌ Erreur insertion dans communication_replies:", replyError);
        // Non bloquant, on continue
      } else {
        console.log(`✅ Nouveau message ajouté dans communication_replies avec ID: ${replyId}`);
      }
      
      console.log(`✅ Signal mis à jour avec ID: ${insertData.id}`);
    } else {
      // Créer un nouveau signal (premier message)
      console.log(`📝 Insertion dans pending_signals de ${city} (STAFF)...`);
      const { data: newData, error: dbError } = await cityStaffClient
        .from('pending_signals')
        .insert([{
          id: randomUUID(), 
          dossier_ref,
          confirmed: false,
          payload: insertPayload,
          is_new_athlete: !registryEntry && isNewDossier,
          is_read: false
        }])
        .select()
        .single();

      if (dbError) {
        console.error("❌ Erreur DB:", dbError);
        throw new Error(dbError.message);
      }
      insertData = newData;
      console.log(`✅ Signal créé avec ID: ${insertData.id} dans la base STAFF de ${city}`);
    }

    // 7. ENVOI DE L'EMAIL VIA GMAIL.TS
    const baseUrl = siteUrl;
    const service = subject;
    
    const encodedService = encodeURIComponent(service);
    const confirmLink = `${baseUrl}/api/confirm-signal?service=${encodedService}&city=${city}&country=${country}&id=${insertData.id}`;

    console.log(`📧 Tentative d'envoi d'email à ${email} via Gmail SMTP`);
    console.log(`🔗 Lien: ${confirmLink}`);

    const htmlContent = `
      <div style="background:black; color:white; padding:40px; font-family:sans-serif; text-align:center;">
        <h1 style="font-size:18px; font-weight:900; letter-spacing:-1px; text-transform:uppercase; font-style:italic;">
          Protocole <span style="color:#dc2626;">Sécurisé</span>
        </h1>
        <p style="font-size:10px; color:#52525b; text-transform:uppercase; letter-spacing:2px; margin-bottom:30px;">
          Référence Dossier : ${dossier_ref}
        </p>
        <div style="margin-bottom:30px; padding:20px; border:1px solid #18181b; background:#09090b; border-radius:12px; text-align:left;">
          <p style="font-size:9px; color:#71717a; text-transform:uppercase; margin-bottom:10px;">Message à valider :</p>
          <p style="font-size:12px; font-style:italic; color:#a1a1aa;">"${message}"</p>
        </div>
        <a href="${confirmLink}" style="background:#dc2626; color:white; padding:20px 40px; text-decoration:none; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:3px; border-radius:8px;">
          ${existingSignal ? "CONFIRMER LA TRANSMISSION" : "ACTIVER LA TRANSMISSION"}
        </a>
        <p style="margin-top:30px; font-size:8px; color:#3f3f46; text-transform:uppercase; letter-spacing:1px;">
          Cet email est généré automatiquement.
        </p>
      </div>
    `;

    const textContent = `Protocole Sécurisé - Référence Dossier: ${dossier_ref}\n\nMessage à valider: "${message}"\n\nActivez votre transmission ici: ${confirmLink}`;

    const emailResult = await sendGeneralEmail(
      email,
      existingSignal ? "NOUVEAU MESSAGE SUR VOTRE DOSSIER" : "ACTION REQUISE : Confirmez votre signal",
      textContent,
      htmlContent,
      "contact@vagondys.com"
    );

    console.log("📧 Réponse Gmail SMTP:", emailResult);

    if (!emailResult.messageId) {
      console.error("❌ Erreur d'envoi Gmail");
      throw new Error("Erreur d'envoi de l'email");
    }

    console.log("✅ Email envoyé avec succès via Gmail SMTP");

  } catch (error) {
    console.error("❌ Erreur submitContact:", error);
    redirect("/contact?status=error");
  }

  console.log("✅ Fin - Redirection vers pending_validation");
  redirect("/contact?status=pending_validation"); 
}

/**
 * ACTION 2 : Envoi d'une réponse (Espace Client/Discussion)
 */
export async function submitReply(formData: FormData) {
  const dossier_ref = String(formData.get("dossier_ref") || "").trim();
  const content = String(formData.get("message") || "").trim();
  const city = String(formData.get("city") || "NANTES").trim().toUpperCase();
  const country = String(formData.get("country") || "FR").trim().toUpperCase();

  if (!dossier_ref || !content) throw new Error("Données manquantes.");

  try {
    const cityStaffClient = await createDynamicClient(city, country, 'STAFF');
    
    const sharedId = randomUUID(); 
    const replyData = {
      id: sharedId,
      dossier_ref,
      content,
      agent_email: "CLIENT",
    };
    
    const { error } = await cityStaffClient
      .from("communication_replies")
      .insert([replyData]);
    
    if (error) throw new Error("Erreur base de données.");
    
    return { success: true };
    
  } catch (error) {
    console.error("Erreur submitReply:", error);
    return { success: false, error: "Transmission échouée" };
  }
}

/**
 * ACTION 3 : Envoi du formulaire d'inscription (Staff vers Joueur)
 */
export async function sendInvitation(email: string) {
  if (!email) throw new Error("Email requis.");

  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.vagondys.com";
    const inscriptionLink = `${baseUrl}/inscription`;

    const htmlContent = `
      <div style="background:black; color:white; padding:40px; font-family:sans-serif; text-align:center;">
        <h1 style="font-size:18px; font-weight:900; letter-spacing:-1px; text-transform:uppercase; font-style:italic;">
          CELLULE <span style="color:#dc2626;">D'ENRÔLEMENT</span>
        </h1>
        <p style="font-size:10px; color:#52525b; text-transform:uppercase; letter-spacing:2px; margin-bottom:30px;">
          Accès au formulaire officiel
        </p>
        <div style="margin-bottom:30px; padding:20px; border:1px solid #18181b; background:#09090b; border-radius:12px;">
           <p style="font-size:12px; color:#a1a1aa; line-height:1.6;">
             Veuillez cliquer sur le bouton ci-dessous pour finaliser votre dossier d'inscription sur la plateforme VAGONDYS.
           </p>
        </div>
        <a href="${inscriptionLink}" style="background:#dc2626; color:white; padding:20px 40px; text-decoration:none; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:3px; border-radius:8px; display:inline-block;">
          Ouvrir le formulaire
        </a>
        <p style="margin-top:40px; font-size:8px; color:#3f3f46; text-transform:uppercase; letter-spacing:1px;">
          VAGONDYS - SYSTÈME DE GESTION DES ATHLÈTES
        </p>
      </div>
    `;

    const textContent = `CELLULE D'ENRÔLEMENT\n\nAccès au formulaire officiel\n\nOuvrir le formulaire: ${inscriptionLink}`;

    const emailResult = await sendGeneralEmail(
      email,
      "FORMULAIRE D'INSCRIPTION - VAGONDYS",
      textContent,
      htmlContent,
      "contact@vagondys.com"
    );

    if (!emailResult.messageId) throw new Error("Erreur d'envoi");
    return { success: true };

  } catch (error) {
    console.error("Erreur sendInvitation:", error);
    return { success: false, error: "L'envoi a échoué" };
  }
}
