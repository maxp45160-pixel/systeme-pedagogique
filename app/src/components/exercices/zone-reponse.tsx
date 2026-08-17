"use client";

import { useEffect, useRef, useState } from "react";
import { enregistrerReponse } from "@/lib/store/actions";
import { useEstHydrate } from "@/lib/ui/hydratation";
import { cleParCompte, ecrireSession, effacerSession, lireSession } from "@/lib/ui/stockage-session";

/**
 * Zone de réponse — enregistrement automatique en base, filet en session.
 *
 * Ce qui était un geste volontaire (le bouton Enregistrer le brouillon) est
 * devenu automatique : la réponse est écrite en base dès que la frappe marque
 * une pause, sans bouton. C'est la valeur en base qui déverrouille le bilan
 * (`reponseSuffisante`) et que le tuteur relit, sans changer la règle : seule
 * l'action manuelle qui la servait disparaît.
 *
 * Le `<textarea>` reste contrôlé. À chaque frappe :
 *
 * - un filet local (`sessionStorage`, par compte et par tentative) est tenu à
 *   jour pour survivre à toute navigation interne et au retour arrière, même
 *   si l'écriture en base n'a pas encore eu lieu ;
 * - après une pause, la réponse est écrite en base (`enregistrerReponse`) :
 *   une rafale de frappes ne produit qu'une requête.
 *
 * Ce n'est pas une dorsale de plus : la seule source reste Supabase (ADR-015),
 * et le filet en `sessionStorage` n'entre jamais dans le calcul d'une preuve.
 */

/** Assez court pour ne rien perdre d'une navigation, assez long pour ne pas sérialiser à chaque touche. */
const DELAI_FILET_SESSION_MS = 400;
/** Pause avant l'écriture en base : regroupe une rafale de frappes en une seule requête. */
const DELAI_AUTO_SAUVEGARDE_MS = 800;

export function ZoneReponse(proprietes: {
  attemptId: string;
  valeur: string;
  compteId: string;
}) {
  // `sessionStorage` n'existe pas côté serveur : on attend l'hydratation pour
  // partir du bon texte dès le premier rendu réel, plutôt que d'afficher la
  // valeur en base puis d'y réinjecter le brouillon dans un effet.
  const hydrate = useEstHydrate();
  if (!hydrate) {
    // `aria-hidden`, pas `aria-busy` : rendait cette attente invisible aux
    // lecteurs d'écran plutôt que de l'annoncer. Un texte alternatif hors
    // écran porte l'information même si la fenêtre est trop brève pour être
    // vue.
    return (
      <div
        className="h-[15.5rem] rounded-md border border-bordure-controle bg-surface lg:h-[min(32rem,calc(100dvh-16rem))]"
        aria-busy="true"
      >
        <span className="sr-only">Chargement de la zone de réponse…</span>
      </div>
    );
  }
  return <ZoneHydrate {...proprietes} />;
}

function ZoneHydrate({
  attemptId,
  valeur,
  compteId,
}: {
  attemptId: string;
  /** Dernière réponse enregistrée en base (valeur figée au rendu serveur). */
  valeur: string;
  compteId: string;
}) {
  const cle = cleParCompte(`brouillon-reponse:${attemptId}`, compteId);

  const [texte, setTexte] = useState<string>(() => lireSession<string>(cle) ?? valeur);
  const [dernierEnregistre, setDernierEnregistre] = useState<string>(valeur);
  const [enSauvegarde, setEnSauvegarde] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const minuterieSession = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minuterieBase = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Ce qui est à l'écran diffère-t-il de ce que la base détient ? */
  const nonEnregistre = texte !== dernierEnregistre;

  // Filet local : survit à la navigation tant que l'écriture en base n'a pas
  // eu lieu. Aligné sur la base une fois écrite, il est nettoyé pour ne pas
  // réapparaître un vieux texte si la tentative est reprise ailleurs.
  useEffect(() => {
    if (minuterieSession.current !== null) clearTimeout(minuterieSession.current);
    minuterieSession.current = setTimeout(() => {
      if (texte === dernierEnregistre) effacerSession(cle);
      else ecrireSession(cle, texte);
    }, DELAI_FILET_SESSION_MS);

    return () => {
      if (minuterieSession.current !== null) clearTimeout(minuterieSession.current);
    };
  }, [texte, dernierEnregistre, cle]);

  // Auto-sauvegarde en base : après une pause de frappe, une seule écriture.
  async function enregistrer(corps: string) {
    setErreur(null);
    setEnSauvegarde(true);
    try {
      await enregistrerReponse(attemptId, corps);
      setDernierEnregistre(corps);
      setEnSauvegarde(false);
      effacerSession(cle);
    } catch (e) {
      setEnSauvegarde(false);
      setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
    }
  }

  useEffect(() => {
    if (texte === dernierEnregistre) return;
    if (minuterieBase.current !== null) clearTimeout(minuterieBase.current);
    minuterieBase.current = setTimeout(() => {
      minuterieBase.current = null;
      void enregistrer(texte);
    }, DELAI_AUTO_SAUVEGARDE_MS);

    return () => {
      if (minuterieBase.current !== null) clearTimeout(minuterieBase.current);
    };
    // `enregistrer` reste hors dépendances : la fonction est recréée à chaque
    // rendu, l'inclure relancerait l'effet en continu. L'effet n'est relancé
    // que par la frappe (`texte`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texte, dernierEnregistre, cle]);

  // Vider le décompte au départ du champ : un clic vers le bilan ne doit pas
  // laisser la réponse à l'écran sans écriture en base. Un envoi déjà parti
  // (décompte annulé, `enSauvegarde` vrai) n'est pas relancé.
  function viderFilet() {
    if (minuterieBase.current !== null) {
      clearTimeout(minuterieBase.current);
      minuterieBase.current = null;
      void enregistrer(texte);
      return;
    }
    if (texte !== dernierEnregistre && !enSauvegarde) {
      void enregistrer(texte);
    }
  }

  return (
    <div>
      <textarea
        value={texte}
        onChange={(e) => {
          const suivant = e.target.value;
          setTexte(suivant);
          if (suivant !== dernierEnregistre) setEnSauvegarde(true);
        }}
        onBlur={viderFilet}
        rows={10}
        placeholder="Hypothèses, méthode, calculs, résultat, interprétation, limites…"
        className="h-[15.5rem] w-full resize-y rounded-md border border-bordure-controle bg-surface px-3 py-2 font-mono text-xs leading-relaxed placeholder:text-texte-discret lg:h-[min(32rem,calc(100dvh-16rem))]"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span aria-live="polite" className="text-[0.625rem] text-texte-discret">
          {enSauvegarde
            ? "Enregistrement…"
            : nonEnregistre
              ? "En attente d'enregistrement…"
              : "Enregistré automatiquement"}
        </span>
        <span className="text-[0.625rem] text-texte-discret">
          Le contenu n&apos;est pas corrigé automatiquement — il sert de trace de ton raisonnement.
        </span>
      </div>

      {erreur && <p className="mt-1.5 text-[0.6875rem] text-alerte">{erreur}</p>}
    </div>
  );
}

