
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    master: process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER,
    nantes: process.env.NEXT_PUBLIC_SUPABASE_URL_FR_NANTES,
    nodeEnv: process.env.NODE_ENV,
  });
}
