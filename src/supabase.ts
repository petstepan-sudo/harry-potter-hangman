import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const TABLE = "hangman_wins";

export type LeaderboardEntry = {
  id: string;
  playerName: string;
  durationMs: number;
  finishedAt: string;
};

type HangmanWinRow = {
  id: string;
  player_name: string;
  duration_ms: number;
  finished_at: string;
};

function rowToEntry(row: HangmanWinRow): LeaderboardEntry {
  return {
    id: row.id,
    playerName: row.player_name,
    durationMs: row.duration_ms,
    finishedAt: row.finished_at,
  };
}

export function getSupabaseClient(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  try {
    return createClient(url, key);
  } catch (e) {
    console.error("Supabase klient se nepodařilo vytvořit:", e);
    return null;
  }
}

export async function fetchLeaderboard(
  client: SupabaseClient,
  limit: number,
): Promise<LeaderboardEntry[]> {
  const { data, error } = await client
    .from(TABLE)
    .select("id, player_name, duration_ms, finished_at")
    .order("duration_ms", { ascending: true })
    .order("finished_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  if (!data) return [];
  return (data as HangmanWinRow[]).map(rowToEntry);
}

export async function insertWin(
  client: SupabaseClient,
  entry: Omit<LeaderboardEntry, "id">,
): Promise<string> {
  const { data, error } = await client
    .from(TABLE)
    .insert({
      player_name: entry.playerName,
      duration_ms: entry.durationMs,
      finished_at: entry.finishedAt,
    })
    .select("id")
    .single();

  if (error) throw error;
  return (data as { id: string }).id;
}
