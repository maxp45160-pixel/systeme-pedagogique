"use client";

/**
 * Une bulle du transcript du tuteur, et ses cartes de proposition.
 *
 * Mémoïsée : chaque bulle calcule ses propositions et son rendu Markdown
 * uniquement quand son `content` change. Pendant le streaming SSE, seul le
 * dernier message (contenu changeant) recalcule ; tous les messages précédents
 * restent en cache React.
 */

import { memo, useMemo } from "react";
import { Bouton, cx, Etiquette, PointActif } from "@/components/ui/primitives";
import { Markdown } from "@/components/ui/markdown";
import type { PropositionRecue } from "@/lib/tutor/outils";
import {
  extrairePropositionExerciceDuTexte,
  extrairePropositionsReferentiel,
  type PropositionReferentiel,
} from "@/lib/tutor/proposition";
import type { PropositionExercice } from "@/lib/tutor/proposition";

/** Un message du transcript — conservé tel quel dans `sessionStorage`. */
export interface Message {
  role: "user" | "assistant";
  content: string;
  /**
   * Propositions reçues en sortie structurée (lot 3.2).
   *
   * Présentes seulement quand le moteur sait appeler un outil. Absentes, les
   * parseurs de `proposition.ts` reprennent la main sur le texte — c'est le
   * filet, tant que la bascule n'est pas vérifiée sur les deux moteurs.
   *
   * Conservées avec le message dans `sessionStorage` : les recalculer depuis le
   * texte à la relecture est précisément ce qu'on cherche à ne plus faire.
   */
  propositions?: PropositionRecue[];
}

