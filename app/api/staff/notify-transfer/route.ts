
import { NextResponse } from 'next/server'
// Changement de l'import pour utiliser la bonne fonction de notification de transfert
import { sendIdentityTransferEmail } from '@/lib/email/gmail'

export async function POST(request: Request) {
  try {
    // ✅ IMPORT DYNAMIQUE - Chargé UNIQUEMENT à l'exécution, pas au build
    const { createClient } = await import('@supabase/supabase-js')
    
    // ✅ Récupération des variables d'environnement (Version Option B - un seul projet)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://www.vagondys.com';
    
    // ✅ Vérification des variables critiques
    if (!supabaseUrl || !supabaseKey) {
      console.error("Variables Supabase manquantes");
      return NextResponse.json({ error: "Configuration serveur invalide" }, { status: 500 });
    }
    
    // ✅ CLIENT ADMIN UNIQUE (Option B)
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

    const { userId, newEmail, pseudo, cityCode, countryCode } = await request.json()

    if (!userId || !newEmail) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 })
    }

    const targetEmail = newEmail.toLowerCase().trim()
    const activeCity = cityCode || "NANTES";
    const activeCountry = countryCode || "FR";

    console.log(`🔄 notify-transfer: transfert pour userId ${userId} vers ${targetEmail}, ville ${activeCity}/${activeCountry}`);

    // 1. RÉCUPÉRATION DES INFOS ACTUELLES
    const { data: athlete, error: fetchError } = await supabaseAdmin
      .from('athletes')
      .select('email, dossier_ref, pseudo, city, country')
      .eq('id', userId)
      .single()

    if (fetchError || !athlete) {
      console.error("❌ notify-transfer: athlète introuvable:", fetchError);
      throw new Error("Athlète introuvable dans la base de données.");
    }

    // Sécurité : on garde l'ancien email pour la mise à jour de l'annuaire Master
    const oldEmail = athlete.email.toLowerCase().trim();
    const finalCity = activeCity || athlete.city || "NANTES";
    const finalCountry = activeCountry || athlete.country || "FR";

    console.log(`📝 notify-transfer: ancien email: ${oldEmail}, nouveau: ${targetEmail}`);

    // 2. MISE À JOUR DE L'AUTH
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { 
        email: targetEmail, 
        email_confirm: true,
        user_metadata: {
          ...(athlete.pseudo && { pseudo: athlete.pseudo }),
          city: finalCity,
          country: finalCountry
        }
      }
    )
    if (authError) {
      console.error("❌ notify-transfer: erreur auth update:", authError);
      throw authError;
    }
    console.log(`✅ notify-transfer: auth mise à jour pour ${targetEmail}`);

    // 3. MISE À JOUR DE LA TABLE ATHLETES
    const { error: dbError } = await supabaseAdmin
      .from('athletes')
      .update({ email: targetEmail })
      .eq('id', userId)
    if (dbError) {
      console.error("❌ notify-transfer: erreur update athletes:", dbError);
      throw dbError;
    }
    console.log(`✅ notify-transfer: athletes mise à jour`);

    // 4. MISE À JOUR DE L'ANNUAIRE CENTRAL (athletes_registry)
    const { error: registryError } = await supabaseAdmin
      .from('athletes_registry')
      .update({ email: targetEmail })
      .eq('email', oldEmail)
    
    if (registryError) {
        console.error("⚠️ notify-transfer: erreur mise à jour annuaire:", registryError.message);
        // Non bloquant
    } else {
        console.log(`✅ notify-transfer: registry mise à jour`);
    }

    // 5. MISE À JOUR DES SIGNALS EN ATTENTE (version corrigée - sans RPC invalide)
    // Récupérer d'abord les signals concernés
    const { data: signalsToUpdate, error: fetchSignalsError } = await supabaseAdmin
      .from('pending_signals')
      .select('id, payload')
      .eq('payload->>email', oldEmail)

    if (fetchSignalsError) {
      console.error("⚠️ notify-transfer: erreur récupération pending_signals:", fetchSignalsError);
    } else if (signalsToUpdate && signalsToUpdate.length > 0) {
      // Mettre à jour chaque signal individuellement
      for (const signal of signalsToUpdate) {
        const updatedPayload = {
          ...signal.payload,
          email: targetEmail
        };
        
        const { error: updateError } = await supabaseAdmin
          .from('pending_signals')
          .update({ payload: updatedPayload })
          .eq('id', signal.id);
        
        if (updateError) {
          console.error(`⚠️ notify-transfer: erreur mise à jour signal ${signal.id}:`, updateError);
        } else {
          console.log(`✅ notify-transfer: signal ${signal.id} mis à jour`);
        }
      }
    }

    // 6. SYNCHRONISATION GITHUB (Archivage)
    if (athlete?.dossier_ref) {
      try {
        const baseUrl = new URL(request.url).origin
        console.log(`📦 notify-transfer: archivage GitHub pour ${athlete.dossier_ref}`);
        await fetch(`${baseUrl}/api/archive-external`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              id: userId,
              dossier_ref: athlete.dossier_ref,
              payload: {
                name: athlete.pseudo || pseudo,
                email: targetEmail,
                subject: "MISE À JOUR IDENTITÉ",
                message: `TRANSFERT D'EMAIL RÉALISÉ PAR LE STAFF. ANCIEN EMAIL: ${oldEmail}`,
                city: finalCity,
                country: finalCountry
              }
            },
            history: [],
            purgeActive: false,
            city_code: finalCity,
            country_code: finalCountry
          })
        })
        console.log(`✅ notify-transfer: archivage GitHub OK`);
      } catch (githubErr) {
        console.error("⚠️ notify-transfer: erreur synchro GitHub:", githubErr)
      }
    }

    // 7. ENVOI DE L'EMAIL DE NOTIFICATION
    const loginUrl = `${frontendUrl}/login`
    
    await sendIdentityTransferEmail(
      targetEmail,
      loginUrl,
      athlete.pseudo || pseudo || "Athlète",
      "DÉPARTEMENT SÉCURITÉ"
    )

    console.log(`✅ notify-transfer: transfert terminé avec succès pour ${targetEmail}`);
    return NextResponse.json({ success: true, message: "TRANSFERT D'IDENTITÉ RÉUSSI" })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Erreur transfert identité";
    console.error("❌ notify-transfer: CRASH:", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
