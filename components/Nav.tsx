"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Top navigation. Admin link only rendered when `isAdmin` is true — non-admins
// never see it. Includes sign-out.
export default function Nav({
  isAdmin,
  displayName,
}: {
  isAdmin: boolean;
  displayName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [signingOut, setSigningOut] = useState(false);

  const links = [
    { href: "/tracker", label: "Tracker" },
    { href: "/history", label: "My History" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  async function signOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          <span className="mr-3 shrink-0 font-bold text-brand">C2K</span>
          <nav className="flex items-center gap-1">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-brand/10 text-brand"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden text-sm text-slate-500 sm:inline">
            {displayName}
          </span>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
          >
            {signingOut ? "…" : "Sign out"}
          </button>
        </div>
      </div>
    </header>
  );
}
