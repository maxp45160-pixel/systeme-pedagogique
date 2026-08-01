import { Suspense } from "react";
import Link from "next/link";
import { SqueletteContenu } from "@/components/layout/squelette";
import { chargerContexte } from "@/lib/store/context";
import { libelleDomaine } from "@/lib/domain/referentiel-compte";
import type { Exercise, TypeExercice } from "@/lib/domain/types";
import { EntetePage } from "@/components/layout/entete-page";
import {
  Carte,
  CodeCompetence,
  cx,
  Etiquette,
  EtatVide,
} from "@/components/ui/primitives";
import { Depliant } from "@/components/ui/explication";
import { FormulaireCreationExercice } from "@/components/exercices/formulaire-creation";
import { formatDuree } from "@/lib/engine/dates";

const TYPES: { cle: TypeExercice; libelle: string }[] = [
  { cle: "rappel", libelle: "Rappel" },
  { cle: "application", libelle: "Application" },
  { cle: "calcul", libelle: "Calcul" },
  { cle: "probleme", libelle: "Problème" },
  { cle: "etude-de-cas", libelle: "Étude de cas" },
  { cle: "programmation", libelle: "Programmation" },
  { cle: "simulation", libelle: "Simulation" },
  { cle: "projet", libelle: "Projet" },
];

type Statut = "tous" | "a-faire" | "en-cours" | "termine";

interface Filtres {
  competence?: string;
  statut?: string;
}

export default async function PageExercices(props: {
  searchParams: Promise<Filtres & { proposition?: string }>;
}) {
  // `proposition` est un simple drapeau d'ouverture posé par le chat : il est
  // extrait des filtres pour ne pas se propager dans les liens de filtrage.
  const { proposition, ...f } = await props.searchParams;

  return (
    <>
      <EntetePage
        titre="Exercices"
        sousTitre="Chaque exercice terminé produit une preuve datée, avec l'autonomie réellement observée. C'est ce qui fait évoluer les compétences."
      />

      <Suspense fallback={<SqueletteContenu />}>
        <ContenuExercices proposition={proposition} filtres={f} />
      </Suspense>
    </>
  );
}