export const MessageBulle = memo(function MessageBulle({
  message,
  enFluxDirect,
  onOuvrirBranche,
  onOuvrirExercice,
  onDemarrerExerciceDirect,
}: {
  message: Message;
  /**
   * Ce message est-il celui que le tuteur est en train d'écrire ?
   *
   * Deux conséquences, et elles ont la même cause — un bloc de proposition
   * n'est pas encore un bloc tant que le flux n'est pas clos.
   *
   * 1. Correction. Les champs arrivent dans l'ordre du gabarit ; une
   *    proposition d'exercice satisfait « titre + énoncé » bien avant que
   *    Correction et Critères n'arrivent. La carte et son lien étaient rendus
   *    dès cet instant, et cliquer déposait un exercice tronqué.
   * 2. Coût. Les trois parseurs et le rendu Markdown tournaient à chaque flush
   *    sur un texte qui ne pouvait rien produire d'exploitable.
   */
  enFluxDirect: boolean;
  /** Ouvre la modale de compétences avec la branche pré-remplie. */
  onOuvrirBranche: (b: PropositionReferentiel) => void;
  /** Ouvre la modale d'exercice, pré-remplie avec la proposition (audit §2.3). */
  onOuvrirExercice: (e: PropositionExercice) => void;
  /** Lance immédiatement l'exercice proposé en 1 clic direct. */
  onDemarrerExerciceDirect?: (e: PropositionExercice) => void;
}) {
  /*
   * Deux sources possibles, jamais les deux à la fois.
   *
   * Le moteur sait appeler un outil : les propositions sont arrivées validées
   * contre un schéma, en fin de tour. Rien à relire dans le texte — et surtout,
   * rien à relire DEUX fois : un tuteur qui appelle l'outil ET recopie le bloc
   * en markdown afficherait la carte en double.
   *
   * Il ne le sait pas (repli de `compatible-openai.ts`, ou mode « copier le
   * contexte ») : les parseurs reprennent la main, avec leurs limites connues.
   */
  const recues = message.propositions;
  const analysable =
    recues === undefined && message.role === "assistant" && message.content !== "" && !enFluxDirect;

  // Branches proposées (ADR-026). Contrairement aux deux autres, ce bloc n'est
  // PAS filtré contre le référentiel : c'est précisément celui qui a le droit
  // d'introduire des compétences qui n'existent pas encore. Le garde-fou est
  // ailleurs — le tuteur n'y écrit aucun code, l'application les attribue.
  const branches = recues
    ? recues.flatMap((r) => (r.genre === "referentiel" ? [r.branche] : []))
    : analysable
      ? extrairePropositionsReferentiel(message.content)
      : [];

  /*
   * Exercices proposés (audit §2.3).
   * Deux sources :
   * 1. L'appel d'outil structuré `proposer_exercice` (voie nominale).
   * 2. Le filet de sécurité `extrairePropositionExerciceDuTexte` : si le modèle
   *    a rédigé l'exercice en texte libre, l'exercice est extrait pour afficher
   *    la carte d'action et les indices/corrections sont masqués du chat.
   */
  const extractionExercice = useMemo(() => {
    if (recues !== undefined || message.role !== "assistant" || message.content === "" || enFluxDirect) {
      return { exercice: null, texteNettoye: message.content };
    }
    return extrairePropositionExerciceDuTexte(message.content);
  }, [recues, message.role, message.content, enFluxDirect]);

  const exercices = recues
    ? recues.flatMap((r) => (r.genre === "exercice" ? [r.exercice] : []))
    : extractionExercice.exercice
      ? [extractionExercice.exercice]
      : [];

  const contenuAffiche = extractionExercice.exercice
    ? extractionExercice.texteNettoye
    : message.content;

  return (
    <div
      className={cx(
        "flex flex-col gap-1.5",
        message.role === "user" ? "items-end" : "items-start",
      )}
    >
      <div
        // `data-fond` porte la règle `::selection` inversée (`globals.css`) :
        // sur fond primaire, la sélection par défaut est de la même couleur que
        // la bulle, donc invisible.
        data-fond={message.role === "user" ? "primaire" : undefined}
        className={cx(
          "max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm",
          message.role === "user"
            ? "bg-primaire text-primaire-contraste"
            : "border border-bordure-controle bg-surface-2",
        )}
      >
        {message.role === "user" ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : message.content === "" ? (
          /* Un message vide *avec* propositions n'attend rien : le tuteur a
             appelé l'outil sans commenter. Afficher « réfléchit… » sous une
             carte déjà rendue annoncerait un travail en cours qui n'existe pas. */
          recues && recues.length > 0 ? (
            <span className="text-xs text-texte-attenue">Proposition ci-dessous.</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-texte-attenue">
              <PointActif />
              Le tuteur réfléchit…
            </span>
          )
        ) : (
          <Markdown contenu={contenuAffiche} />
        )}
      </div>

      {/*
        Branche proposée : le seul bloc qui peut introduire des compétences
        inconnues. Rien n'est écrit ici non plus — le bouton ouvre la modale,
        où les codes sont attribués par l'application et où chaque intitulé
        reste corrigeable.
      */}
      {branches.map((b, j) => (
        <div
          key={`ref-${j}`}
          className="max-w-[85%] rounded-md border border-primaire/30 bg-surface-2 px-3.5 py-2.5 text-xs"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <Etiquette ton="primaire">Branche proposée</Etiquette>
            <span className="font-medium">{b.domaine}</span>
            <span className="text-texte-attenue">
              {b.competences.length} compétence{b.competences.length > 1 ? "s" : ""}
            </span>
          </div>
          <ul className="mt-1.5 space-y-0.5 text-texte-attenue">
            {b.competences.slice(0, 4).map((c, k) => (
              <li key={k} className="truncate">
                · {c.intitule}
              </li>
            ))}
            {b.competences.length > 4 && (
              <li className="text-texte-discret">… et {b.competences.length - 4} autre(s)</li>
            )}
          </ul>
          <Bouton
            onClick={() => onOuvrirBranche(b)}
            variante="secondaire"
            taille="petite"
            className="mt-2"
          >
            Revoir et ajouter au référentiel
          </Bouton>
        </div>
      ))}

      {/*
        Exercice proposé : comme la branche, rien n'est écrit ici. Le bouton
        ouvre `ModaleExercice` sur cette proposition — le même écran de
        prévisualisation que la génération depuis le tableau de bord, donc les
        mêmes validations avant enregistrement.
      */}
      {exercices.map((e, j) => (
        <div
          key={`ex-${j}`}
          className="max-w-[85%] rounded-md border border-primaire/30 bg-surface-2 px-3.5 py-2.5 text-xs shadow-sm"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <Etiquette ton="primaire">Exercice proposé</Etiquette>
            {e.competences.map((c) => (
              <Etiquette key={c} mono>
                {c}
              </Etiquette>
            ))}
          </div>
          <p className="mt-1.5 font-medium">{e.titre}</p>
          <p className="chiffres mt-0.5 text-texte-attenue">
            Difficulté {e.difficulte}/5 · ≈ {e.dureeEstimeeMin} min · {e.criteres.length} critère(s)
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {onDemarrerExerciceDirect && (
              <Bouton
                onClick={() => onDemarrerExerciceDirect(e)}
                variante="principal"
                taille="petite"
              >
                Démarrer immédiatement →
              </Bouton>
            )}
            <Bouton
              onClick={() => onOuvrirExercice(e)}
              variante="secondaire"
              taille="petite"
            >
              Examiner & ajuster
            </Bouton>
          </div>
        </div>
      ))}
    </div>
  );
});
