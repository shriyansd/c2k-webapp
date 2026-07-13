import { createClient } from "@/lib/supabase/server";
import HistoryLog from "@/components/tracker/HistoryLog";
import type { HistoryEntry } from "@/lib/types";

// "My History": last 20 contributions by this volunteer, rendered server-side.
export const dynamic = "force-dynamic";

type HistoryRow = {
  id: string;
  created_at: string;
  parts: { name: string } | null;
};

export default async function HistoryPage() {
  const supabase = createClient();

  const { data } = await supabase
    .from("contributions")
    .select("id, created_at, parts(name)")
    .order("created_at", { ascending: false })
    .limit(20);

  const entries: HistoryEntry[] = (
    (data ?? []) as unknown as HistoryRow[]
  ).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    part_name: row.parts?.name ?? "Unknown part",
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">My History</h1>
      <HistoryLog entries={entries} />
    </div>
  );
}
