"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CodeCompetence, cx } from "@/components/ui/primitives";
import type { VueCompetenceAtelier } from "@/lib/documents/vue-atelier";
import type { PropositionRelations, RelationProposee } from "@/lib/tutor/outils";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";
import {
  appliquerRelationProposee,
  delierCompetences,
  type RelationAAppliquer,
} from "@/lib/store/referentiel-actions";
import type { ElementAtelier } from "./types-atelier";

const LIBELLES_PALIERS: Record<string, string> = {
  fondamentaux: "Fondamentaux",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

/**
 * Le sens d'une arête, dans les termes de l'écran.
 *
 * Le référentiel ne connaît que `prerequis` : « suivante » est la même arête lue
 * à l'envers. Les actions serveur reçoivent donc `amont`/`aval` dans l'ordre que
 * le bloc appelant impose, et il n'y a qu'une implémentation d'écriture.
 */
type SensRelation = "prerequis" | "suivante";

function intituleConnu(code: string, elements?: ElementAtelier[]): string | null {
  const element = elements?.find((item) => item.id === code || item.id === `competence:${code}`);
  return element?.titre && element.titre !== code ? element.titre : null;
}

function LigneDeclaree({
  code,
  intitule,
  ouvrirElement,
  onRetirer,
  enCours,
}: {
  code: string;
  intitule: string | null;
  ouvrirElement: (id: string) => void;
  onRetirer: () => void;
  enCours: boolean;
}) {
  return (
    <li className="flex items-center gap-2 rounded-lg border border-bordure bg-surface px-2.5 py-2">
      <button
        type="button"
        onClick={() => ouvrirElement(code)}
        className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
      >
        <CodeCompetence code={code} />
        <span className="min-w-0 flex-1 truncate text-xs text-texte-attenue">{intitule ?? "—"}</span>
      </button>
      <button
        type="button"
        onClick={onRetirer}
        disabled={enCours}
        title={`Retirer ${code}`}
        aria-label={`Retirer ${code}`}
        className="grid size-6 shrink-0 place-items-center rounded-md text-texte-discret transition-colors hover:bg-surface-3 hover:text-danger cursor-pointer disabled:opacity-40"
      >
        ×
      </button>
    </li>
  );
}

/**
 * Une proposition du tuteur, à valider ou à écarter.
 *
 * Rien à saisir : la ligne porte l'intitulé, le palier, le domaine visé et la
 * justification. Trois états possibles, et le troisième est le garde-fou contre
 * l'inflation du référentiel :
 *
 * - la proposition désigne une compétence existante ⇒ « rattacher » ;
 * - elle en décrit une nouvelle, placée dans un domaine existant ⇒ « créer
 *   dans <domaine> » ;
 * - le tuteur n'a su nommer aucun domaine ⇒ **non applicable**, affiché comme
 *   demandant un domaine neuf. Rien ne tombe dans le domaine courant par
 *   défaut.
 */
function LigneProposee({
  relation,
  nomsParDomaine,
  onValider,
  onEcarter,
  enCours,
}: {
  relation: RelationProposee;
  nomsParDomaine: Map<string, string>;
  onValider: () => void;
  onEcarter: () => void;
  enCours: boolean;
}) {
  const domaineNom = relation.domaineId ? nomsParDomaine.get(relation.domaineId) : null;
  const applicable = Boolean(relation.codeExistant) || Boolean(domaineNom);
  const effet = relation.codeExistant
    ? "Rattacher"
    : domaineNom
      ? `Créer dans ${domaineNom}`
      : "Demanderait un nouveau domaine";

  return (
    <li className="rounded-lg border border-bordure bg-surface p-3">
      <div className="flex items-start gap-2">
        {relation.codeExistant && <CodeCompetence code={relation.codeExistant} />}
        <p className="min-w-0 flex-1 text-xs font-medium leading-snug text-texte">{relation.intitule}</p>
      </div>
      <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-texte-attenue">
        {relation.justification}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[0.625rem] text-texte-discret">
          {LIBELLES_PALIERS[relation.palier] ?? relation.palier}
        </span>
        <span
          className={cx(
            "rounded px-1.5 py-0.5 text-[0.625rem]",
            applicable ? "bg-surface-2 text-texte-discret" : "bg-alerte-faible text-alerte",
          )}
        >
          {effet}
        </span>
      </div>
      <div className="mt-2.5 flex items-center gap-3">
        <button
          type="button"
          onClick={onValider}
          disabled={enCours || !applicable}
          title={
            applicable
              ? undefined
              : "Le tuteur n'a nommé aucun domaine existant pour cette compétence. Crée le domaine, puis relance la proposition."
          }
          className={cx(
            "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
            applicable
              ? "bg-primaire text-texte-inverse hover:bg-primaire-survol cursor-pointer disabled:opacity-50"
              : "cursor-not-allowed bg-surface-2 text-texte-discret",
          )}
        >
          Valider
        </button>
        <button
          type="button"
          onClick={onEcarter}
          disabled={enCours}
          className="text-xs font-medium text-texte-discret hover:text-texte cursor-pointer disabled:opacity-50"
        >
          Écarter
        </button>
      </div>
    </li>
  );
}

function BlocRelation({
  titre,
  aide,
  sens,
  codesDeclares,
  propositions,
  nomsParDomaine,
  elements,
  ouvrirElement,
  onValider,
  onEcarter,
  onRetirer,
  enCours,
}: {
  titre: string;
  aide: string;
  sens: SensRelation;
  codesDeclares: string[];
  propositions: RelationProposee[] | null;
  nomsParDomaine: Map<string, string>;
  elements?: ElementAtelier[];
  ouvrirElement: (id: string) => void;
  onValider: (relation: RelationProposee, sens: SensRelation) => void;
  onEcarter: (relation: RelationProposee, sens: SensRelation) => void;
  onRetirer: (autre: string, sens: SensRelation) => void;
  enCours: boolean;
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-texte-discret">{titre}</h4>
        <span className="chiffres rounded-full bg-surface-2 px-2 py-0.5 text-[0.6875rem] text-texte-discret">
          {codesDeclares.length}
        </span>
      </div>
      <p className="mt-1 text-[0.6875rem] leading-relaxed text-texte-discret">{aide}</p>

      {codesDeclares.length > 0 ? (
        <ul className="mt-2.5 space-y-1">
          {codesDeclares.map((autre) => (
            <LigneDeclaree
              key={autre}
              code={autre}
              intitule={intituleConnu(autre, elements)}
              ouvrirElement={ouvrirElement}
              enCours={enCours}
              onRetirer={() => onRetirer(autre, sens)}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-2.5 text-xs text-texte-discret italic">Rien de déclaré.</p>
      )}

      {propositions && propositions.length > 0 && (
        <div className="mt-3">
          <p className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-primaire">
            Proposé par le tuteur
          </p>
          <ul className="mt-2 space-y-2">
            {propositions.map((relation, index) => (
              <LigneProposee
                key={`${relation.codeExistant ?? relation.intitule}-${index}`}
                relation={relation}
                nomsParDomaine={nomsParDomaine}
                enCours={enCours}
                onValider={() => onValider(relation, sens)}
                onEcarter={() => onEcarter(relation, sens)}
              />
            ))}
          </ul>
        </div>
      )}
      {propositions && propositions.length === 0 && (
        <p className="mt-3 text-[0.6875rem] text-texte-discret">
          Le tuteur n’a proposé aucune relation de ce côté.
        </p>
      )}
    </section>
  );
}

/**
 * Les relations d'une compétence : lues, proposées par le tuteur, validées à la main.
 *
 * Les deux cadres étaient vides et rien dans l'interface ne pouvait les
 * remplir — `prerequis` ne s'écrivait qu'à l'import d'un référentiel. Plutôt
 * qu'un champ de saisie, le tuteur propose ; la personne valide ligne à ligne.
 * Aucune écriture sans un clic, et aucun code frappé par le modèle : il désigne
 * ou il décrit, l'application attribue.
 */
export function RelationsCompetence({
  vue,
  elements,
  compteId,
  domaines,
  ouvrirElement,
}: {
  vue: VueCompetenceAtelier;
  elements?: ElementAtelier[];
  compteId: string;
  /** Les domaines vivants du compte, pour nommer la destination d'une création. */
  domaines: Array<{ id: string; nom: string }>;
  ouvrirElement: (id: string) => void;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [proposition, setProposition] = useState<PropositionRelations | null>(null);
  const [ecartees, setEcartees] = useState<Set<string>>(new Set());
  const [chargement, setChargement] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const nomsParDomaine = new Map(domaines.map((domaine) => [domaine.id, domaine.nom]));
  const cle = (relation: RelationProposee, sens: SensRelation) =>
    `${sens}:${relation.codeExistant ?? relation.intitule.toLowerCase()}`;

  const restantes = (relations: RelationProposee[], sens: SensRelation) =>
    relations.filter((relation) => !ecartees.has(cle(relation, sens)));

  async function demanderProposition() {
    setChargement(true);
    setMessage(null);
    try {
      const reponse = await fetch("/api/referentiel/relations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: vue.code,
          config: lireConfigTuteur(compteId) ?? undefined,
        }),
      });
      const donnees = (await reponse.json().catch(() => null)) as {
        relations?: PropositionRelations;
        message?: string;
      } | null;
      if (!reponse.ok || !donnees?.relations) {
        setMessage(donnees?.message ?? "Le tuteur n’a pas pu proposer de relations.");
        return;
      }
      setEcartees(new Set());
      setProposition(donnees.relations);
    } catch {
      setMessage("La proposition n’a pas pu être demandée.");
    } finally {
      setChargement(false);
    }
  }

  function ecrire(action: () => Promise<void>) {
    setMessage(null);
    demarrer(async () => {
      try {
        await action();
        router.refresh();
      } catch (erreur) {
        /*
         * Le refus du serveur porte déjà sa raison — cycle, domaine absent,
         * code inconnu. La réécrire ici serait la réécrire faux.
         */
        setMessage(erreur instanceof Error ? erreur.message : "Modification impossible.");
      }
    });
  }

  function valider(relation: RelationProposee, sens: SensRelation) {
    const aAppliquer: RelationAAppliquer = {
      code: vue.code,
      sens,
      codeExistant: relation.codeExistant,
      intitule: relation.intitule,
      palier: relation.palier,
      domaineId: relation.domaineId,
    };
    ecrire(async () => {
      await appliquerRelationProposee(aAppliquer);
      /* Validée, elle n'a plus à figurer dans les propositions : elle est déclarée. */
      setEcartees((precedentes) => new Set(precedentes).add(cle(relation, sens)));
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.6875rem] leading-relaxed text-texte-discret">
          Le tuteur propose, vous validez. Rien n’est écrit sans votre clic.
        </p>
        <button
          type="button"
          onClick={demanderProposition}
          disabled={chargement || enCours}
          className="shrink-0 rounded-lg border border-bordure-controle bg-surface px-2.5 py-1.5 text-xs font-medium text-primaire transition-colors hover:bg-surface-2 cursor-pointer disabled:opacity-50"
        >
          {chargement
            ? "Le tuteur réfléchit…"
            : proposition
              ? "Proposer à nouveau"
              : "Proposer des relations"}
        </button>
      </div>

      {message && (
        <p className="rounded-lg border border-danger/30 bg-danger-faible px-3 py-2 text-xs text-danger">
          {message}
        </p>
      )}

      {proposition?.resume && (
        <p className="rounded-lg border border-primaire/25 bg-primaire-faible/30 px-3 py-2 text-xs leading-relaxed text-texte-attenue">
          {proposition.resume}
        </p>
      )}

      <BlocRelation
        titre="Prérequis"
        aide="Ce qu’il faut savoir faire avant celle-ci."
        sens="prerequis"
        codesDeclares={vue.prerequis}
        propositions={proposition ? restantes(proposition.prerequis, "prerequis") : null}
        nomsParDomaine={nomsParDomaine}
        elements={elements}
        ouvrirElement={ouvrirElement}
        onValider={valider}
        onEcarter={(relation, sens) =>
          setEcartees((precedentes) => new Set(precedentes).add(cle(relation, sens)))
        }
        onRetirer={(autre, sens) =>
          ecrire(() =>
            sens === "prerequis" ? delierCompetences(autre, vue.code) : delierCompetences(vue.code, autre),
          )
        }
        enCours={enCours}
      />

      <BlocRelation
        titre="Compétences suivantes"
        aide="Ce que celle-ci ouvre, une fois acquise."
        sens="suivante"
        codesDeclares={vue.suivantes}
        propositions={proposition ? restantes(proposition.suivantes, "suivante") : null}
        nomsParDomaine={nomsParDomaine}
        elements={elements}
        ouvrirElement={ouvrirElement}
        onValider={valider}
        onEcarter={(relation, sens) =>
          setEcartees((precedentes) => new Set(precedentes).add(cle(relation, sens)))
        }
        onRetirer={(autre, sens) =>
          ecrire(() =>
            sens === "prerequis" ? delierCompetences(autre, vue.code) : delierCompetences(vue.code, autre),
          )
        }
        enCours={enCours}
      />
    </div>
  );
}
