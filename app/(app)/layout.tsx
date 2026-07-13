import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";

// Auth-guarded shell for all signed-in pages. Determines admin status once
// (single indexed lookup) so the Nav can conditionally show the Admin link.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  const { data: volunteer } = await supabase
    .from("volunteers")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = Boolean(adminRow);
  const displayName = volunteer?.display_name ?? user.email ?? "Volunteer";

  return (
    <div className="min-h-screen">
      <Nav isAdmin={isAdmin} displayName={displayName} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