async function ContenuExercices({
  proposition,
  filtres: f,
}: {
  proposition?: string;
  filtres: Filtres;
}) {
  const ctx = await chargerContexte();

  // Statut dérivé des tentatives — jamais stocké sur l'exercice lui-même.
  const statutDe = (ex: Exercise): Statut => {
    const t = ctx.donnees.attempts.filter((a) => a.exerciseId === ex.id);
    if (t.some((a) => a.statut === "terminee")) return "termine";
    if (t.some((a) => a.statut === "en-cours")) return "en-cours";
    return "a-faire";
  };

  const scoreDe = (ex: Exercise) => {
    const terminees = ctx.donnees.attempts.filter(
      (a) => a.exerciseId === ex.id && a.statut === "terminee",
    );
    return terminees.at(-1) ?? null;
  };

  let exercices = ctx.donnees.exercises;
  if (f.competence) exercices = exercices.filter((e) => e.competences.includes(f.competence!));
  if (f.statut && f.statut !== "tous") exercices = exercices.filter((e) => statutDe(e) === f.statut);

  const lien = (maj: Partial<Filtres>) => {
    const params = new URLSearchParams();
    const fusion = { ...f, ...maj };
    for (const [k, v] of Object.entries(fusion)) {
      if (v) params.set(k, String(v));
    }
    const q = params.toString();
    return `/exercices${q ? `?${q}` : ""}`;
  };

  const aucunFiltre = Object.values(f).every((v) => !v);

  return (
    <>
      <Carte className="mb-4">
        <div className="px-4 py-3">
          <Depliant resume="Ajouter un exercice" ouvertParDefaut={Boolean(proposition)}>
            <div className="mt-3">
              <p className="mb-4 max-w-2xl text-xs text-texte-attenue">
                Un exercice validé rejoint la bibliothèque et se travaille comme les
                diagnostics.
              </p>
              <FormulaireCreationExercice
                propositionEnAttente={Boolean(proposition)}
                compteId={ctx.donnees.user.id}
                skillsDisponibles={ctx.etats.map((e) => ({
                  code: e.skill.code,
                  intitule: e.skill.intitule,
                  domaine: e.skill.domaine,
                }))}
              />
            </div>
          </Depliant>
        </div>
      </Carte>

      {/*
        Un seul axe de filtrage : le statut. Les cinq familles précédentes
        (domaine, type, difficulté, durée, compétence) offraient ~5 000
        combinaisons pour une bibliothèque qui en compte une poignée — trier
        coûtait plus cher que lire la liste entière. Elles reviendront quand le
        stock le justifiera, pas avant.
      */}
      <Carte className="mb-4">
        <div className="px-4 py-3">
          <LigneFiltre libelle="Statut">
            {(["tous", "a-faire", "en-cours", "termine"] as Statut[]).map((s) => (
              <Puce
                key={s}
                href={lien({ statut: s === "tous" ? undefined : s })}
                actif={s === "tous" ? !f.statut : f.statut === s}
              >
                {s === "tous"
                  ? "Tous"
                  : s === "a-faire"
                    ? "À faire"
                    : s === "en-cours"
                      ? "En cours"
                      : "Terminés"}
              </Puce>
            ))}
          </LigneFiltre>

          {f.competence && (
            <div className="mt-2.5">
              <LigneFiltre libelle="Compétence">
                <Puce href={lien({ competence: undefined })} actif={false}>
                  {f.competence} ✕
                </Puce>
              </LigneFiltre>
            </div>
          )}
        </div>
      </Carte>

      <div className="mb-3 text-xs text-texte-attenue">
        {exercices.length} exercice{exercices.length > 1 ? "s" : ""}
        {aucunFiltre ? " au total" : " correspondant aux filtres"}
      </div>

      {exercices.length === 0 ? (
        <Carte>
          <EtatVide
            titre="Aucun exercice ne correspond"
            message="Élargis les filtres, ou demande au tuteur de générer un exercice sur la compétence visée."
            action={
              <Link href="/tuteur" className="text-xs text-primaire hover:underline">
                Aller au tuteur
              </Link>
            }
          />
        </Carte>
      ) : (
        <Carte>
          <ul className="divide-y divide-bordure">
            {exercices.map((ex) => {
              const statut = statutDe(ex);
              const tentative = scoreDe(ex);
              return (
                <li key={ex.id}>
                  <Link
                    href={`/exercices/${ex.id}`}
                    className="block px-4 py-3 transition-colors hover:bg-surface-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{ex.titre}</span>
                          {ex.diagnostic && <Etiquette ton="info">Diagnostic</Etiquette>}
                          {/*
                            Traçabilité du corpus (ADR-004) : un énoncé proposé
                            par le tuteur n'a été relu par personne d'autre que
                            l'utilisateur. On l'affiche plutôt que de le taire.
                          */}
                          {ex.origine === "tuteur" && <Etiquette ton="primaire">Tuteur</Etiquette>}
                          {ex.origine === "manuel" && <Etiquette>Manuel</Etiquette>}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] text-texte-discret">
                          <span>{libelleDomaine(ctx.referentiel, ex.domaine)}</span>
                          <span>·</span>
                          <span>{TYPES.find((t) => t.cle === ex.type)?.libelle ?? ex.type}</span>
                          <span>·</span>
                          <span>Difficulté {ex.difficulte}/5</span>
                          <span>·</span>
                          <span>≈ {formatDuree(ex.dureeEstimeeMin)}</span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {ex.competences.map((c, i) => (
                            <span key={c} className="inline-flex items-center gap-1">
                              <CodeCompetence code={c} />
                              {i === 0 && ex.competences.length > 1 && (
                                <span className="text-[0.625rem] text-texte-discret">(cible)</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {statut === "termine" && tentative && (
                          <Etiquette
                            ton={
                              tentative.resultat === "reussi"
                                ? "succes"
                                : tentative.resultat === "partiel"
                                  ? "info"
                                  : "alerte"
                            }
                          >
                            {tentative.resultat === "reussi"
                              ? "Réussi"
                              : tentative.resultat === "partiel"
                                ? "Partiel"
                                : "Non abouti"}
                          </Etiquette>
                        )}
                        {statut === "en-cours" && <Etiquette ton="primaire">En cours</Etiquette>}
                        {statut === "a-faire" && <Etiquette>À faire</Etiquette>}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Carte>
      )}
    </>
  );
}

function LigneFiltre({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-20 shrink-0 text-[0.625rem] font-semibold uppercase tracking-wider text-texte-discret">
        {libelle}
      </span>
      {children}
    </div>
  );
}

function Puce({
  href,
  actif,
  children,
}: {
  href: string;
  actif: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "rounded border px-1.5 py-0.5 text-[0.6875rem] font-medium transition-colors",
        actif
          ? "border-primaire/30 bg-primaire-faible text-primaire"
          : "border-bordure text-texte-attenue hover:bg-surface-2 hover:text-texte",
      )}
    >
      {children}
    </Link>
  );
}
