"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createNavigateurClient } from "@/lib/supabase/client";
import { Bouton } from "@/components/ui/primitives";
import { Champ } from "@/components/ui/champ";

type Mode = "connexion" | "inscription";

export function FormulaireConnexion({
  destination,
  erreurInitiale,
}: {
  destination: string;
  erreurInitiale: string | null;
}) {
  const [mode, setMode] = useState<Mode>("connexion");
  const [courriel, setCourriel] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(erreurInitiale);
  const [info, setInfo] = useState<string | null>(null);
  const router = useRouter();

  const supabase = createNavigateurClient();

  async function connexionGoogle() {
    if (!supabase) return;
    setEnCours(true);
    setErreur(null);
    // Le retour passe par `/auth/callback`, qui échange le code contre une
    // session côté serveur. Rediriger droit sur `/` laisserait le code
    // inutilisé et le visiteur anonyme.
    const retour = new URL("/auth/callback", window.location.origin);
    retour.searchParams.set("suite", destination);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: retour.toString() },
    });
    if (error) {
      setErreur(error.message);
      setEnCours(false);
    }
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setEnCours(true);
    setErreur(null);
    setInfo(null);

    if (mode === "inscription") {
      const retour = new URL("/auth/callback", window.location.origin);
      retour.searchParams.set("suite", destination);
      const { error } = await supabase.auth.signUp({
        email: courriel,
        password: motDePasse,
        options: { emailRedirectTo: retour.toString() },
      });
      if (error) setErreur(error.message);
      else setInfo("Compte créé. Ouvrez le lien de confirmation envoyé par e-mail.");
      setEnCours(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: courriel,
      password: motDePasse,
    });
    if (error) {
      setErreur(error.message);
      setEnCours(false);
      return;
    }
    // `refresh()` re-rend les Server Components avec la session fraîche.
    router.replace(destination);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {erreur && (
        <p
          role="alert"
          className="rounded-md border border-danger/30 bg-danger-faible px-3 py-2 text-xs leading-relaxed text-danger"
        >
          {erreur}
        </p>
      )}
      {info && (
        <p className="rounded-md border border-succes/30 bg-succes-faible px-3 py-2 text-xs leading-relaxed text-succes">
          {info}
        </p>
      )}

      <Bouton
        variante="secondaire"
        className="w-full"
        onClick={connexionGoogle}
        enChargement={enCours}
      >
        <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        Continuer avec Google
      </Bouton>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-bordure" />
        <span className="text-[0.625rem] uppercase tracking-wide text-texte-discret">ou</span>
        <span className="h-px flex-1 bg-bordure" />
      </div>

      <form onSubmit={soumettre} className="space-y-3">
        <Champ
          id="courriel"
          label="Adresse e-mail"
          type="email"
          requis
          autoComplete="email"
          value={courriel}
          onChange={(e) => setCourriel(e.target.value)}
          placeholder="vous@exemple.fr"
        />

        <Champ
          id="mot-de-passe"
          label="Mot de passe"
          type="password"
          requis
          minLength={8}
          autoComplete={mode === "inscription" ? "new-password" : "current-password"}
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          placeholder="8 caractères minimum"
        />

        <Bouton type="submit" variante="principal" className="w-full" enChargement={enCours}>
          {mode === "inscription" ? "Créer le compte" : "Se connecter"}
        </Bouton>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "connexion" ? "inscription" : "connexion");
          setErreur(null);
          setInfo(null);
        }}
        className="w-full text-center text-xs text-texte-attenue underline-offset-2 transition-colors hover:text-texte hover:underline"
      >
        {mode === "connexion"
          ? "Pas encore de compte ? En créer un"
          : "Déjà un compte ? Se connecter"}
      </button>
    </div>
  );
}
