"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export function UserMenu() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      setUser(null);
      router.push("/login");
      router.refresh();
    }
  };

  if (loading) {
    return (
      <div className="px-3 py-2 text-xs text-[var(--rail-texte-discret)]">
        Chargement...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-3 border-t border-[var(--rail-bordure)]">
        <Link
          href="/login"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--rail-actif)] px-3 py-2 text-xs font-semibold text-[var(--rail-actif-texte)] transition-opacity hover:opacity-90 shadow-sm"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
          </svg>
          <span>Se connecter</span>
        </Link>
      </div>
    );
  }

  const avatarUrl = user.user_metadata?.avatar_url;
  const name = user.user_metadata?.full_name || user.email?.split("@")[0] || "Compte";

  return (
    <div className="p-3 border-t border-[var(--rail-bordure)]">
      <div className="flex items-center justify-between gap-2 rounded-xl bg-white/5 border border-[var(--rail-bordure)] p-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={name}
              className="size-7 rounded-full object-cover shrink-0 ring-1 ring-white/20"
            />
          ) : (
            <div className="size-7 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs font-semibold shrink-0 border border-indigo-500/30">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-[var(--rail-texte)]">
              {name}
            </div>
            <div className="truncate text-[0.625rem] text-[var(--rail-texte-discret)]">
              {user.email}
            </div>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          title="Se déconnecter"
          className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--rail-texte-discret)] hover:text-rose-400 transition-colors shrink-0"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </div>
  );
}
