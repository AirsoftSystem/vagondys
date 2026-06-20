
// app/api/cron/purge-old-data/route.ts
import { NextResponse } from "next/server";
import { masterAdmin } from "@/lib/supabase/master";

// ==========================================================
// TYPES
// ==========================================================

interface PurgeResult {
  success: boolean;
  timestamp: string;
  duration_ms: number;
  purged: {
    match_history: number;
    messagerie_messages: number;
    communication_replies: number;
    tournament_results: number;
    rankings_history: number;
    as_eg_sessions: number;
  };
  archived_conversations: number;
  errors: string[];
  dry_run: boolean;
}

// ==========================================================
// CONFIGURATION
// ==========================================================

const RETENTION_DAYS = 30;

// ==========================================================
// FONCTIONS
// ==========================================================

async function purgeTable(
  supabase: NonNullable<typeof masterAdmin>,
  table: string,
  dateColumn: string,
  olderThan: Date,
  additionalFilter?: Record<string, unknown>
): Promise<number> {
  try {
    let query = supabase
      .from(table)
      .delete()
      .lt(dateColumn, olderThan.toISOString());

    if (additionalFilter) {
      for (const [key, value] of Object.entries(additionalFilter)) {
        query = query.eq(key, value);
      }
    }

    const { error, count } = await query;

    if (error) {
      console.error(`❌ [purge-old-data] Erreur purge ${table}:`, error);
      return 0;
    }

    console.log(`✅ [purge-old-data] ${table}: ${count || 0} lignes purgées`);
    return count || 0;
  } catch (err) {
    console.error(`❌ [purge-old-data] Exception purge ${table}:`, err);
    return 0;
  }
}

// ==========================================================
// ROUTE PRINCIPALE
// ==========================================================

export async function GET(request: Request) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dry_run") === "true";

  // Sécurité
  const secret = url.searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && secret !== expectedSecret) {
    console.warn("⛔ [purge-old-data] Tentative non autorisée");
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  console.log(`🧹 [purge-old-data] Début${dryRun ? " (DRY RUN)" : ""}`);

  const result: PurgeResult = {
    success: true,
    timestamp,
    duration_ms: 0,
    purged: {
      match_history: 0,
      messagerie_messages: 0,
      communication_replies: 0,
      tournament_results: 0,
      rankings_history: 0,
      as_eg_sessions: 0,
    },
    archived_conversations: 0,
    errors: [],
    dry_run: dryRun,
  };

  try {
    if (!masterAdmin) {
      console.error("❌ [purge-old-data] masterAdmin non disponible");
      return NextResponse.json(
        { error: "masterAdmin non disponible" },
        { status: 500 }
      );
    }

    const olderThan = new Date();
    olderThan.setDate(olderThan.getDate() - RETENTION_DAYS);

    console.log(`📅 [purge-old-data] Purge antérieure à ${olderThan.toISOString()}`);

    if (!dryRun) {
      // Purge des tables
      result.purged.match_history = await purgeTable(
        masterAdmin,
        "match_history",
        "date",
        olderThan
      );

      result.purged.messagerie_messages = await purgeTable(
        masterAdmin,
        "messagerie_messages",
        "created_at",
        olderThan,
        { sender_email: "system@vagondys.com" }
      );

      result.purged.communication_replies = await purgeTable(
        masterAdmin,
        "communication_replies",
        "created_at",
        olderThan
      );

      result.purged.tournament_results = await purgeTable(
        masterAdmin,
        "tournament_results",
        "tournament_date",
        olderThan
      );

      result.purged.rankings_history = await purgeTable(
        masterAdmin,
        "rankings_history",
        "week_start",
        olderThan
      );

      result.purged.as_eg_sessions = await purgeTable(
        masterAdmin,
        "as_eg_sessions",
        "created_at",
        olderThan,
        { archived: false }
      );
    }

    result.duration_ms = Date.now() - startTime;

    console.log("✅ [purge-old-data] Purge terminée", {
      duration: `${result.duration_ms}ms`,
      dry_run: dryRun,
      purged: result.purged,
    });

    return NextResponse.json(result);

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("❌ [purge-old-data] Erreur critique:", errorMsg);

    result.success = false;
    result.errors.push(`Erreur critique: ${errorMsg}`);
    result.duration_ms = Date.now() - startTime;

    return NextResponse.json(result, { status: 500 });
  }
}

export const runtime = "nodejs";
export const maxDuration = 300;
