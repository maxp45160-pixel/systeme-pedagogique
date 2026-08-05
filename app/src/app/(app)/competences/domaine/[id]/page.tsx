import Link from "next/link";
import { notFound } from "next/navigation";
import { chargerContexte } from "@/lib/store/context";
import { EntetePage } from "@/components/layout/entete-page";
import {
  Carte,
  CodeCompetence,
  cx,
  EnTeteCarte,
  EtatVide,
  JaugeNiveau,
  Statistique,
} from "@/components/ui/primitives";
import { Radar, RepartitionNiveaux } from "@/components/charts";
import { BoutonAjouterCompetence } from "@/components/referentiel/bouton-ajouter";
import { formatDateRelative } from "@/lib/engine/dates";
import { comparerCodes } from "@/lib/domain/referentiel-compte";

/**
 * Sous-page par domaine — stats agrégées sur la compétence globale (Chantier 9).
 *
 * Montre le score moyen, la répartition des niveaux, le nombre de preuves,
 * la dernière activité, et la liste des compétences du domaine avec leurs
 * niveaux individuels.
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
  const niveauMoyen =
    evaluees.length > 0
      ? evaluees.reduce((s, e) => s + (e.niveau ?? 0), 0) / evaluees.length
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
          <BoutonAjouterCompetence
            domainesExistants={domainesExistants}
            compteId={ctx.donnees.user.id}
            domaineInitial={domaine.nom}
            libelle="+ Compétence"
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
              libelle="Niveau moyen"
              valeur={niveauMoyen === null ? null : niveauMoyen.toFixed(1).replace(".", ",")}
              unite="/ 5"
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

          {/* Répartition des niveaux */}
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
                  Les compétences sans preuve sont tracées à zéro — ce n&apos;est pas une
                  faiblesse mesurée.
                </p>
              )}
            </div>
          </Carte>
        )}

        {/* Liste des compétences */}
        <Carte>
          <EnTeteCarte
            titre="Compétences du domaine"
            legende={`${etats.length} compétence(s)`}
          />
          {etats.length === 0 ? (
            <EtatVide
              titre="Aucune compétence"
              message="Ce domaine n'a pas encore de compétences. Ajoute-en une pour commencer."
            />
          ) : (
            <ul className="divide-y divide-bordure">
              {etats.map((e) => (
                <li key={e.skill.code}>
                  <Link
                    href={`/competences/${e.skill.code}`}
                    className="flex w-full items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-2"
                  >
                    <div className="w-16 shrink-0">
                      <CodeCompetence code={e.skill.code} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{e.skill.intitule}</p>
                      <p className="mt-0.5 text-[0.6875rem] text-texte-discret">
                        {e.statut === "non-evalue" && "Jamais évaluée"}
                        {e.statut === "hypothese" && "Hypothèse — non vérifiée"}
                        {e.statut === "evalue" &&
                          `${e.preuves.length} preuve${e.preuves.length > 1 ? "s" : ""} · ${e.contextesTestes.length} contexte${e.contextesTestes.length > 1 ? "s" : ""}${
                            e.dernierePreuve ? ` · ${formatDateRelative(e.dernierePreuve)}` : ""
                          }`}
                      </p>
                    </div>
                    <div className="hidden w-24 shrink-0 sm:block">
                      <JaugeNiveau niveau={e.niveau} />
                    </div>
                    <div className="chiffres w-14 shrink-0 text-right">
                      <span
                        className={cx(
                          "text-sm font-semibold",
                          e.niveau === null && "text-texte-discret",
                        )}
                      >
                        {e.niveau ?? "—"}
                      </span>
                      <span className="text-[0.6875rem] text-texte-discret">/5</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>
    </>
  );
}