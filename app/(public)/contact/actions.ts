
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
  messages_history?: Array<{
    content: string;
    created_at: string;
  }>;
}

/**
 * ACTION 1 : Envoi du formulaire initial (calqué sur l'inscription)
 */
export async function submitContact(formData: FormData) {
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY_MASTER;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.vagondys.com";
  
  if (!supabaseUrl || !supabaseKey) {
    redirect("/contact?status=error");
  }
  
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseMaster = createClient(supabaseUrl, supabaseKey);
  
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const phone = String(formData.get("phone") || "").trim();
  const subject = String(formData.get("subject") || "").trim();
  const message = String(formData.get("message") || "").trim();
  const country = String(formData.get("country") || "FR").trim().toUpperCase();
  const city = String(formData.get("city") || "NANTES").trim().toUpperCase();

  const token = formData.get("cf-turnstile-response");
  if (!token) {
    redirect("/contact?status=security_error");
  }

  try {
    // 1. RECHERCHE DANS LE REGISTRE MASTER
    const { data: registryEntry } = await supabaseMaster
      .from('athletes_registry')
      .select('city, country, dossier_ref')
      .eq('email', email)
      .maybeSingle();

    let existingDossierRef: string | null = registryEntry?.dossier_ref || null;
    
    // 2. RECHERCHE DANS PENDING_SIGNALS (STAFF)
    if (!existingDossierRef) {
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
        }
      } catch {
        // Ignoré
      }
    }
    
    // 3. RECHERCHE DANS GITHUB
    if (!existingDossierRef) {
      try {
        const searchUrl = `${siteUrl}/api/archive-external?search=${email.toLowerCase().replace(/[@.]/g, '_')}&city_code=${city}&country_code=${country}`;
        const searchRes = await fetch(searchUrl);
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData.dossier_ref) {
            existingDossierRef = searchData.dossier_ref;
          }
        }
      } catch {
        // Ignoré
      }
    }

    let dossier_ref: string;
    let isNewDossier = false;
    
    if (existingDossierRef) {
      dossier_ref = existingDossierRef;
    } else {
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
    }

    // 4. CRÉATION DU CLIENT STAFF
    let cityStaffClient;
    try {
      cityStaffClient = await createDynamicClient(city, country, 'STAFF');
      const { error: testError } = await cityStaffClient
        .from('pending_signals')
        .select('count', { count: 'exact', head: true });
      
      if (testError) {
        throw new Error(`Client STAFF invalide: ${testError.message}`);
      }
    } catch (clientErr) {
      throw new Error(`Erreur client STAFF: ${clientErr instanceof Error ? clientErr.message : String(clientErr)}`);
    }
    
    let insertData;
    
    // 5. VÉRIFICATION SI SIGNAL EXISTE DÉJÀ
    const { data: existingSignal, error: checkError } = await cityStaffClient
      .from('pending_signals')
      .select('id, dossier_ref, payload, confirmed, created_at')
      .eq('payload->>email', email)
      .maybeSingle();
    
    if (checkError) {
      throw new Error(`Erreur vérification signal: ${checkError.message}`);
    }
    
    if (existingSignal) {
      // ✅ Enrichir le payload existant avec l'historique
      const currentPayload = existingSignal.payload as SignalPayload;
      const messagesHistory = currentPayload.messages_history || [];
      
      // Ajouter l'ancien message à l'historique s'il n'y est pas
      if (currentPayload.message && messagesHistory.length === 0) {
        messagesHistory.push({
          content: currentPayload.message,
          created_at: existingSignal.created_at || new Date().toISOString()
        });
      }
      
      // Ajouter le nouveau message
      messagesHistory.push({
        content: message,
        created_at: new Date().toISOString()
      });
      
      const updatedPayload: SignalPayload = {
        ...currentPayload,
        message: message,
        messages_history: messagesHistory
      };
      
      // ✅ Mise à jour : is_read = false, confirmed = false, payload enrichi
      const { data: updatedData, error: updateError } = await cityStaffClient
        .from('pending_signals')
        .update({
          is_read: false,
          confirmed: false,
          payload: updatedPayload
        })
        .eq('id', existingSignal.id)
        .select()
        .single();
      
      if (updateError) {
        throw new Error(`Erreur mise à jour signal: ${updateError.message}`);
      }
      insertData = updatedData;
      
    } else {
      // Création d'un nouveau signal (premier message)
      const insertPayload: SignalPayload = { 
        name, email, phone, subject, message,
        city: registryEntry?.city || city,
        country: registryEntry?.country || country,
        messages_history: []
      };
      
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
        throw new Error(`Erreur insertion signal: ${dbError.message}`);
      }
      insertData = newData;
    }

    // 6. ENVOI DE L'EMAIL - TOUJOURS "ACTION REQUISE" (pas "NOUVEAU MESSAGE")
    const confirmLink = `${siteUrl}/api/confirm-signal?service=${encodeURIComponent(subject)}&city=${city}&country=${country}&id=${insertData.id}`;

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
          ACTIVER LA TRANSMISSION
        </a>
        <p style="margin-top:30px; font-size:8px; color:#3f3f46; text-transform:uppercase; letter-spacing:1px;">
          Cet email est généré automatiquement.
        </p>
      </div>
    `;

    const textContent = `Protocole Sécurisé - Référence Dossier: ${dossier_ref}\n\nMessage à valider: "${message}"\n\nActivez votre transmission ici: ${confirmLink}`;

    try {
      // ✅ Sujet unique pour TOUS les messages : "ACTION REQUISE : Confirmez votre signal"
      await sendGeneralEmail(
        email,
        "ACTION REQUISE : Confirmez votre signal",
        textContent,
        htmlContent,
        "contact@vagondys.com"
      );
    } catch {
      // Non bloquant
    }

  } catch (error) {
    const err = error as Error;
    redirect(`/contact?status=error&message=${encodeURIComponent(err.message)}`);
  }

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
    
  } catch {
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

  } catch {
    return { success: false, error: "L'envoi a échoué" };
  }
}
