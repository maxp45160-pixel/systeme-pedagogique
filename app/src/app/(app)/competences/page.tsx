import { Suspense } from "react";
import Link from "next/link";
import { chargerContexte } from "@/lib/store/context";
import {
  DOMAINES,
  DOMAINE_PAR_ID,
  DOMAINE_PILOTE,
  SKILLS,
  SKILLS_ACTIFS,
} from "@/lib/domain/referentiel";
import { SqueletteContenu } from "@/components/layout/squelette";
import type { SkillState } from "@/lib/domain/types";
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

type Vue = "grille" | "radar";

const VUES: { cle: Vue; libelle: string }[] = [
  { cle: "grille", libelle: "Grille" },
  { cle: "radar", libelle: "Radar" },
];

export default async function PageCompetences(props: {
  searchParams: Promise<{ vue?: string }>;
}) {
  const { vue: vueBrute } = await props.searchParams;
  const vue: Vue = vueBrute === "radar" ? "radar" : "grille";

  const domaine = DOMAINE_PAR_ID.get(DOMAINE_PILOTE);

  return (
    <>
      <EntetePage
        titre="Compétences"
        surtitre={domaine?.nom}
        // `SKILLS_ACTIFS.length` plutôt que `ctx.etats.length` : identique par
        // construction — `computeAllSkillStates` produit un état par compétence
        // active — mais connu sans attendre la lecture des preuves.
        sousTitre={`Périmètre de travail actuel : ${SKILLS_ACTIFS.length} compétences. Pour chacune, son niveau, la confiance de l'évaluation et la solidité des acquis.`}
        actions={
          <div className="flex rounded-md border border-bordure p-0.5">
            {VUES.map((v) => (
              <Link
                key={v.cle}
                href={`/competences?vue=${v.cle}`}
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

      {/*
        Le référentiel complet compte 53 compétences ; seul le domaine pilote
        est travaillé (ADR-020). Le dire franchement plutôt que laisser croire
        que le référentiel se limite à ça.
      */}
      <p className="mb-4 rounded-carte border border-info/30 bg-info-faible px-4 py-2.5 text-xs text-texte-attenue">
        <strong className="font-medium text-info">Périmètre pilote.</strong> Le référentiel
        contient {SKILLS.length} compétences réparties sur {DOMAINES.length} domaines. Un seul
        est travaillé pour l&apos;instant — les autres ne sont ni calculés ni affichés, faute de
        contenu pour les alimenter.
      </p>

      <Suspense key={vue} fallback={<SqueletteContenu />}>
        <ContenuCompetences vue={vue} />
      </Suspense>
    </>
  );
}

async function ContenuCompetences({ vue }: { vue: Vue }) {
  const ctx = await chargerContexte();

  return (
    <>
      {vue === "grille" && <VueGrille etats={ctx.etats} />}
      {vue === "radar" && <VueRadar etats={ctx.etats} />}
    </>
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
/* Vue radar — secondaire par construction                             */
/* ------------------------------------------------------------------ */

/**
 * Un axe par compétence du périmètre, et non plus par domaine (ADR-018).
 *
 * À l'échelle d'un pilote mono-domaine, un radar à sept axes dont six sont
 * vides ne dit rien. Au grain de la compétence il redevient lisible : on voit
 * quelles compétences du domaine tiennent et lesquelles n'ont pas été mesurées.
 */
function VueRadar({ etats }: { etats: SkillState[] }) {
  const axes = etats.map((e) => ({
    libelle: e.skill.code,
    // `score` est sur 5 côté moteur ; le radar raisonne en pourcentage.
    valeur: e.score === null ? null : Math.round((e.score / 5) * 100),
  }));
  const sansPreuve = etats.filter((e) => e.score === null);

  return (
    <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
      <Carte>
        <EnTeteCarte
          titre="Vue d'ensemble du périmètre"
          legende="Score sur 100, un axe par compétence travaillée"
        />
        <div className="px-4 py-5">
          <Radar axes={axes} />
          {sansPreuve.length > 0 && (
            <p className="mt-4 rounded-md border border-bordure bg-surface-2 px-3 py-2 text-[0.6875rem] text-texte-attenue">
              <strong className="font-medium">Lecture prudente.</strong>{" "}
              {sansPreuve.length} compétence(s) sont tracées à zéro faute de preuve, non parce
              qu&apos;une faiblesse a été mesurée :{" "}
              {sansPreuve.map((e) => e.skill.code).join(", ")}.
            </p>
          )}
        </div>
      </Carte>

      <Carte>
        <EnTeteCarte titre="Détail chiffré" legende="La même information, sans dépendre de la forme" />
        <ul className="divide-y divide-bordure">
          {etats.map((e) => (
            <li key={e.skill.code} className="flex items-center gap-3 px-4 py-2.5">
              <Link
                href={`/competences/${e.skill.code}`}
                className="min-w-0 flex-1 truncate text-sm hover:underline"
              >
                <CodeCompetence code={e.skill.code} /> {e.skill.intitule}
              </Link>
              <Statistique
                libelle=""
                valeur={e.score === null ? null : Math.round((e.score / 5) * 100)}
                unite="/100"
              />
              <span className="w-20 shrink-0 text-right text-[0.6875rem] text-texte-discret">
                {e.preuves.length} preuve{e.preuves.length > 1 ? "s" : ""}
              </span>
            </li>
          ))}
        </ul>
      </Carte>
    </div>
  );
}
