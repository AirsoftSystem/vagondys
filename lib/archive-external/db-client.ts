
import { createClient } from "@supabase/supabase-js";
import { HistoryRow } from "./types";
import { createDynamicClient } from "@/lib/supabase/master";

// CLIENT UNIQUE : Connexion à la base MASTER (Tour de Contrôle)
// Utilisation stricte de vos variables d'environnement originales
export const supabaseMaster = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER!,
  process.env.SUPABASE_SERVICE_ROLE_KEY_MASTER!
);

/**
 * Recherche un signal actif par email
 * ADAPTATION : Cherche sur la base de la VILLE spécifiée (Gare de Triage)
 */
export async function findActiveSignalByEmail(email: string, cityCode?: string) {
  // Si on a un cityCode, on interroge la base de la ville, sinon le master
  const client = cityCode ? await createDynamicClient(cityCode, 'STAFF') : supabaseMaster;

  const { data } = await client
    .from("pending_signals")
    .select("dossier_ref")
    .or(`payload->>email.eq.${email.toLowerCase()}`)
    .not("dossier_ref", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  
  return data;
}

/**
 * Récupère l'historique des échanges depuis la table communication_replies
 * ADAPTATION : Capable de lire sur la base de la VILLE (STAFF)
 */
export async function getHistoryFromDB(ref: string, cityCode?: string): Promise<HistoryRow[]> {
  const client = cityCode ? await createDynamicClient(cityCode, 'STAFF') : supabaseMaster;

  const { data } = await client
    .from("communication_replies")
    .select("*")
    .eq("dossier_ref", ref)
    .order("created_at", { ascending: true });

  return (data as HistoryRow[]) || [];
}

/**
 * Exécute la purge atomique des données après archivage final
 * ADAPTATION : Purge sur la base de la VILLE (Fragmentation des données)
 * ✅ AJOUT : Paramètre countryCode pour cibler la bonne base STAFF
 */
export async function purgeDossierData(ref: string, cityCode?: string, countryCode: string = 'FR') {
  // ✅ AJOUT : Log pour tracer la purge
  console.log(`🗑️ purgeDossierData: purge pour ${ref} sur ville ${cityCode || 'MASTER'} (pays ${countryCode})`);
  
  let client;
  
  if (cityCode) {
    // ✅ AJOUT : Utilisation de countryCode dans createDynamicClient
    client = await createDynamicClient(cityCode, countryCode, 'STAFF');
    console.log(`🗑️ purgeDossierData: client STAFF créé pour ${cityCode}/${countryCode}`);
  } else {
    client = supabaseMaster;
    console.log(`🗑️ purgeDossierData: utilisation du MASTER`);
  }

  const [repliesResult, signalsResult] = await Promise.all([
    client.from("communication_replies").delete().eq("dossier_ref", ref),
    client.from("pending_signals").delete().eq("dossier_ref", ref)
  ]);

  if (repliesResult.error) {
    console.error(`❌ purgeDossierData: erreur suppression communication_replies:`, repliesResult.error);
  } else {
    console.log(`✅ purgeDossierData: communication_replies supprimées pour ${ref}`);
  }

  if (signalsResult.error) {
    console.error(`❌ purgeDossierData: erreur suppression pending_signals:`, signalsResult.error);
  } else {
    console.log(`✅ purgeDossierData: pending_signals supprimées pour ${ref}`);
  }

  return Promise.all([repliesResult, signalsResult]);
}
