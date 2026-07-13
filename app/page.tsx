import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Entry point: send authenticated users to the tracker, everyone else to login.
export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/tracker" : "/login");
}
