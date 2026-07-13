"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ErrorBanner from "@/components/ui/ErrorBanner";
import Spinner from "@/components/ui/Spinner";

type Mode = "login" | "signup";

// Internal domain used to turn a username into a synthetic email for Supabase
// Auth. No real email is ever collected or sent (confirmation is disabled), so
// this domain never needs to receive mail — it just keeps usernames unique.
const USERNAME_DOMAIN = "c2k.local";

// Usernames: letters, numbers, and . _ - only; 3–30 chars. Kept simple so they
// form a valid email local-part.
const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;

// Map what the user typed to the email Supabase Auth expects. Existing accounts
// created with a real email still work: if the input already contains "@", it's
// used as-is; otherwise it becomes "<username>@c2k.local".
function toEmail(input: string): string {
  const v = input.trim().toLowerCase();
  return v.includes("@") ? v : `${v}@${USERNAME_DOMAIN}`;
}

// Tabbed login / signup form. Collects only a username + password — no email or
// other personal information.
export default function AuthForm() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const uname = username.trim();

      if (mode === "signup") {
        // New accounts are username-only (no "@" allowed).
        if (!USERNAME_RE.test(uname.toLowerCase())) {
          setError(
            "Username must be 3–30 characters: letters, numbers, and . _ - only."
          );
          return;
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email: toEmail(uname),
          password,
          // Store the username as the display name shown throughout the app.
          options: { data: { display_name: uname } },
        });
        if (signUpError) {
          setError(
            /already registered|already exists/i.test(signUpError.message)
              ? "That username is already taken."
              : signUpError.message
          );
          return;
        }
      } else {
        if (!uname) {
          setError("Please enter your username.");
          return;
        }
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: toEmail(uname),
          password,
        });
        if (signInError) {
          setError(
            /invalid login credentials/i.test(signInError.message)
              ? "Incorrect username or password."
              : signInError.message
          );
          return;
        }
      }

      // Session is set; navigate to the tracker and refresh server components.
      router.replace("/tracker");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => switchMode("login")}
          className={`rounded-md py-2 text-sm font-medium transition ${
            mode === "login"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500"
          }`}
        >
          Log In
        </button>
        <button
          type="button"
          onClick={() => switchMode("signup")}
          className={`rounded-md py-2 text-sm font-medium transition ${
            mode === "signup"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500"
          }`}
        >
          Sign Up
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="username"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Username
          </label>
          <input
            id="username"
            type="text"
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            placeholder="jordan_r"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            placeholder="••••••••"
          />
        </div>

        <ErrorBanner message={error} onDismiss={() => setError(null)} />

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-3 text-base font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
        >
          {loading && (
            <Spinner label="Please wait" className="border-white/40 border-t-white" />
          )}
          {mode === "signup" ? "Create account" : "Log in"}
        </button>

        {mode === "signup" && (
          <p className="text-center text-xs text-slate-400">
            No email required. Choose any username you like.
          </p>
        )}
      </form>
    </div>
  );
}
