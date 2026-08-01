"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { modifierProfil } from "@/lib/store/referentiel-actions";
import { valeurDeclaree } from "@/lib/domain/profil";
import { classesBouton } from "@/components/ui/primitives";

/**
 * Les deux questions de l'amorçage.
 *
 * Le sujet n'est pas enregistré comme tel : il n'existe pas de colonne « thème »
 * et il ne doit pas en exister une. Le thème d'un compte, c'est son référentiel
 * — le stocker à côté créerait deux vérités qui divergeraient au premier ajout
 * de branche. Il part donc directement dans le premier message au tuteur, qui
 * en fera une proposition que l'utilisateur validera.
 *
 * Il y en avait trois : « ton point de départ » écrivait `profiles.formation`,
 * exactement le champ que `/profil` édite ensuite, via la même action. Deux
 * écrans pour une colonne, dont l'un facultatif et jamais revisité — la
 * personne qui remplissait `/demarrer` retrouvait la question inchangée sur
 * `/profil` sans savoir si elle devait la ressaisir. `/demarrer` garde le
 * strict nécessaire à l'amorçage ; `/profil` reste l'écran d'édition.
 */
const champ =
  "mt-1 w-full rounded-md border border-bordure bg-surface px-2.5 py-2 text-sm placeholder:text-texte-discret focus:border-primaire focus:outline-none";

export function FormulaireAmorcage({
  formation,
  objectifMoyenTerme,
  objectifLongTerme,
}: {
  formation: string;
  objectifMoyenTerme: string;
  objectifLongTerme: string;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const [sujet, setSujet] = useState("");
  const [objectif, setObjectif] = useState(objectifMoyenTerme);

  /* `null` tant que la personne n'a rien écrit sur `/profil`. */
  const depart = valeurDeclaree(formation);

  const pret = sujet.trim().length > 2 && objectif.trim().length > 2;

  function soumettre() {
    setErreur(null);
    demarrer(async () => {
      try {
        await modifierProfil({
          // `formation` n'est plus écrite ici : c'est `/profil` qui l'édite.
          // Elle est relayée telle quelle à l'amorce si elle existe déjà.
          objectifMoyenTerme: objectif,
          // Non demandé ici : un horizon long ne se déclare pas au premier
          // écran. La colonne reste à son libellé par défaut, et l'écran de
          // profil permettra de la renseigner plus tard.
          objectifLongTerme: objectifLongTerme || undefined,
        });

        // Le sujet passe au tuteur, pas en base. Le référentiel qui en sortira
        // sera la seule trace — validée, donc vraie.
        const amorce = [
          `Je veux progresser en : ${sujet.trim()}.`,
          `Mon objectif : ${objectif.trim()}.`,
          /* Reprise du profil s'il est RÉELLEMENT renseigné, jamais redemandée
           * ici. `valeurDeclaree` et pas un simple test de chaîne vide : la
           * colonne porte par défaut « Formation à renseigner », qui est un
           * libellé d'invite et non une réponse. Le relayer tel quel ferait
           * dire au tuteur que le point de départ de la personne est
           * « Formation à renseigner » — l'invention qu'ADR-029 a corrigée. */
          depart ? `Mon point de départ : ${depart}.` : "",
          "",
          "Construis avec moi une première branche de référentiel. Interroge-moi d'abord si tu as besoin de précisions.",
        ]
          .filter(Boolean)
          .join("\n");

        router.push(`/tuteur?amorce=${encodeURIComponent(amorce)}`);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <label className="block">
        <span className="text-xs font-medium">Le sujet</span>
        <input
          value={sujet}
          onChange={(e) => setSujet(e.target.value)}
          placeholder="philosophie morale, droit fiscal, lutherie, développement web…"
          className={champ}
        />
        <span className="mt-1 block text-[0.6875rem] text-texte-discret">
          Écris-le comme tu le dirais. Le tuteur le découpera en compétences mesurables, et tu
          valideras.
        </span>
      </label>

      <label className="block">
        <span className="text-xs font-medium">Pour quoi faire</span>
        <input
          value={objectif}
          onChange={(e) => setObjectif(e.target.value)}
          placeholder="préparer un concours, tenir une discussion argumentée, changer de métier…"
          className={champ}
        />
        <span className="mt-1 block text-[0.6875rem] text-texte-discret">
          Sert à pondérer l&apos;importance de chaque compétence. Sans objectif, elles se
          vaudraient toutes.
        </span>
      </label>

      {erreur && (
        <p className="rounded-md border border-alerte/30 bg-alerte-faible px-3 py-2 text-xs text-alerte">
          {erreur}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={soumettre}
          disabled={!pret || enCours}
          className={classesBouton("principal")}
        >
          {enCours ? "Enregistrement…" : "Continuer avec le tuteur"}
        </button>
        {!pret && (
          <span className="text-xs text-texte-discret">Le sujet et l&apos;objectif suffisent.</span>
        )}
      </div>
    </div>
  );
}
