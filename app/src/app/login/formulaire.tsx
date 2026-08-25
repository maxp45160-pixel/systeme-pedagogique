"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createNavigateurClient } from "@/lib/supabase/client";
import { classerInscription } from "@/lib/auth/inscription";
import { BandeauInfo, Bouton } from "@/components/ui/primitives";
import { Champ } from "@/components/ui/champ";

type Mode = "connexion" | "inscription";

export function FormulaireConnexion({
  destination,
  erreurInitiale,
  modeInitial = "connexion",
}: {
  destination: string;
  erreurInitiale: string | null;
  /**
   * Mode d'ouverture, posé par `?mode=` côté serveur.
   *
   * Le titre de la carte vit ici et non dans la page : il dépend du mode,
   * et le mode est un état client. Rendu côté serveur, il annonçait « Se
   * connecter — Content de vous revoir » à quiconque arrivait par le
   * bouton « Créer mon compte gratuitement » de la vitrine.
   */
  modeInitial?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(modeInitial);
  const [courriel, setCourriel] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(erreurInitiale);
  const [info, setInfo] = useState<string | null>(null);
  /**
   * Résultat neutre d'une inscription possiblement masquée : Supabase refuse
   * de confirmer l'existence du compte (protection contre l'énumération), donc
   * l'écran ne la confirme pas non plus — il propose un geste vers la
   * connexion sans rien affirmer.
   */
  const [connexionProposee, setConnexionProposee] = useState(false);
  const router = useRouter();

  const supabase = createNavigateurClient();

  /** Bascule vers la connexion en conservant l'e-mail saisi. */
  function passerEnConnexion() {
    setMode("connexion");
    setErreur(null);
    setInfo(null);
    setConnexionProposee(false);
    setMotDePasse("");
  }

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
      const { data, error } = await supabase.auth.signUp({
        email: courriel,
        password: motDePasse,
        options: { emailRedirectTo: retour.toString() },
      });

      /*
       * La classification vit dans `lib/auth/inscription.ts` (testée) : elle
       * distingue le doublon explicite, le doublon masqué par Supabase, le
       * nouveau compte et la connexion immédiate. L'e-mail saisi est conservé
       * dans tous les cas — retaper son adresse après une erreur de plus est
       * exactement la friction qu'on retire.
       */
      const classification = classerInscription({
        error,
        session: data?.session,
        user: data?.user,
      });
      switch (classification.cas) {
        case "compte-existant":
          passerEnConnexion();
          setInfo(
            "Un compte existe déjà avec cette adresse. Connectez-vous — ou passez par « Mot de passe oublié » si besoin.",
          );
          break;
        case "existe-peut-etre":
          setErreur(null);
          setInfo(
            "Si un compte existe déjà pour cette adresse, aucun nouveau compte n'a été créé : un e-mail de confirmation vous attend peut-être. Sinon, il vient d'être créé.",
          );
          setConnexionProposee(true);
          break;
        case "confirmation-envoyee":
          setErreur(null);
          setInfo("Compte créé. Ouvrez le lien de confirmation envoyé par e-mail.");
          break;
        case "connecte":
          // `refresh()` re-rend les Server Components avec la session fraîche.
          router.replace(destination);
          router.refresh();
          return;
        case "erreur":
          setInfo(null);
          setErreur(classification.message);
          break;
      }
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
      <div className="mb-1">
        <h2 className="text-base font-medium text-texte">
          {mode === "inscription" ? "Créer votre compte" : "Se connecter"}
        </h2>
        <p className="mt-0.5 text-xs text-texte-discret">
          {mode === "inscription"
            ? "Gratuit. Vos exercices commencent dès la première minute."
            : "Content de vous revoir."}
        </p>
      </div>
      {erreur && (
        <BandeauInfo ton="danger" taille="compacte">
          <p className="leading-relaxed text-danger">{erreur}</p>
        </BandeauInfo>
      )}
      {info && (
        <BandeauInfo ton="succes" taille="compacte">
          <p className="leading-relaxed text-succes">{info}</p>
        </BandeauInfo>
      )}

      {/*
        Résultat neutre d'une inscription possiblement masquée (25/08/2026).
        Supabase ne dit pas si le compte existe ; l'écran non plus. Le CTA
        reste un geste explicite vers la connexion — pas une redirection
        automatique, qui confirmerait l'existence du compte que Supabase
        s'applique justement à ne pas révéler.
      */}
      {connexionProposee && (
        <Bouton variante="secondaire" className="w-full" onClick={passerEnConnexion}>
          J&apos;ai déjà un compte — me connecter
        </Bouton>
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
          setConnexionProposee(false);
        }}
        className="w-full text-center text-xs text-texte-attenue underline-offset-2 transition-colors hover:text-texte hover:underline"
      >
        {mode === "connexion"
          ? "Pas encore de compte ? En créer un"
          : "Déjà un compte ? Se connecter"}
      </button>

      {mode === "connexion" && (
        <p className="text-center">
          <Link
            href="/auth/mot-de-passe-oublie"
            className="text-xs text-texte-attenue underline-offset-2 transition-colors hover:text-texte hover:underline"
          >
            Mot de passe oublié ?
          </Link>
        </p>
      )}
    </div>
  );
}
