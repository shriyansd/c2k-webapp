import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuthForm from "@/components/AuthForm";

// Already signed in? Skip the login screen.
export default async function LoginPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/tracker");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Computers2Kids</h1>
          <p className="mt-1 text-sm text-slate-500">Contribution Tracker</p>
        </div>
        <AuthForm />
      </div>
    </main>
  );
}
