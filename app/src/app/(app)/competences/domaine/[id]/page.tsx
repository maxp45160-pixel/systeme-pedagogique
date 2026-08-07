import Link from "next/link";
import { notFound } from "next/navigation";
import { chargerContexte } from "@/lib/store/context";
import { retraitsParCode } from "@/lib/domain/referentiel-compte";
import { EntetePage } from "@/components/layout/entete-page";
import {
  Carte,
  EnTeteCarte,
  Statistique,
} from "@/components/ui/primitives";
import { Radar, RepartitionNiveaux } from "@/components/charts";
import { BoutonReviser } from "@/components/referentiel/bouton-reviser";
import { GestionDomaine } from "@/components/referentiel/gestion-domaine";
import { formatDateRelative } from "@/lib/engine/dates";
import { comparerCodes } from "@/lib/domain/referentiel-compte";

/**
 * Sous-page par domaine — stats agrégées + gestion complète (R5).
 *
 * La page /competences est épurée (grands champs sans détails).
 * Ici on voit les stats du domaine, le radar, ET la liste des
 * sous-compétences avec sélection multiple, édition, retrait, etc.
 */
export default async function PageDomaine(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const ctx = await chargerContexte();
  const domaineId = decodeURIComponent(id);
  const domaine = ctx.referentiel.domaines.find((d) => d.id === domaineId);
  if (!domaine) notFound();

  const etats = ctx.etats
    .filter((e) => e.skill.domaine === domaine.id)
    .sort((a, b) => comparerCodes(a.skill.code, b.skill.code));

  const skills = ctx.referentiel.skills.filter((s) => s.domaine === domaine.id);
  const retraits = Object.fromEntries(retraitsParCode(skills, ctx.donnees.evidence));
  const domainesExistants = ctx.referentiel.domaines.map((d) => ({
    id: d.id,
    nom: d.nom,
    prefixe: d.prefixe,
  }));

  // Agrégats
  const evaluees = etats.filter((e) => e.niveau !== null);
  const scoreMoyen =
    evaluees.length > 0
      ? evaluees.reduce((s, e) => s + (e.score ?? 0), 0) / evaluees.length
      : null;
  const totalPreuves = etats.reduce((s, e) => s + e.preuves.length, 0);
  const repartition: Record<number, number> = {};
  for (const e of etats) {
    if (e.niveau !== null) repartition[e.niveau] = (repartition[e.niveau] ?? 0) + 1;
  }
  const dernierePreuve = etats
    .map((e) => e.dernierePreuve)
    .filter(Boolean)
    .sort((a, b) => b!.localeCompare(a!))[0];

  // Axes pour le radar
  const axes = etats.map((e) => ({
    libelle: e.skill.code.replace(`${domaine.prefixe}-`, ""),
    valeur: e.score === null ? null : Math.round((e.score / 5) * 100),
  }));

  return (
    <>
      <div className="mb-3">
        <Link href="/competences" className="text-xs text-texte-attenue hover:text-texte">
          ← Toutes les compétences
        </Link>
      </div>

      <EntetePage
        titre={domaine.nom}
        sousTitre={domaine.description || `${etats.length} compétences · ${totalPreuves} preuves`}
        actions={
          /*
            « + Compétence » est devenu « Réviser avec le tuteur ».

            Le geste attendu ici n'était pas d'ajouter une ligne mais de
            reprendre la branche entière. Le chemin manuel n'est pas perdu : la
            modale de révision porte un lien qui monte l'ancienne
            `ModaleCompetence` avec le domaine pré-rempli. La surface ne grossit
            donc pas d'un bouton.
          */
          <BoutonReviser
            domaineId={domaine.id}
            domaineNom={domaine.nom}
            competences={skills
              .filter((s) => !s.archive)
              .map((s) => ({
                code: s.code,
                intitule: s.intitule,
                palier: s.palier,
                preuves: retraits[s.code]?.preuves ?? 0,
              }))}
            domainesExistants={domainesExistants}
            compteId={ctx.donnees.user.id}
          />
        }
      />

      <div className="space-y-4">
        {/* Stats agrégées */}
        <Carte>
          <EnTeteCarte
            titre="Vue d'ensemble du domaine"
            legende={`${etats.length} compétences · ${evaluees.length} évaluées · ${totalPreuves} preuves`}
          />
          <div className="flex flex-wrap gap-x-6 gap-y-3 px-4 py-3.5">
            <Statistique
              libelle="Score moyen"
              valeur={scoreMoyen === null ? null : scoreMoyen.toFixed(1).replace(".", ",")}
              unite="/ 5"
              precision={evaluees.length === 0 ? "aucune compétence évaluée" : `sur ${evaluees.length} compétence(s)`}
            />
            <Statistique
              libelle="Preuves"
              valeur={totalPreuves}
              precision={`${etats.filter((e) => e.contextesTestes.length > 0).length} compétence(s) avec contexte(s)`}
            />
            <Statistique
              libelle="Dernière activité"
              valeur={dernierePreuve ? formatDateRelative(dernierePreuve, ctx.now) : null}
              precision={dernierePreuve ? "dernière preuve enregistrée" : "jamais"}
            />
          </div>
          {Object.keys(repartition).length > 0 && (
            <div className="border-t border-bordure px-4 py-3">
              <div className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
                Répartition des niveaux
              </div>
              <div className="max-w-md">
                <RepartitionNiveaux compte={repartition} />
              </div>
            </div>
          )}
        </Carte>

        {/* Radar du domaine */}
        {axes.length > 0 && (
          <Carte>
            <EnTeteCarte
              titre="Radar du domaine"
              legende="Score sur 100, un axe par compétence"
            />
            <div className="px-4 py-3.5">
              <Radar axes={axes} />
              {etats.some((e) => e.score === null) && (
                <p className="mt-3 text-[0.6875rem] text-texte-attenue">
                  Les compétences sans preuve sont tracées à zéro — ce n{"'"}est pas
                  une faiblesse mesurée.
                </p>
              )}
            </div>
          </Carte>
        )}

        {/* Gestion des sous-compétences */}
        <GestionDomaine
          domaine={domaine}
          skills={skills}
          retraits={retraits}
        />
      </div>
    </>
  );
}