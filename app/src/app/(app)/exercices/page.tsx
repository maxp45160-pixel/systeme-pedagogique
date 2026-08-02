import { Suspense } from "react";
import Link from "next/link";
import { SqueletteContenu } from "@/components/layout/squelette";
import { chargerContexte } from "@/lib/store/context";
import { libelleDomaine } from "@/lib/domain/referentiel-compte";
import {
  compterTentatives,
  estRetirable,
  usageExercice,
  type UsageExercice,
} from "@/lib/domain/exercice";
import type { Exercise, ExerciseAttempt, Referentiel, TypeExercice } from "@/lib/domain/types";
import { EntetePage } from "@/components/layout/entete-page";
import {
  Carte,
  CodeCompetence,
  CorpsCarte,
  cx,
  EnTeteCarte,
  Etiquette,
  EtatVide,
  LigneListe,
} from "@/components/ui/primitives";
import { Depliant } from "@/components/ui/explication";
import { FormulaireCreationExercice } from "@/components/exercices/formulaire-creation";
import { RetraitExercice } from "@/components/exercices/retrait";
import { amorceLotExercices, lienTuteur } from "@/lib/tutor/amorces";
import { formatDuree } from "@/lib/engine/dates";

/**
 * Compétences demandées en une fois au tuteur.
 *
 * Six énoncés complets — énoncé, indices, correction, critères — tiennent dans
 * un tour ; seize se font couper en chemin. Le reste est annoncé, pas masqué.
 */
