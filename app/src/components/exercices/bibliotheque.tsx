import Link from "next/link";
import { chargerContexte } from "@/lib/store/context";
import { libelleDomaine } from "@/lib/domain/referentiel-compte";
import {
  compterTentatives,
  estRetirable,
  usageExercice,
  EXERCICES_PAR_LOT_MAX,
  type UsageExercice,
} from "@/lib/domain/exercice";
import type { Exercise, ExerciseAttempt, Referentiel, TypeExercice } from "@/lib/domain/types";
import {
  Carte,
  CodeCompetence,
  CorpsCarte,
  EnTeteCarte,
  Etiquette,
  EtatVide,
  LigneListe,
} from "@/components/ui/primitives";
import { Depliant } from "@/components/ui/explication";
import { BoutonGenerer } from "@/components/exercices/bouton-generer";
import {
  calibragesPourModale,
  competencesPourModale,
} from "@/components/exercices/proprietes-generation";
import { RetraitExercice } from "@/components/exercices/retrait";
import { formatDuree } from "@/lib/engine/dates";

/**
 * Bibliothèque d'exercices — la vue « Bibliothèque » du pôle Séances (lot 3.2).
 *
 * C'est l'ancien écran `/exercices`, allégé : le sélecteur de statut a disparu
 * (le pilotage n'est plus ici — il vit au tableau de bord et dans le compositeur
 * de séance), et aucun filtre ne le remplace (CLAUDE.md §8). Le regroupement par
 * domaine, « Acquis », « Archivés », le retrait, l'édition et le panneau
 * « compétences sans exercice » restent.
 */

const LOT_MAX = EXERCICES_PAR_LOT_MAX;

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

export async function Bibliotheque() {
  const ctx = await chargerContexte();
  const tentatives = ctx.donnees.attempts;
  const exercices = ctx.donnees.exercises;

  const archives = exercices.filter((e) => e.archive);
  const vivants = exercices.filter((e) => !e.archive);
  const acquis = vivants.filter((e) => usageExercice(e.id, tentatives) === "acquis");
  const enFlux = vivants.filter((e) => usageExercice(e.id, tentatives) !== "acquis");

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

  const idsGroupes = new Set(groupes.flatMap((g) => g.items.map((e) => e.id)));
  const orphelins = enFlux.filter((e) => !idsGroupes.has(e.id));

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
      {totalDecouvert > 0 && (
        <Carte>
          <CorpsCarte>
            <Depliant
              resume={`${totalDecouvert} compétence${totalDecouvert > 1 ? "s" : ""} sans aucun exercice`}
            >
              <p className="mt-2 max-w-2xl text-xs text-texte-attenue">
                Le moteur ne peut proposer que ce qui existe. Tant qu&apos;une compétence
                n&apos;a aucun exercice, la recommandation retombe sur le tuteur — et si
                toutes celles qui en ont sont déjà faites ou ratées, la file paraît tourner
                en rond. Demander un lot par domaine évite d&apos;ouvrir une conversation par
                compétence.
              </p>
              <ul className="mt-3 divide-y divide-bordure border-t border-bordure">
                {decouverts.map(({ domaine, codes }) => {
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
                      <BoutonGenerer
                        competences={competencesPourModale(
                          ctx.referentiel.actifs.filter((s) => s.domaine === domaine.id),
                        )}
                        competenceInitiale={lot[0]}
                        calibrages={calibragesPourModale(ctx.referentiel.actifs, ctx.calibrations)}
                        compteId={ctx.donnees.user.id}
                        libelle={`Générer un exercice${codes.length > lot.length ? ` (sur ${codes.length})` : ""}`}
                      />
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Générer un exercice</p>
              <p className="mt-0.5 max-w-2xl text-xs text-texte-attenue">
                Le tuteur rédige, tu relis et tu valides. Rien n&apos;est écrit avant.
              </p>
            </div>
            <BoutonGenerer
              competences={competencesPourModale(ctx.referentiel.actifs)}
              competenceInitiale={
                ctx.recommandations[0]?.etat.skill.code ?? ctx.referentiel.actifs[0]?.code ?? ""
              }
              calibrages={calibragesPourModale(ctx.referentiel.actifs, ctx.calibrations)}
              compteId={ctx.donnees.user.id}
              libelle="Générer"
            />
          </div>
        </CorpsCarte>
      </Carte>

      <div className="text-xs text-texte-attenue">
        {exercices.length} exercice{exercices.length > 1 ? "s" : ""}
        {acquis.length > 0 && ` · ${acquis.length} acquis`}
        {archives.length > 0 && ` · ${archives.length} archivé${archives.length > 1 ? "s" : ""}`}
      </div>

      {exercices.length === 0 ? (
        <Carte>
          <EtatVide
            titre="Aucun exercice dans la bibliothèque"
            message="Demande au tuteur de générer un exercice sur la compétence que tu veux travailler."
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
                    délai reste possible — c&apos;est même ce qui fait monter la robustesse —
                    mais ce n&apos;est plus ce que le système propose de lui-même.
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
                    qu&apos;ils ont produites restent en base — une preuve ne disparaît pas.
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
      <Link href={`/exercices/${ex.id}`} className="block min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{ex.titre}</span>
          {ex.diagnostic && <Etiquette ton="info">Diagnostic</Etiquette>}
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
              <span>{nombre} tentative{nombre > 1 ? "s" : ""}</span>
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

