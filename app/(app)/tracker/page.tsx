import { createClient } from "@/lib/supabase/server";
import Tracker from "@/components/tracker/Tracker";
import type { Part, PartTotal, HistoryEntry } from "@/lib/types";

// Server Component: load active parts, the volunteer's personal totals, and
// their recent history once on initial render (cuts client JS and round-trips).
// The client Tracker caches the parts list and only re-runs the totals RPC and
// history fetch after a contribution.
export const dynamic = "force-dynamic";

type HistoryRow = {
  id: string;
  created_at: string;
  parts: { name: string } | null;
};

export default async function TrackerPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: parts }, { data: totals }, { data: history }] =
    await Promise.all([
      supabase
        .from("parts")
        .select("id, name, is_active, created_at")
        .eq("is_active", true)
        .order("name"),
      supabase.rpc("get_my_part_totals"),
      supabase
        .from("contributions")
        .select("id, created_at, parts(name)")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  const initialHistory: HistoryEntry[] = (
    (history ?? []) as unknown as HistoryRow[]
  ).map((row) => ({
      id: row.id,
      created_at: row.created_at,
      part_name: row.parts?.name ?? "Unknown part",
    })
  );

  return (
    <Tracker
      volunteerId={user!.id}
      initialParts={(parts ?? []) as Part[]}
      initialTotals={(totals ?? []) as PartTotal[]}
      initialHistory={initialHistory}
    />
  );
}