const LOT_MAX = 6;

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
  const tentatives = ctx.donnees.attempts;

  // Statut dérivé des tentatives — jamais stocké sur l'exercice lui-même.
  const statutDe = (ex: Exercise): Statut => {
    const usage = usageExercice(ex.id, tentatives);
    if (usage === "en-cours") return "en-cours";
    if (usage === "a-faire") return "a-faire";
    return "termine";
  };

  let exercices = ctx.donnees.exercises;
  if (f.competence) exercices = exercices.filter((e) => e.competences.includes(f.competence!));
  if (f.statut && f.statut !== "tous") exercices = exercices.filter((e) => statutDe(e) === f.statut);

  /*
   * Trois rangs, et non plus une seule liste à plat dans l'ordre où Supabase
   * a bien voulu répondre.
   *
   * `acquis` et `archives` restent consultables — ils ne sont simplement plus
   * dans le champ de vision par défaut. C'est le besoin réel : la bibliothèque
   * s'allonge sans que rien n'en sorte jamais, et ce qui est fait encombre ce
   * qui reste à faire. On REGROUPE et on RETIRE ; on ne rajoute pas de filtres
   * (voir plus bas).
   */
  const archives = exercices.filter((e) => e.archive);
  const vivants = exercices.filter((e) => !e.archive);
  const acquis = vivants.filter((e) => usageExercice(e.id, tentatives) === "acquis");
  const enFlux = vivants.filter((e) => usageExercice(e.id, tentatives) !== "acquis");

  // Regroupement par domaine, dans l'ordre du référentiel du compte.
  const groupes = ctx.referentiel.domaines
    .map((d) => ({
      domaine: d,
      items: enFlux
        .filter((e) => e.domaine === d.id)
        .sort(
          (a, b) =>
            (a.competences[0] ?? "").localeCompare(b.competences[0] ?? "") ||
            a.difficulte - b.difficulte ||
            a.titre.localeCompare(b.titre),
        ),
    }))
    .filter((g) => g.items.length > 0);

  // Un exercice dont le domaine n'existe plus au référentiel ne doit pas
  // disparaître de l'écran sans un mot : il est ramassé à part.
  const idsGroupes = new Set(groupes.flatMap((g) => g.items.map((e) => e.id)));
  const orphelins = enFlux.filter((e) => !idsGroupes.has(e.id));

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

  /*
   * Couverture du référentiel par le corpus.
   *
   * Au 02/08/2026, 40 des 54 compétences actives n'avaient AUCUN exercice.
   * C'est la cause de fond derrière « je refais toujours les mêmes » : le
   * moteur n'a rien d'autre à servir. Ce bloc rend la pénurie visible et offre
   * de la combler par domaine plutôt que compétence par compétence.
   */
  const couverts = new Set(ctx.exercicesActifs.flatMap((e) => e.competences));
  const decouverts = ctx.referentiel.domaines
    .map((d) => ({
      domaine: d,
      codes: ctx.etats
        .filter((e) => e.skill.domaine === d.id && !couverts.has(e.skill.code))
        .map((e) => e.skill.code),
    }))
    .filter((g) => g.codes.length > 0);
  const totalDecouvert = decouverts.reduce((s, g) => s + g.codes.length, 0);

  return (
    <div className="space-y-6">
      {totalDecouvert > 0 && aucunFiltre && (
        <Carte>
          <CorpsCarte>
            <Depliant
              resume={`${totalDecouvert} compétence${totalDecouvert > 1 ? "s" : ""} sans aucun exercice`}
            >
              <p className="mt-2 max-w-2xl text-xs text-texte-attenue">
                Le moteur ne peut proposer que ce qui existe. Tant qu'une compétence
                n'a aucun exercice, la recommandation retombe sur le tuteur — et si
                toutes celles qui en ont sont déjà faites ou ratées, la file paraît tourner
                en rond. Demander un lot par domaine évite d'ouvrir une conversation par
                compétence.
              </p>
              <ul className="mt-3 divide-y divide-bordure border-t border-bordure">
                {decouverts.map(({ domaine, codes }) => {
                  // Plafonné : un tour de tuteur qui rédige seize énoncés
                  // complets se fait couper avant la fin. Ce qui est laissé de
                  // côté est dit, jamais tronqué en silence (P3).
                  const lot = codes.slice(0, LOT_MAX);
                  return (
                    <li
                      key={domaine.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium">{domaine.nom}</p>
                        <p className="mt-0.5 flex flex-wrap gap-1 text-[0.6875rem] text-texte-discret">
                          {codes.map((c) => (
                            <CodeCompetence key={c} code={c} />
                          ))}
                        </p>
                      </div>
                      <Link
                        href={lienTuteur(amorceLotExercices(lot, domaine.nom))}
                        className="shrink-0 text-xs text-primaire hover:underline"
                      >
                        Demander {lot.length} exercice{lot.length > 1 ? "s" : ""} au tuteur
                        {codes.length > lot.length && ` (sur ${codes.length})`}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Depliant>
          </CorpsCarte>
        </Carte>
      )}

      <Carte>
        <CorpsCarte>
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
        </CorpsCarte>
      </Carte>

      {/*
        Un seul axe de filtrage : le statut. Les cinq familles précédentes
        (domaine, type, difficulté, durée, compétence) offraient ~5 000
        combinaisons pour une bibliothèque qui en compte une poignée — trier
        coûtait plus cher que lire la liste entière. Elles reviendront quand le
        stock le justifiera, pas avant. Le regroupement par domaine ci-dessous
        n'est pas un filtre : il ne cache rien, il ordonne.
      */}
      <Carte>
        <CorpsCarte>
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
        </CorpsCarte>
      </Carte>

      <div className="text-xs text-texte-attenue">
        {exercices.length} exercice{exercices.length > 1 ? "s" : ""}
        {aucunFiltre ? " au total" : " correspondant aux filtres"}
        {acquis.length > 0 && ` · ${acquis.length} acquis`}
        {archives.length > 0 && ` · ${archives.length} archivé${archives.length > 1 ? "s" : ""}`}
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
        <div className="space-y-6">
          {groupes.map(({ domaine, items }) => (
            <Carte key={domaine.id}>
              <EnTeteCarte
                titre={domaine.nom}
                action={
                  <span className="chiffres shrink-0 text-[0.6875rem] text-texte-discret">
                    {items.length} exercice{items.length > 1 ? "s" : ""}
                  </span>
                }
              />
              <ul className="divide-y divide-bordure">
                {items.map((ex) => (
                  <LigneExercice
                    key={ex.id}
                    exercice={ex}
                    tentatives={tentatives}
                    referentiel={ctx.referentiel}
                  />
                ))}
              </ul>
            </Carte>
          ))}

          {orphelins.length > 0 && (
            <Carte>
              <EnTeteCarte
                titre="Domaine retiré du référentiel"
                legende="Ces exercices citent un domaine qui n'est plus au référentiel. Leurs preuves restent lisibles ; l'énoncé, lui, n'a plus de rattachement."
              />
              <ul className="divide-y divide-bordure">
                {orphelins.map((ex) => (
                  <LigneExercice
                    key={ex.id}
                    exercice={ex}
                    tentatives={tentatives}
                    referentiel={ctx.referentiel}
                  />
                ))}
              </ul>
            </Carte>
          )}

          {acquis.length > 0 && (
            <Carte>
              <CorpsCarte>
                <Depliant resume={`Acquis — ${acquis.length} exercice${acquis.length > 1 ? "s" : ""} déjà réussi${acquis.length > 1 ? "s" : ""}`}>
                  <p className="mt-2 max-w-2xl text-xs text-texte-attenue">
                    Un exercice réussi sort de la file de recommandation. Le refaire après un
                    délai reste possible — c'est même ce qui fait monter la robustesse —
                    mais ce n'est plus ce que le système propose de lui-même.
                  </p>
                  <ul className="mt-2 divide-y divide-bordure border-t border-bordure">
                    {acquis.map((ex) => (
                      <LigneExercice
                        key={ex.id}
                        exercice={ex}
                        tentatives={tentatives}
                        referentiel={ctx.referentiel}
                      />
                    ))}
                  </ul>
                </Depliant>
              </CorpsCarte>
            </Carte>
          )}

          {archives.length > 0 && (
            <Carte>
              <CorpsCarte>
                <Depliant resume={`Archivés — ${archives.length} exercice${archives.length > 1 ? "s" : ""} retiré${archives.length > 1 ? "s" : ""} du flux`}>
                  <p className="mt-2 max-w-2xl text-xs text-texte-attenue">
                    Ces exercices ne sont plus proposés et ne calibrent plus rien. Les preuves
                    qu'ils ont produites restent en base — une preuve ne disparaît pas.
                  </p>
                  <ul className="mt-2 divide-y divide-bordure border-t border-bordure">
                    {archives.map((ex) => (
                      <LigneExercice
                        key={ex.id}
                        exercice={ex}
                        tentatives={tentatives}
                        referentiel={ctx.referentiel}
                      />
                    ))}
                  </ul>
                </Depliant>
              </CorpsCarte>
            </Carte>
          )}
        </div>
      )}
    </div>
  );
}

const LIBELLES_USAGE: Record<UsageExercice, { texte: string; ton?: "succes" | "info" | "primaire" }> = {
  "a-faire": { texte: "À faire" },
  "en-cours": { texte: "En cours", ton: "primaire" },
  acquis: { texte: "Réussi", ton: "succes" },
  travaille: { texte: "Travaillé", ton: "info" },
};

function LigneExercice({
  exercice: ex,
  tentatives,
  referentiel,
}: {
  exercice: Exercise;
  tentatives: ExerciseAttempt[];
  referentiel: Referentiel;
}) {
  const usage = usageExercice(ex.id, tentatives);
  const nombre = compterTentatives(ex.id, tentatives);
  const etiquette = LIBELLES_USAGE[usage];

  return (
    <LigneListe className="flex items-start gap-2">
      {/* Le lien ne couvre QUE le contenu : un bouton d'action imbriqué dans
          une ancre serait à la fois invalide et impossible à cliquer. */}
      <Link href={`/exercices/${ex.id}`} className="block min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{ex.titre}</span>
          {ex.diagnostic && <Etiquette ton="info">Diagnostic</Etiquette>}
          {/*
            Traçabilité du corpus (ADR-004) : un énoncé proposé par le tuteur
            n'a été relu par personne d'autre que l'utilisateur. On l'affiche
            plutôt que de le taire.
          */}
          {ex.origine === "tuteur" && <Etiquette ton="primaire">Tuteur</Etiquette>}
          {ex.origine === "manuel" && <Etiquette>Manuel</Etiquette>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] text-texte-discret">
          <span>{libelleDomaine(referentiel, ex.domaine)}</span>
          <span>·</span>
          <span>{TYPES.find((t) => t.cle === ex.type)?.libelle ?? ex.type}</span>
          <span>·</span>
          <span>Difficulté {ex.difficulte}/5</span>
          <span>·</span>
          <span>≈ {formatDuree(ex.dureeEstimeeMin)}</span>
          {nombre > 0 && (
            <>
              <span>·</span>
              <span>
                {nombre} tentative{nombre > 1 ? "s" : ""}
              </span>
            </>
          )}
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
      </Link>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <Etiquette ton={etiquette.ton}>{etiquette.texte}</Etiquette>
        {estRetirable(ex) && (
          <RetraitExercice
            exerciceId={ex.id}
            titre={ex.titre}
            tentatives={nombre}
            archive={Boolean(ex.archive)}
          />
        )}
      </div>
    </LigneListe>
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