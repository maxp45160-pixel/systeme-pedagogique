"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { modifierProfil } from "@/lib/store/referentiel-actions";
import { valeurDeclaree } from "@/lib/domain/profil";
import { BandeauInfo, Bouton } from "@/components/ui/primitives";
import { Champ } from "@/components/ui/champ";
import { ModaleCompetence } from "@/components/referentiel/modale-competence";

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
export function FormulaireAmorcage({
  formation,
  objectifMoyenTerme,
  objectifLongTerme,
  compteId,
}: {
  formation: string;
  objectifMoyenTerme: string;
  objectifLongTerme: string;
  compteId: string;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [validationOuverte, setValidationOuverte] = useState(false);

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

        // Le sujet n'est pas stocké séparément : la branche relue et validée
        // devient l'unique vérité. La route de suggestion relira le profil qui
        // vient d'être enregistré pour tenir compte de l'objectif déclaré.
        setValidationOuverte(true);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <Champ
        label="Le sujet"
        value={sujet}
        onChange={(e) => setSujet(e.target.value)}
        placeholder="philosophie morale, droit fiscal, lutherie, développement web…"
        aide="Écris-le comme tu le dirais. Le tuteur le découpera en compétences mesurables, et tu valideras."
      />

      <Champ
        label="Pour quoi faire"
        value={objectif}
        onChange={(e) => setObjectif(e.target.value)}
        placeholder="préparer un concours, tenir une discussion argumentée, changer de métier…"
        aide="Sert à pondérer l'importance de chaque compétence. Sans objectif, elles se vaudraient toutes."
      />

      {erreur && (
        <BandeauInfo ton="alerte" taille="compacte">
          <p className="text-alerte">{erreur}</p>
        </BandeauInfo>
      )}

      <div className="flex items-center gap-3 pt-1">
        <Bouton onClick={soumettre} disabled={!pret || enCours} variante="principal">
          {enCours ? "Enregistrement…" : "Proposer une première branche"}
        </Bouton>
        {!pret && (
          <span className="text-xs text-texte-discret">Le sujet et l&apos;objectif suffisent.</span>
        )}
      </div>

      {validationOuverte && (
        <ModaleCompetence
          onFermer={() => setValidationOuverte(false)}
          domainesExistants={[]}
          compteId={compteId}
          sujetInitial={sujet.trim()}
          descriptionInitiale={depart ? `Point de départ déclaré : ${depart}` : ""}
          suggestionAutomatique
          surEnregistre={() => router.replace("/atelier")}
        />
      )}
    </div>
  );
}
