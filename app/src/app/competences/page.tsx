import Link from "next/link";
import { chargerContexte } from "@/lib/store/context";
import { DOMAINES } from "@/lib/domain/referentiel";
import type { DomaineId, SkillState } from "@/lib/domain/types";
import { EntetePage } from "@/components/layout/entete-page";
import {
  Carte,
  CodeCompetence,
  cx,
  EnTeteCarte,
  Etiquette,
  JaugeNiveau,
  Statistique,
} from "@/components/ui/primitives";
import { Radar, RepartitionNiveaux } from "@/components/charts";
import { formatDateRelative } from "@/lib/engine/dates";

type Vue = "grille" | "arbre" | "radar";

const VUES: { cle: Vue; libelle: string }[] = [
  { cle: "grille", libelle: "Grille" },
  { cle: "arbre", libelle: "Arbre" },
  { cle: "radar", libelle: "Radar" },
];

export default async function PageCompetences(props: {
  searchParams: Promise<{ vue?: string; domaine?: string }>;
}) {
  const { vue: vueBrute, domaine: domaineBrut } = await props.searchParams;
  const vue: Vue = vueBrute === "arbre" || vueBrute === "radar" ? vueBrute : "grille";
  const filtre = DOMAINES.find((d) => d.id === domaineBrut)?.id ?? null;

  const ctx = await chargerContexte();
  const etats = filtre ? ctx.etats.filter((e) => e.skill.domaine === filtre) : ctx.etats;

  return (
    <>
      <EntetePage
        titre="Compétences"
        sousTitre="Le référentiel complet, avec pour chaque compétence son niveau, la confiance de l'évaluation et la solidité des acquis."
        actions={
          <div className="flex rounded-md border border-bordure p-0.5">
            {VUES.map((v) => (
              <Link
                key={v.cle}
                href={`/competences?vue=${v.cle}${filtre ? `&domaine=${filtre}` : ""}`}
                className={cx(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  vue === v.cle
                    ? "bg-primaire-faible text-primaire"
                    : "text-texte-attenue hover:text-texte",
                )}
              >
                {v.libelle}
              </Link>
            ))}
          </div>
        }
      />

      <FiltreDomaines actif={filtre} vue={vue} etats={ctx.etats} />

      {vue === "grille" && <VueGrille etats={etats} />}
      {vue === "arbre" && <VueArbre etats={etats} />}
      {vue === "radar" && <VueRadar global={ctx.global} />}
    </>
  );
}

/* ------------------------------------------------------------------ */

