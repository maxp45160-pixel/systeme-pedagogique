import Link from "next/link";
import { chargerContexte } from "@/lib/store/context";
import { DOMAINES, libelleDomaine } from "@/lib/domain/referentiel";
import { DIFFICULTES, type Exercise, type TypeExercice } from "@/lib/domain/types";
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
  domaine?: string;
  difficulte?: string;
  competence?: string;
  statut?: string;
  duree?: string;
  type?: string;
}

export default async function PageExercices(props: {
  searchParams: Promise<Filtres & { proposition?: string }>;
}) {
  // `proposition` est un simple drapeau d'ouverture posé par le chat : il est
  // extrait des filtres pour ne pas se propager dans les liens de filtrage.
  const { proposition, ...f } = await props.searchParams;
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
  if (f.domaine) exercices = exercices.filter((e) => e.domaine === f.domaine);
  if (f.type) exercices = exercices.filter((e) => e.type === f.type);
  if (f.competence) exercices = exercices.filter((e) => e.competences.includes(f.competence!));
  if (f.difficulte) exercices = exercices.filter((e) => String(e.difficulte) === f.difficulte);
  if (f.duree === "court") exercices = exercices.filter((e) => e.dureeEstimeeMin <= 25);
  if (f.duree === "long") exercices = exercices.filter((e) => e.dureeEstimeeMin > 25);
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
      <EntetePage
        titre="Exercices"
        sousTitre="Chaque exercice terminé produit une preuve datée, avec l'autonomie réellement observée. C'est ce qui fait évoluer les compétences."
      />

      <Carte className="mb-4">
        <div className="px-4 py-3">
          <Depliant resume="Ajouter un exercice" ouvertParDefaut={Boolean(proposition)}>
            <div className="mt-3">
              <p className="mb-4 max-w-2xl text-xs text-texte-attenue">
                Pour ajouter un exercice à ta bibliothèque — saisi à la main, ou proposé par le
                tuteur depuis la conversation. Il apparaîtra dans la liste et pourra être commencé
                comme les diagnostics.
              </p>
              <FormulaireCreationExercice
                propositionEnAttente={Boolean(proposition)}
                skillsDisponibles={ctx.etats.map((e) => ({
                  code: e.skill.code,
                  intitule: e.skill.intitule,
                }))}
              />
            </div>
          </Depliant>
        </div>
      </Carte>

      {/* Filtres — une ligne de contrôles au-dessus de la liste. */}
      <Carte className="mb-4">
        <div className="space-y-2.5 px-4 py-3">
          <LigneFiltre libelle="Domaine">
            <Puce href={lien({ domaine: undefined })} actif={!f.domaine}>
              Tous
            </Puce>
            {DOMAINES.map((d) => (
              <Puce key={d.id} href={lien({ domaine: d.id })} actif={f.domaine === d.id}>
                {d.nom}
              </Puce>
            ))}
          </LigneFiltre>

          <LigneFiltre libelle="Type">
            <Puce href={lien({ type: undefined })} actif={!f.type}>
              Tous
            </Puce>
            {TYPES.filter((t) => ctx.donnees.exercises.some((e) => e.type === t.cle)).map((t) => (
              <Puce key={t.cle} href={lien({ type: t.cle })} actif={f.type === t.cle}>
                {t.libelle}
              </Puce>
            ))}
          </LigneFiltre>

          <LigneFiltre libelle="Difficulté">
            <Puce href={lien({ difficulte: undefined })} actif={!f.difficulte}>
              Toutes
            </Puce>
            {[1, 2, 3, 4, 5].map((n) => (
              <Puce
                key={n}
                href={lien({ difficulte: String(n) })}
                actif={f.difficulte === String(n)}
              >
                {n} · {DIFFICULTES[n as 1]}
              </Puce>
            ))}
          </LigneFiltre>

          <LigneFiltre libelle="Durée">
            <Puce href={lien({ duree: undefined })} actif={!f.duree}>
              Toutes
            </Puce>
            <Puce href={lien({ duree: "court" })} actif={f.duree === "court"}>
              ≤ 25 min
            </Puce>
            <Puce href={lien({ duree: "long" })} actif={f.duree === "long"}>
              &gt; 25 min
            </Puce>
          </LigneFiltre>

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
            <LigneFiltre libelle="Compétence">
              <Puce href={lien({ competence: undefined })} actif={false}>
                {f.competence} ✕
              </Puce>
            </LigneFiltre>
          )}

          {!aucunFiltre && (
            <div className="pt-1">
              <Link href="/exercices" className="text-xs text-primaire hover:underline">
                Réinitialiser les filtres
              </Link>
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
                          <span>{libelleDomaine(ex.domaine)}</span>
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
