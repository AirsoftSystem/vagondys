"use server";

import { createClient } from "@supabase/supabase-js";

export async function getAgentCity(email: string): Promise<string | null> {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER!,
    process.env.SUPABASE_SERVICE_ROLE_KEY_MASTER!
  );

  const { data, error } = await supabaseAdmin
    .from("staff_registry")
    .select("city")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (error || !data) return null;
  return data.city;
}
