import Link from "next/link";
import type { SkillState } from "@/lib/domain/types";
import { revisionsDues, type RevisionDue } from "@/lib/engine/spaced";
import {
  Carte,
  CodeCompetence,
  EnTeteCarte,
} from "@/components/ui/primitives";
import { Depliant } from "@/components/ui/explication";
import { FacteursRevision } from "@/components/ui/facteurs-revision";
import { BoutonGenerer } from "@/components/exercices/bouton-generer";
import type { CalibrageModale, CompetenceModale } from "@/components/exercices/proprietes-generation";

/**
 * « À réviser » — les compétences dont l'intervalle de répétition espacée est
 * dépassé, triées par retard relatif (joursEcoules / intervalleJours).
 *
 * Server Component : aucun état local, aucun `"use client"`. La liste se
 * dérive des états à la lecture, comme tout le reste du moteur.
 *
 * Le bloc se place APRÈS `CarteProchaineAction` et n'affiche jamais la
 * compétence qu'elle porte déjà (la recommandation n°1) : répéter l'action
 * prioritaire la diluerait au lieu de la renforcer.
 */
export function RevisionsDues({
  etats,
  now,
  codeExclu,
  competences,
  calibrages,
  compteId,
}: {
  etats: SkillState[];
  now: Date;
  /** Code de la recommandation n°1 — déjà affichée par `CarteProchaineAction`. */
  codeExclu?: string;
  /** Compétences actives pour la modale de génération. */
  competences: CompetenceModale[];
  /** Calibrages de toutes les compétences actives, indexés par code. */
  calibrages: Record<string, CalibrageModale>;
  compteId: string;
}) {
  const dues = revisionsDues(etats, now).filter((d) => d.etat.skill.code !== codeExclu);

  // Aucune preuve nulle part (compte neuf) : le bloc ne s'affiche pas. Le
  // tableau de bord a déjà son encart d'initialisation.
  const aucunePreuve = etats.every((e) => e.preuves.length === 0);
  if (aucunePreuve) return null;

  // Aucune due : une seule ligne factuelle en retrait. Pas de félicitation,
  // pas d'emoji — le produit énonce des faits, il n'encourage pas.
  if (dues.length === 0) {
    return (
      <p className="mb-6 text-xs text-texte-discret">Aucune révision due aujourd&#39;hui.</p>
    );
  }

  const LIMITE = 5;
  const affichees = dues.slice(0, LIMITE);
  const masquees = dues.length - affichees.length;

  return (
    <Carte className="mb-6">
      <EnTeteCarte
        titre="À réviser"
        legende="Compétences dont l'intervalle de répétition espacée est dépassé — triées par retard"
      />
      <ul className="divide-y divide-bordure">
        {affichees.map((d) => (
          <LigneRevision
            key={d.etat.skill.code}
            due={d}
            competences={competences}
            calibrages={calibrages}
            compteId={compteId}
          />
        ))}
      </ul>

      {masquees > 0 && (
        <p className="px-4 py-2.5 text-xs text-texte-discret">
          + {masquees} autre{masquees > 1 ? "s" : ""} compétence{masquees > 1 ? "s" : ""} due
          {masquees > 1 ? "s" : ""}.
        </p>
      )}

      <div className="border-t border-bordure px-4 py-3">
        <Depliant resume="Pourquoi ces compétences ?">
          <div className="rounded-md border border-bordure bg-surface-2 p-3 text-xs">
            <p className="mb-2 text-texte-attenue">
              Chaque compétence ci-dessus est due : le temps écoulé depuis sa dernière preuve
              dépasse l&#39;intervalle de révision dérivé de son état (niveau, robustesse,
              confiance, dernier résultat). L&#39;ordre va de la plus en retard à la moins en
              retard : le retard se mesure en jours écoulés rapportés à l&#39;intervalle.
            </p>
            <p className="text-texte-attenue">
              Les facteurs de chaque intervalle se lisent sur la fiche de chaque compétence, sous
              « Prochaine révision ».
            </p>
          </div>
        </Depliant>
      </div>
    </Carte>
  );
}

/**
 * Une ligne du bloc « À réviser ».
 *
 * Le retard s'affiche en clair et dérivé : « due depuis 3 jours (intervalle
 * 5 j, 8 écoulés) ». Pas de « urgent », pas d'emoji, pas de score inventé —
 * un fait daté (P3).
 */
function LigneRevision({
  due,
  competences,
  calibrages,
  compteId,
}: {
  due: RevisionDue;
  competences: CompetenceModale[];
  calibrages: Record<string, CalibrageModale>;
  compteId: string;
}) {
  const { etat, revision } = due;
  const ecoules = revision.joursEcoules ?? 0;
  const intervalle = revision.intervalleJours;
  const retardJours = ecoules - intervalle;

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <CodeCompetence code={etat.skill.code} />
            <Link
              href={`/competences/${etat.skill.code}`}
              className="min-w-0 truncate text-sm font-medium hover:underline"
            >
              {etat.skill.intitule}
            </Link>
          </div>
          <p className="chiffres mt-1 text-[0.6875rem] text-texte-discret">
            {/*
              `due` vaut vrai dès que `ecoules >= intervalle` : le jour même de
              l'échéance, le retard est nul. « due depuis 0 jour » se lirait
              comme un défaut d'affichage — c'est pourtant le cas le plus
              fréquent, celui d'une révision prise à l'heure.
            */}
            {retardJours <= 0
              ? "due aujourd'hui"
              : `due depuis ${retardJours} jour${retardJours > 1 ? "s" : ""}`}{" "}
            (intervalle {intervalle} j, {ecoules} écoulé{ecoules > 1 ? "s" : ""})
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <BoutonGenerer
            competences={competences}
            competenceInitiale={etat.skill.code}
            calibrages={calibrages}
            compteId={compteId}
            libelle="Générer un exercice"
            variante="principal"
          />
        </div>
      </div>

      {/*
        Facteurs de l'intervalle, derrière un dépliant par ligne. Le rendu est
        partagé avec la fiche compétence (`FacteursRevision`) : un facteur ne
        peut pas diverger entre les deux surfaces (P3).
      */}
      <div className="mt-2">
        <Depliant resume="Pourquoi cet intervalle ?">
          <FacteursRevision facteurs={revision.facteurs} />
        </Depliant>
      </div>
    </li>
  );
}
