
// actions/get-staff-config.ts
'use server';

import { getStationConfig } from '@/lib/supabase/master';

export interface StaffConfig {
  staff_url: string;
  staff_anon_key: string;
  staff_service_key: string;
  city: string;
  country: string;
}

export async function getStaffConfig(cityCode: string, countryCode: string = 'FR'): Promise<StaffConfig | null> {
  try {
    const config = await getStationConfig(cityCode, countryCode);
    
    if (!config) {
      console.error(`❌ getStaffConfig: Aucune configuration trouvée pour ${countryCode}_${cityCode}`);
      return null;
    }
    
    if (!config.staff_url || !config.staff_anon_key) {
      console.error(`❌ getStaffConfig: Configuration STAFF incomplète pour ${countryCode}_${cityCode}`);
      return null;
    }
    
    console.log(`✅ getStaffConfig: Configuration récupérée pour ${cityCode}`);
    
    return {
      staff_url: config.staff_url,
      staff_anon_key: config.staff_anon_key,
      staff_service_key: config.staff_service_key,
      city: config.city_code,
      country: config.country_code,
    };
    
  } catch (error) {
    console.error('❌ getStaffConfig: Erreur', error);
    return null;
  }
}
