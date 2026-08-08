"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { enregistrerReponse } from "@/lib/store/actions";
import { Bouton } from "@/components/ui/primitives";
import { useEstHydrate } from "@/lib/ui/hydratation";
import { cleParCompte, ecrireSession, effacerSession, lireSession } from "@/lib/ui/stockage-session";

/**
 * Zone de réponse — sauvegarde explicite en base, filet automatique en session.
 *
 * L'enregistrement en base reste un geste volontaire : c'est la trace du
 * raisonnement, et un bouton dit clairement quand elle est prise. Ce qui a
 * changé le 02/08/2026, c'est ce qui se passe entre deux clics.
 *
 * Le `<textarea>` était non contrôlé, sans auto-sauvegarde ni garde de sortie —
 * et le produit tendait lui-même le piège : « Afficher la correction » est un
 * `<Link href="?correction=1">`, donc une navigation, donc un remontage du
 * formulaire depuis la valeur en base. Cliquer dessus effaçait ce qu'on venait
 * d'écrire. Le cas était atteignable sans même quitter l'application.
 *
 * La saisie est désormais recopiée dans `sessionStorage` à chaque frappe
 * (cadencée), par compte et par tentative. Elle survit à toute navigation
 * interne et au retour arrière. Ce n'est pas une dorsale — la seule reste
 * Supabase (ADR-015) : rien de ce qui est ici n'entre dans le calcul d'une
 * preuve, et le bandeau dit explicitement que le texte n'est pas encore
 * enregistré.
 */

/** Assez court pour ne rien perdre, assez long pour ne pas sérialiser à chaque touche. */
const DELAI_SAUVEGARDE_MS = 400;

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
        className="h-[15.5rem] rounded-md border border-bordure bg-surface"
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
  /** Dernier brouillon enregistré en base. */
  valeur: string;
  compteId: string;
}) {
  const cle = cleParCompte(`brouillon-reponse:${attemptId}`, compteId);

  const [texte, setTexte] = useState<string>(() => lireSession<string>(cle) ?? valeur);
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Ce qui est à l'écran diffère-t-il de ce que la base détient ? */
  const nonEnregistre = texte !== valeur;

  useEffect(() => {
    if (minuterie.current !== null) clearTimeout(minuterie.current);
    minuterie.current = setTimeout(() => {
      // Aligné sur la base : le filet n'a plus d'objet, et le garder ferait
      // réapparaître un vieux texte si la tentative est reprise ailleurs.
      if (texte === valeur) effacerSession(cle);
      else ecrireSession(cle, texte);
    }, DELAI_SAUVEGARDE_MS);

    return () => {
      if (minuterie.current !== null) clearTimeout(minuterie.current);
    };
  }, [texte, valeur, cle]);

  function enregistrer() {
    setErreur(null);
    demarrer(async () => {
      try {
        await enregistrerReponse(attemptId, texte);
        effacerSession(cle);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
      }
    });
  }

  return (
    <div>
      <textarea
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        rows={10}
        placeholder="Hypothèses, méthode, calculs, résultat, interprétation, limites…"
        className="w-full resize-y rounded-md border border-bordure bg-surface px-3 py-2 font-mono text-xs leading-relaxed placeholder:text-texte-discret focus:border-primaire focus:outline-none"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Bouton onClick={enregistrer} disabled={enCours || !nonEnregistre} variante="secondaire" taille="petite">
          {enCours
            ? "Enregistrement…"
            : nonEnregistre
              ? "Enregistrer le brouillon"
              : "Brouillon enregistré"}
        </Bouton>
        <span className="text-[0.625rem] text-texte-discret">
          Le contenu n&apos;est pas corrigé automatiquement — il sert de trace de ton raisonnement.
        </span>
      </div>

      {/*
        Dire la vérité sur l'état de la donnée (P3) : le texte est conservé dans
        l'onglet, ce qui n'est pas la même chose qu'enregistré. Fermer l'onglet
        le perdrait.
      */}
      {nonEnregistre && (
        <p className="mt-1.5 text-[0.625rem] text-texte-attenue">
          Modifications non enregistrées. Elles survivent à la navigation dans
          l&apos;application — y compris à « Afficher la correction » — mais pas à la fermeture
          de l&apos;onglet.
        </p>
      )}

      {erreur && <p className="mt-1.5 text-[0.6875rem] text-alerte">{erreur}</p>}
    </div>
  );
}