function FiltreDomaines({
  actif,
  vue,
  etats,
}: {
  actif: DomaineId | null;
  vue: Vue;
  etats: SkillState[];
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-1.5">
      <Link
        href={`/competences?vue=${vue}`}
        className={cx(
          "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
          actif === null
            ? "border-primaire/30 bg-primaire-faible text-primaire"
            : "border-bordure text-texte-attenue hover:bg-surface-2",
        )}
      >
        Tous les domaines
      </Link>
      {DOMAINES.map((d) => {
        const n = etats.filter((e) => e.skill.domaine === d.id).length;
        const evalues = etats.filter(
          (e) => e.skill.domaine === d.id && e.statut === "evalue",
        ).length;
        return (
          <Link
            key={d.id}
            href={`/competences?vue=${vue}&domaine=${d.id}`}
            className={cx(
              "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
              actif === d.id
                ? "border-primaire/30 bg-primaire-faible text-primaire"
                : "border-bordure text-texte-attenue hover:bg-surface-2",
            )}
          >
            {d.nom}
            <span className="ml-1.5 chiffres text-texte-discret">
              {evalues}/{n}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vue grille — la vue par défaut                                      */
/* ------------------------------------------------------------------ */

function VueGrille({ etats }: { etats: SkillState[] }) {
  const parDomaine = DOMAINES.map((d) => ({
    domaine: d,
    items: etats.filter((e) => e.skill.domaine === d.id),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      {parDomaine.map(({ domaine, items }) => {
        const repartition: Record<number, number> = {};
        for (const e of items) {
          if (e.niveau !== null) repartition[e.niveau] = (repartition[e.niveau] ?? 0) + 1;
        }
        const preuves = items.reduce((s, e) => s + e.preuves.length, 0);

        return (
          <Carte key={domaine.id}>
            <EnTeteCarte
              titre={domaine.nom}
              legende={`${items.length} compétences · ${preuves} preuve${preuves > 1 ? "s" : ""}`}
              action={
                Object.keys(repartition).length > 0 ? (
                  <div className="w-40">
                    <RepartitionNiveaux compte={repartition} />
                  </div>
                ) : (
                  <Etiquette>Aucune preuve</Etiquette>
                )
              }
            />
            <ul className="divide-y divide-bordure">
              {items.map((e) => (
                <LigneCompetence key={e.skill.code} etat={e} />
              ))}
            </ul>
          </Carte>
        );
      })}
    </div>
  );
}

function LigneCompetence({ etat }: { etat: SkillState }) {
  return (
    <li>
      <Link
        href={`/competences/${etat.skill.code}`}
        className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2"
      >
        <div className="w-16 shrink-0">
          <CodeCompetence code={etat.skill.code} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{etat.skill.intitule}</p>
          <p className="mt-0.5 text-[0.6875rem] text-texte-discret">
            {etat.statut === "non-evalue" && "Jamais évaluée"}
            {etat.statut === "hypothese" && "Hypothèse BUT QLIO — non vérifiée"}
            {etat.statut === "evalue" &&
              `${etat.preuves.length} preuve${etat.preuves.length > 1 ? "s" : ""} · ${
                etat.contextesTestes.length
              } contexte${etat.contextesTestes.length > 1 ? "s" : ""}${
                etat.dernierePreuve ? ` · ${formatDateRelative(etat.dernierePreuve)}` : ""
              }`}
          </p>
        </div>

        <div className="hidden w-24 shrink-0 sm:block">
          <JaugeNiveau niveau={etat.niveau} />
        </div>

        <div className="w-14 shrink-0 text-right">
          <span
            className={cx(
              "chiffres text-sm font-semibold",
              etat.niveau === null && "text-texte-discret",
            )}
          >
            {etat.niveau ?? "—"}
          </span>
          <span className="text-[0.6875rem] text-texte-discret">/5</span>
        </div>

        <div className="hidden w-20 shrink-0 text-right sm:block">
          <span className="text-[0.6875rem] text-texte-discret">
            {etat.confiance === "nulle" ? "—" : etat.confiance}
          </span>
        </div>
      </Link>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Vue arbre                                                           */
/* ------------------------------------------------------------------ */

const PALIERS = [
  { cle: "fondamentaux", titre: "Fondamentaux" },
  { cle: "intermediaire", titre: "Niveau intermédiaire" },
  { cle: "avance", titre: "Niveau avancé" },
] as const;

/**
 * Arbre de progression par domaine.
 *
 * Les prérequis sont signalés mais jamais bloquants : le cahier des charges
 * exclut le verrouillage artificiel, et l'exploration doit rester libre.
 * Une compétence dont les prérequis manquent est simplement annotée.
 */
function VueArbre({ etats }: { etats: SkillState[] }) {
  const parCode = new Map(etats.map((e) => [e.skill.code, e]));

  const domaines = DOMAINES.map((d) => ({
    domaine: d,
    items: etats.filter((e) => e.skill.domaine === d.id),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      <p className="text-xs text-texte-attenue">
        Les prérequis sont indiqués à titre d&apos;orientation. Aucune compétence n&apos;est
        verrouillée : tu peux commencer où tu veux.
      </p>

      {domaines.map(({ domaine, items }) => (
        <Carte key={domaine.id}>
          <EnTeteCarte titre={domaine.nom} legende={domaine.description} />
          <div className="space-y-4 px-4 py-4">
            {PALIERS.map(({ cle, titre }) => {
              const duPalier = items.filter((e) => e.skill.palier === cle);
              if (duPalier.length === 0) return null;
              return (
                <div key={cle}>
                  <div className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
                    {titre}
                  </div>
                  <ul className="space-y-1 border-l border-bordure pl-3">
                    {duPalier.map((e) => {
                      const manquants = e.skill.prerequis.filter((c) => {
                        const p = parCode.get(c);
                        return !p || p.niveau === null || p.niveau < 2;
                      });
                      return (
                        <li key={e.skill.code} className="relative">
                          <span
                            className="absolute -left-3 top-3 h-px w-2.5 bg-bordure"
                            aria-hidden
                          />
                          <Link
                            href={`/competences/${e.skill.code}`}
                            className="flex items-center gap-2 rounded px-1.5 py-1 transition-colors hover:bg-surface-2"
                          >
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{
                                background:
                                  e.niveau === null
                                    ? "var(--niveau-vide)"
                                    : `var(--niveau-${e.niveau})`,
                              }}
                              aria-hidden
                            />
                            <CodeCompetence code={e.skill.code} />
                            <span className="min-w-0 flex-1 truncate text-xs">
                              {e.skill.intitule}
                            </span>
                            {manquants.length > 0 && (
                              <span className="shrink-0 text-[0.625rem] text-texte-discret">
                                prérequis : {manquants.join(", ")}
                              </span>
                            )}
                            <span
                              className={cx(
                                "chiffres w-6 shrink-0 text-right text-xs font-medium",
                                e.niveau === null && "text-texte-discret",
                              )}
                            >
                              {e.niveau ?? "—"}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </Carte>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vue radar — secondaire par construction                             */
/* ------------------------------------------------------------------ */

function VueRadar({
  global,
}: {
  global: Awaited<ReturnType<typeof chargerContexte>>["global"];
}) {
  const axes = global.parDomaine.map((d) => ({
    libelle: d.nom.split(" ")[0],
    valeur: d.score,
  }));
  const sansPreuve = global.parDomaine.filter((d) => d.score === null);

  return (
    <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
      <Carte>
        <EnTeteCarte
          titre="Vue d'ensemble par domaine"
          legende="Score sur 100, pondéré par l'importance des compétences"
        />
        <div className="px-4 py-5">
          <Radar axes={axes} />
          {sansPreuve.length > 0 && (
            <p className="mt-4 rounded-md border border-bordure bg-surface-2 px-3 py-2 text-[0.6875rem] text-texte-attenue">
              <strong className="font-medium">Lecture prudente.</strong>{" "}
              {sansPreuve.length} domaine(s) sont tracés à zéro faute de preuve, non parce
              qu&apos;une faiblesse a été mesurée :{" "}
              {sansPreuve.map((d) => d.nom).join(", ")}.
            </p>
          )}
        </div>
      </Carte>

      <Carte>
        <EnTeteCarte titre="Détail chiffré" legende="La même information, sans dépendre de la forme" />
        <ul className="divide-y divide-bordure">
          {global.parDomaine.map((d) => (
            <li key={d.domaine} className="flex items-center gap-3 px-4 py-2.5">
              <Link
                href={`/competences?domaine=${d.domaine}`}
                className="min-w-0 flex-1 truncate text-sm hover:underline"
              >
                {d.nom}
              </Link>
              <Statistique libelle="" valeur={d.score} unite="/100" />
              <span className="w-24 shrink-0 text-right text-[0.6875rem] text-texte-discret">
                {d.competencesEvaluees}/{d.competencesTotal} évaluées
              </span>
            </li>
          ))}
        </ul>
      </Carte>
    </div>
  );
}
