"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AggregateTotals from "./AggregateTotals";
import PartsManagement, { type AdminPartRow } from "./PartsManagement";
import LiveActivityFeed from "./LiveActivityFeed";
import VolunteerSearch from "./VolunteerSearch";
import AdminManagement from "./AdminManagement";
import Leaderboard from "@/components/Leaderboard";
import type { PartTotal, ActivityEntry } from "@/lib/types";

type NewContribution = {
  id: string;
  part_id: string;
  quantity: number;
};

// Owns the ONE real-time subscription in the entire app (contribution changes).
// Inserts bump the matching aggregate tile and prepend to the live feed. Deletes
// can happen through volunteer undo/remove actions, so those trigger one compact
// refresh to keep admin totals and activity accurate.
export default function AdminDashboard({
  currentVolunteerId,
  initialTotals,
  initialParts,
  initialActivity,
}: {
  currentVolunteerId: string;
  initialTotals: PartTotal[];
  initialParts: AdminPartRow[];
  initialActivity: ActivityEntry[];
}) {
  const [totals, setTotals] = useState<PartTotal[]>(initialTotals);
  const [parts, setParts] = useState<AdminPartRow[]>(initialParts);
  const [activity, setActivity] = useState<ActivityEntry[]>(initialActivity);
  const [live, setLive] = useState(false);

  function handlePartsChange(nextParts: AdminPartRow[]) {
    setParts(nextParts);
    setTotals((prev) => {
      const totalsByPartId = new Map(prev.map((t) => [t.part_id, t.total]));

      return nextParts
        .filter((part) => part.is_active)
        .map((part) => ({
          part_id: part.part_id,
          name: part.name,
          total: totalsByPartId.get(part.part_id) ?? part.total,
        }));
    });
  }

  useEffect(() => {
    const supabase = createClient();

    async function refreshDashboard() {
      const [{ data: nextTotals }, { data: nextActivity }] = await Promise.all([
        supabase.rpc("get_part_totals"),
        supabase
          .from("contributions")
          .select("id, created_at, parts(name), volunteers(display_name)")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      if (nextTotals) {
        setTotals(nextTotals as PartTotal[]);
      }

      if (nextActivity) {
        const rows = nextActivity as unknown as {
          id: string;
          created_at: string;
          parts: { name: string } | null;
          volunteers: { display_name: string | null } | null;
        }[];

        setActivity(
          rows.map((row) => ({
            id: row.id,
            created_at: row.created_at,
            part_name: row.parts?.name ?? "Unknown part",
            volunteer_name: row.volunteers?.display_name ?? "A volunteer",
          }))
        );
      }
    }

    const channel = supabase
      .channel("admin-contributions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contributions" },
        async (payload) => {
          if (payload.eventType !== "INSERT") {
            await refreshDashboard();
            return;
          }

          const row = payload.new as NewContribution;

          // Optimistically bump the aggregate tile for this part (no query).
          setTotals((prev) =>
            prev.map((t) =>
              t.part_id === row.part_id
                ? { ...t, total: t.total + row.quantity }
                : t
            )
          );

          // Fetch the one new row joined with names for the activity feed.
          const { data } = await supabase
            .from("contributions")
            .select("id, created_at, parts(name), volunteers(display_name)")
            .eq("id", row.id)
            .single<{
              id: string;
              created_at: string;
              parts: { name: string } | null;
              volunteers: { display_name: string | null } | null;
            }>();

          if (data) {
            setActivity((prev) =>
              [
                {
                  id: data.id,
                  created_at: data.created_at,
                  part_name: data.parts?.name ?? "Unknown part",
                  volunteer_name:
                    data.volunteers?.display_name ?? "A volunteer",
                },
                ...prev,
              ].slice(0, 20)
            );
          }
        }
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const activeParts = parts
    .filter((p) => p.is_active)
    .map((p) => ({ id: p.part_id, name: p.name }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left column — two-thirds width */}
      <div className="space-y-6 lg:col-span-2">
        <AggregateTotals totals={totals} live={live} />
        <Leaderboard parts={activeParts} highlightId={currentVolunteerId} />
        <VolunteerSearch />
        <PartsManagement
          initialParts={initialParts}
          onPartsChange={handlePartsChange}
        />
        <AdminManagement currentVolunteerId={currentVolunteerId} />
      </div>

      {/* Right column — one-third width */}
      <div className="lg:col-span-1">
        <LiveActivityFeed activity={activity} live={live} />
      </div>
    </div>
  );
}
