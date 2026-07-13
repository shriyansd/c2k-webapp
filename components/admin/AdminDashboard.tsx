"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AggregateTotals from "./AggregateTotals";
import PartsManagement, { type AdminPartRow } from "./PartsManagement";
import LiveActivityFeed from "./LiveActivityFeed";
import type { PartTotal, ActivityEntry } from "@/lib/types";

type NewContribution = {
  id: string;
  part_id: string;
  quantity: number;
};

// Owns the ONE real-time subscription in the entire app (contributions INSERT).
// Each insert bumps the matching aggregate tile and prepends to the live feed.
// Parts management runs independently (no subscription).
export default function AdminDashboard({
  initialTotals,
  initialParts,
  initialActivity,
}: {
  initialTotals: PartTotal[];
  initialParts: AdminPartRow[];
  initialActivity: ActivityEntry[];
}) {
  const [totals, setTotals] = useState<PartTotal[]>(initialTotals);
  const [activity, setActivity] = useState<ActivityEntry[]>(initialActivity);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("admin-contributions")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "contributions" },
        async (payload) => {
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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left column — two-thirds width */}
      <div className="space-y-6 lg:col-span-2">
        <AggregateTotals totals={totals} live={live} />
        <PartsManagement initialParts={initialParts} />
      </div>

      {/* Right column — one-third width */}
      <div className="lg:col-span-1">
        <LiveActivityFeed activity={activity} live={live} />
      </div>
    </div>
  );
}
