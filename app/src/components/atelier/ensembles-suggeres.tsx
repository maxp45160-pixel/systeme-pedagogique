"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EnsemblePropose } from "@/lib/engine/ensembles";
import { creerTheme } from "@/lib/store/theme-actions";
import { Bouton, CodeCompetence, cx } from "@/components/ui/primitives";

/**
 * Les ensembles que le travail dessine, proposés à la confirmation.
 *
 * ## Ce que la personne n'a pas à faire
 *
 * Elle n'a pas à repérer que trois compétences reviennent ensemble, ni à
 * ouvrir un formulaire pour les regrouper. Le système l'observe et le propose.
 *
 * ## Ce qu'elle seule peut faire : nommer
 *
 * Le nom n'est pas pré-rempli, et ce n'est pas un oubli. Un ensemble tire sa
 * valeur de ce qu'il **signifie** — « Raisonnement analytique », « Préparer le
 * Master » — et le système n'observe que des co-occurrences. Fabriquer
 * « Ensemble LOG-02, LOG-07 » donnerait un nom qui n'apprend rien, et
 * transformerait une observation en fausse compréhension.
 *
 * Le geste tient donc en deux temps : le système apporte le groupe et sa
 * justification, la personne lui donne son sens.
 */
export function EnsemblesSuggeres({
  propositions,
  intitules,
}: {
  propositions: EnsemblePropose[];
  /** Intitulés par code, pour que la proposition se lise sans décoder. */
  intitules: Record<string, string>;
}) {
  const [ouvert, setOuvert] = useState<number | null>(null);

  if (propositions.length === 0) return null;

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
          Ensembles qui se dessinent
        </p>
        <span className="text-[0.625rem] text-texte-discret">observé dans ton travail</span>
      </div>

      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {propositions.map((proposition, index) => (
          <Proposition
            key={proposition.codes.join("|")}
            proposition={proposition}
            intitules={intitules}
            ouvert={ouvert === index}
            onOuvrir={() => setOuvert(ouvert === index ? null : index)}
            onFerme={() => setOuvert(null)}
          />
        ))}
      </div>
    </section>
  );
}

function Proposition({
  proposition,
  intitules,
  ouvert,
  onOuvrir,
  onFerme,
}: {
  proposition: EnsemblePropose;
  intitules: Record<string, string>;
  ouvert: boolean;
  onOuvrir: () => void;
  onFerme: () => void;
}) {
  const router = useRouter();
  const [libelle, setLibelle] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function confirmer() {
    const nom = libelle.trim();
    if (nom.length < 3) {
      setErreur("Donne-lui un nom d'au moins 3 caractères.");
      return;
    }
    setErreur(null);
    demarrer(async () => {
      try {
        await creerTheme({ libelle: nom, codes: proposition.codes, origine: "utilisateur" });
        onFerme();
        router.refresh();
      } catch (cause) {
        setErreur(cause instanceof Error ? cause.message : "Création impossible.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-dashed border-accent/40 bg-surface p-4">
      <div className="flex flex-wrap gap-1.5">
        {proposition.codes.map((code) => (
          <CodeCompetence key={code} code={code} />
        ))}
      </div>

      <ul className="mt-2 space-y-0.5">
        {proposition.codes.map((code) => (
          <li key={code} className="truncate text-[0.6875rem] text-texte-attenue">
            {intitules[code] ?? code}
          </li>
        ))}
      </ul>

      {/* Le motif, pas un score : la proposition porte ce qui la fonde (P3). */}
      <p className="mt-2 text-[0.625rem] leading-relaxed text-texte-discret">{proposition.motif}</p>

      {ouvert ? (
        <div className="mt-3 space-y-2 border-t border-bordure pt-3">
          <label className="block text-[0.6875rem] font-medium text-texte-attenue">
            Comment appelles-tu cet ensemble ?
            <input
              value={libelle}
              onChange={(event) => setLibelle(event.target.value)}
              placeholder="Ex. Raisonnement analytique"
              maxLength={100}
              autoFocus
              className="mt-1 w-full rounded-lg border border-bordure-controle bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-primaire"
            />
          </label>
          <p className="text-[0.625rem] leading-relaxed text-texte-discret">
            Le système a trouvé le groupe ; il ne peut pas trouver ce qu&apos;il signifie pour toi.
          </p>
          <div className="flex flex-wrap gap-2">
            <Bouton
              onClick={confirmer}
              disabled={enCours}
              variante="principal"
              taille="petite"
              className={cx(enCours && "pointer-events-none")}
            >
              {enCours ? "Création…" : "Créer l'ensemble"}
            </Bouton>
            <Bouton onClick={onFerme} variante="secondaire" taille="petite">
              Annuler
            </Bouton>
          </div>
          {erreur && <p className="text-[0.6875rem] text-danger">{erreur}</p>}
        </div>
      ) : (
        <button
          type="button"
          onClick={onOuvrir}
          className="mt-3 text-[0.6875rem] font-medium text-primaire underline-offset-2 hover:underline cursor-pointer"
        >
          En faire un ensemble →
        </button>
      )}
    </div>
  );
}
