import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminDashboard from "@/components/admin/AdminDashboard";
import type { PartTotal, ActivityEntry } from "@/lib/types";
import type { AdminPartRow } from "@/components/admin/PartsManagement";

// Admin dashboard. Guarded server-side (non-admins are redirected). Loads the
// initial aggregate totals, full parts list, and recent activity; the client
// AdminDashboard takes over with a SINGLE real-time subscription for live
// updates to both the totals tiles and the activity feed.
export const dynamic = "force-dynamic";

type ActivityRow = {
  id: string;
  created_at: string;
  parts: { name: string } | null;
  volunteers: { display_name: string | null } | null;
};

export default async function AdminPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: adminRow } = await supabase
    .from("admins")
    .select("id")
    .eq("volunteer_id", user.id)
    .maybeSingle();
  if (!adminRow) redirect("/tracker");

  const [{ data: totals }, { data: allParts }, { data: activity }] =
    await Promise.all([
      supabase.rpc("get_part_totals"),
      supabase.rpc("get_all_part_totals"),
      supabase
        .from("contributions")
        .select("id, created_at, parts(name), volunteers(display_name)")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  const initialActivity: ActivityEntry[] = (
    (activity ?? []) as unknown as ActivityRow[]
  ).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    part_name: row.parts?.name ?? "Unknown part",
    volunteer_name: row.volunteers?.display_name ?? "A volunteer",
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Admin Dashboard</h1>
      <AdminDashboard
        initialTotals={(totals ?? []) as PartTotal[]}
        initialParts={(allParts ?? []) as AdminPartRow[]}
        initialActivity={initialActivity}
      />
    </div>
  );
}
