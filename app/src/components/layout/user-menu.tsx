"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export function UserMenu() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
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

  const avatarUrl = user?.user_metadata?.avatar_url;
  const username = user
    ? user.user_metadata?.full_name || user.email?.split("@")[0] || "Compte"
    : "Maxime (Mode local)";

  return (
    <>
      <div className="border-t border-[var(--rail-bordure)] p-3">
        <div className="rounded-xl border border-[var(--rail-bordure)] bg-[var(--rail-2)] p-2.5 shadow-sm transition-all hover:border-[var(--rail-texte-discret)]/30">
          <div className="flex items-center justify-between gap-2">
            {/* User Avatar + Username */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={username}
                    className="size-8 rounded-full object-cover ring-2 ring-[var(--rail-actif)]/40"
                  />
                ) : (
                  <div className="size-8 rounded-full bg-gradient-to-br from-indigo-500/30 to-emerald-500/30 text-indigo-200 flex items-center justify-center text-xs font-bold ring-1 ring-white/20">
                    {username.charAt(0).toUpperCase()}
                  </div>
                )}
                {/* Status Dot */}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-[var(--rail-2)] ${
                    user ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                  title={user ? "Connecté via Supabase" : "Mode profil local"}
                />
              </div>

              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-[var(--rail-texte)]">
                  {username}
                </div>
                <div className="truncate text-[0.625rem] text-[var(--rail-texte-discret)]">
                  {user ? user.email : "Local (Sans Supabase)"}
                </div>
              </div>
            </div>

            {/* Action Buttons: Login / Sign In / Settings / Logout */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Parameters Button */}
              <button
                onClick={() => setShowSettings(true)}
                title="Paramètres du compte"
                className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--rail-texte-attenue)] hover:text-[var(--rail-texte)] transition-colors"
              >
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>

              {user ? (
                /* Logout Button */
                <button
                  onClick={handleSignOut}
                  title="Déconnexion"
                  className="p-1.5 rounded-lg hover:bg-rose-500/20 text-[var(--rail-texte-attenue)] hover:text-rose-300 transition-colors"
                >
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.75}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                </button>
              ) : (
                /* Login / Sign Up Button */
                <Link
                  href="/login"
                  title="Se connecter ou s'inscrire"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--rail-actif)] text-[var(--rail-actif-texte)] text-[0.6875rem] font-semibold transition-transform active:scale-95 shadow-sm hover:opacity-90"
                >
                  <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                    />
                  </svg>
                  <span>Connexion</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Parameters Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 text-slate-100 shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <svg className="size-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <h3 className="text-base font-bold text-white">Paramètres du compte & Sync</h3>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Statut d'authentification</div>
                <div className="flex items-center gap-2 text-slate-200">
                  <span className={`size-2.5 rounded-full ${user ? "bg-emerald-400" : "bg-amber-400"}`} />
                  <span>{user ? `Connecté en tant que ${user.email}` : "Mode Profil Local (JSON)"}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Connexion Supabase</div>
                <p className="text-xs text-slate-400">
                  Renseignez `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans vos variables Vercel ou `.env.local` pour synchroniser le profil et les preuves en temps réel.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Actions rapides</div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {!user ? (
                    <Link
                      href="/login"
                      onClick={() => setShowSettings(false)}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
                    >
                      Se connecter / S'inscrire
                    </Link>
                  ) : (
                    <button
                      onClick={() => {
                        setShowSettings(false);
                        handleSignOut();
                      }}
                      className="px-4 py-2 rounded-xl bg-rose-600/20 border border-rose-500/30 text-rose-300 hover:bg-rose-600/30 text-xs font-semibold transition-colors"
                    >
                      Se déconnecter
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 text-right border-t border-slate-800">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
