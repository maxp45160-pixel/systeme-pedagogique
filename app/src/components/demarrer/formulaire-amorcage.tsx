"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { modifierProfil } from "@/lib/store/referentiel-actions";
import { classesBouton } from "@/components/ui/primitives";

/**
 * Les trois questions de l'amorçage.
 *
 * Le sujet n'est pas enregistré comme tel : il n'existe pas de colonne « thème »
 * et il ne doit pas en exister une. Le thème d'un compte, c'est son référentiel
 * — le stocker à côté créerait deux vérités qui divergeraient au premier ajout
 * de branche. Il part donc directement dans le premier message au tuteur, qui
 * en fera une proposition que l'utilisateur validera.
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
  const [contexte, setContexte] = useState(formation);

  const pret = sujet.trim().length > 2 && objectif.trim().length > 2;

  function soumettre() {
    setErreur(null);
    demarrer(async () => {
      try {
        await modifierProfil({
          formation: contexte,
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
          contexte.trim() ? `Mon point de départ : ${contexte.trim()}.` : "",
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

      <label className="block">
        <span className="text-xs font-medium">
          Ton point de départ <span className="text-texte-discret">(facultatif)</span>
        </span>
        <input
          value={contexte}
          onChange={(e) => setContexte(e.target.value)}
          placeholder="formation, expérience, ce que tu as déjà pratiqué…"
          className={champ}
        />
        <span className="mt-1 block text-[0.6875rem] text-texte-discret">
          Aucun niveau n&apos;en sera déduit : seules des preuves peuvent en produire un.
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
