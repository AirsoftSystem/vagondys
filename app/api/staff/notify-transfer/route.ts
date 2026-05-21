
import { NextResponse } from 'next/server'
// Changement de l'import pour utiliser la bonne fonction de notification de transfert
import { sendIdentityTransferEmail } from '@/lib/email/gmail'
import { getStationConfig, createDynamicClient } from '@/lib/supabase/master'

export async function POST(request: Request) {
  try {
    // ✅ IMPORT DYNAMIQUE - Chargé UNIQUEMENT à l'exécution, pas au build
    const { createClient } = await import('@supabase/supabase-js')
    
    // ✅ Récupération des variables d'environnement à l'exécution
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY_MASTER;
    const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://www.vagondys.com';
    
    // ✅ Vérification des variables critiques
    if (!supabaseUrl || !supabaseKey) {
      console.error("Variables Supabase MASTER manquantes");
      return NextResponse.json({ error: "Configuration serveur invalide" }, { status: 500 });
    }
    
    // CLIENT ADMIN POUR LE MASTER (La Tour de Contrôle) - créé à l'exécution
    const supabaseAdminMaster = createClient(supabaseUrl, supabaseKey)

    const { userId, newEmail, pseudo, cityCode } = await request.json()

    if (!userId || !newEmail) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 })
    }

    const targetEmail = newEmail.toLowerCase().trim()

    // --- LOGIQUE DE FRAGMENTATION ---
    let targetAdmin = supabaseAdminMaster;
    let city = cityCode;

    // Si on a le cityCode, on crée le client spécifique à la ville pour les opérations locales
    if (cityCode) {
      const config = await getStationConfig(cityCode);
      if (config) {
        targetAdmin = await createDynamicClient(cityCode, 'PUBLIC');
      }
    }

    // 1. RÉCUPÉRATION DES INFOS ACTUELLES (Dans la DB de la Ville ou Master)
    const { data: athlete, error: fetchError } = await targetAdmin
      .from('athletes')
      .select('email, dossier_ref, pseudo, city')
      .eq('id', userId)
      .single()

    if (fetchError || !athlete) {
      throw new Error("Athlète introuvable dans la base de données sélectionnée.");
    }

    // Sécurité : on garde l'ancien email pour la mise à jour de l'annuaire Master
    const oldEmail = athlete.email.toLowerCase().trim();
    if (!city) city = athlete.city;

    // 2. MISE À JOUR DE L'AUTH (Dans la DB cible via Admin Auth)
    const { error: authError } = await targetAdmin.auth.admin.updateUserById(
      userId,
      { 
        email: targetEmail, 
        email_confirm: true 
      }
    )
    if (authError) throw authError

    // 3. MISE À JOUR DE LA TABLE ATHLETES (Dans la DB cible / Ville)
    const { error: dbError } = await targetAdmin
      .from('athletes')
      .update({ email: targetEmail })
      .eq('id', userId)
    if (dbError) throw dbError

    // 4. MISE À JOUR DE L'ANNUAIRE CENTRAL (MASTER) - CRUCIAL POUR LE PROXY
    // On met à jour l'email dans 'athletes_registry' pour que locateAthleteStation fonctionne encore
    const { error: registryError } = await supabaseAdminMaster
      .from('athletes_registry')
      .update({ email: targetEmail })
      .eq('email', oldEmail)
    
    if (registryError) {
        console.error("Erreur mise à jour Annuaire Master:", registryError.message);
        // On continue quand même car l'auth est déjà changée, mais c'est un point d'attention
    }

    // 5. SYNCHRONISATION GITHUB (Archivage dans le bon repo via city_code)
    if (athlete?.dossier_ref) {
      try {
        const baseUrl = new URL(request.url).origin
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
                message: `TRANSFERT D'EMAIL RÉALISÉ PAR LE STAFF. ANCIEN EMAIL: ${oldEmail}`
              }
            },
            history: [],
            purgeActive: false,
            city_code: city // Indispensable pour que l'API archive-external sélectionne le bon TOKEN et REPO
          })
        })
      } catch (githubErr) {
        console.error("Erreur synchro GitHub lors du transfert:", githubErr)
      }
    }

    // 6. ENVOI DE L'EMAIL DE NOTIFICATION
    const loginUrl = `${frontendUrl}/login`
    
    await sendIdentityTransferEmail(
      targetEmail,
      loginUrl,
      athlete.pseudo || pseudo || "Athlète",
      "DÉPARTEMENT SÉCURITÉ"
    )

    return NextResponse.json({ success: true, message: "TRANSFERT D'IDENTITÉ RÉUSSI" })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Erreur transfert identité";
    console.error("CRASH TRANSFERT IDENTITÉ:", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
