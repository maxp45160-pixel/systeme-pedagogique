"use client";

/**
 * La page des domaines — **la seule**.
 *
 * Il y en avait deux : cette liste, et une carte des domaines logée dans la vue
 * Graphe. Deux entrées pour la même chose, avec les mêmes noms : la redite
 * exacte que le retrait de l'onglet « Transversal » avait déjà corrigée
 * ailleurs. La carte est retirée ; ce qu'elle apportait vraiment — quels
 * domaines se parlent, lesquels sont travaillés en ce moment — est descendu
 * ici, là où on regardait déjà.
 *
 * Les sections suivent l'usage déclaré du domaine : module académique actif
 * (regroupé par année/période), module clôturé, progression continue ou usage
 * encore à préciser. Aucun domaine ne disparaît — il change de section. La
 * frontière n'est jamais déduite de l'activité, du nom ou de ses documents.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BandeauInfo, Bouton, cx } from "@/components/ui/primitives";
import type { VueAClasserAtelier, VueDomaineAtelier } from "@/lib/documents/vue-atelier";
import { usageDuDomaine, repartirDomainesParUsage } from "@/lib/domain/usage-domaine";
import { useIntention } from "@/components/intention/contexte-intention";
import type { GrapheDomaines } from "@/lib/domain/graphe-domaines";
import { IconeAmpoule, IconeCours } from "@/components/ui/icones";
import {
  BoutonRestaurationCarte,
  BoutonSuppressionCarte,
  ModaleConfirmationSuppression,
} from "../modale-confirmation-suppression";
import {
  archiverDomaine,
  restaurerDomaine,
  supprimerDomaineArchive,
  taguerCompetences,
} from "@/lib/store/referentiel-actions";
import { formatDateRelative } from "@/lib/engine/dates";
import { filtrerEtTrierDomaines, type TriDomaine } from "@/lib/documents/tri-domaines";
import type { VueAtelier } from "../vues-synthese-atelier";

/**
 * Une carte de domaine.
 *
 * Extraite du corps de la vue : le même dessin sert aux deux sections. Deux
 * copies auraient divergé au premier ajustement.
 */
function CarteDomaine({
  domaine,
  estArchives,
  actif,
  voisins,
  ouvrirElement,
  onArchiverDemande,
  onRestaurerDemande,
  onSupprimerDemande,
}: {
  domaine: VueDomaineAtelier;
  estArchives: boolean;
  actif: boolean;
  /** Domaines reliés par un fait déclaré, déjà nommés. Vide = isolé, et c'est dit. */
  voisins: string[];
  ouvrirElement: (id: string) => void;
  onArchiverDemande: () => void;
  onRestaurerDemande: () => void;
  onSupprimerDemande: () => void;
}) {
  const total = domaine.competences.length;
  const evaluees = domaine.nombreEvaluees;
  const ratio = total > 0 ? Math.round((evaluees / total) * 100) : 0;
  const usage = usageDuDomaine(domaine.domaine);
  const libelleCadre =
    usage.type === "module"
      ? usage.module.closLe
        ? "Module clôturé"
        : "Module académique"
      : usage.type === "continu"
        ? "Progression continue"
        : "À préciser";

  return (
    <div className="group relative flex h-full flex-col">
      <button
        type="button"
        onClick={() => ouvrirElement(`domaine:${domaine.id}`)}
        className={cx(
          "flex w-full flex-1 flex-col justify-between rounded-xl border bg-surface p-5 text-left shadow-[var(--ombre-posee)] transition-all duration-200 hover:-translate-y-1 hover:border-primaire/40 hover:shadow-[var(--ombre-levee)] cursor-pointer",
          actif && !estArchives ? "border-primaire/40" : "border-bordure",
          estArchives && "opacity-90 hover:opacity-100",
        )}
      >
        <div>
          <div className="flex items-center justify-between gap-3 pr-16">
            <span
              className={cx(
                "rounded-md px-2.5 py-1 text-xs font-semibold",
                estArchives
                  ? "bg-surface-3 text-texte-discret"
                  : actif
                    ? "bg-primaire-faible text-primaire"
                    : "bg-surface-2 text-texte-discret",
              )}
            >
              {estArchives ? "Domaine mis de côté" : libelleCadre}
            </span>
            {/* Ce que ce domaine tague, ses sous-domaines non compris (24/08/2026). */}
            <span className="chiffres text-xs text-texte-discret">
              {total} compétence{total > 1 ? "s" : ""}
            </span>
          </div>
          <h3 className="mt-3 font-serif text-lg font-medium leading-snug text-texte group-hover:text-primaire">
            {domaine.nom}
          </h3>
          {domaine.description && (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-texte-attenue">
              {domaine.description}
            </p>
          )}
          {domaine.rattachementCarte && !domaine.rattachementCarte.obsolete && (
            <p className="mt-2 text-[0.625rem] text-texte-discret">
              {domaine.rattachementCarte.chemin.map((etape) => etape.nom).join(" › ")}
            </p>
          )}
        </div>

        <div className="mt-5 space-y-2 border-t border-bordure pt-3">
          <div className="flex items-center justify-between text-xs text-texte-discret">
            <span>Couverture</span>
            <span className="chiffres font-medium text-texte">
              {ratio}% ({evaluees}/{total})
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className={cx(
                "h-full rounded-full transition-all duration-300",
                estArchives ? "bg-texte-discret" : "bg-primaire",
              )}
              style={{ width: `${ratio}%` }}
            />
          </div>
          <div className="flex items-center justify-between pt-0.5 text-[11px] text-texte-discret">
            <span>Dernière activité</span>
            <span className="chiffres font-medium text-texte-attenue">
              {domaine.derniereActivite ? formatDateRelative(domaine.derniereActivite) : "Aucune"}
            </span>
          </div>
          {!estArchives && (
            <p className="pt-0.5 text-[11px] leading-relaxed text-texte-discret">
              {voisins.length === 0
                ? "Aucun lien déclaré avec un autre domaine"
                : `Relié à ${voisins.join(", ")}`}
            </p>
          )}
        </div>
      </button>

      {estArchives ? (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
          <BoutonRestaurationCarte
            titre="Reprendre ce domaine"
            className="static opacity-0 group-hover:opacity-80 hover:!opacity-100"
            onClick={onRestaurerDemande}
          />
          <BoutonSuppressionCarte
            titre="Supprimer définitivement ce domaine"
            className="static opacity-0 group-hover:opacity-80 hover:!opacity-100"
            onClick={onSupprimerDemande}
          />
        </div>
      ) : (
        <BoutonSuppressionCarte titre="Mettre ce domaine de côté" onClick={onArchiverDemande} />
      )}
    </div>
  );
}

export function VueTousLesDomaines({
  domaines,
  grapheDomaines,
  ouvrirElement,
  selection,
  aClasser = [],
  tri = "recent",
  onArchiver,
  onRestaurer,
  onSupprimer,
}: {
  domaines: VueDomaineAtelier[];
  /** Ce qui relie les domaines et ce qui les dit actifs. Dérivé, jamais stocké. */
  grapheDomaines: GrapheDomaines;
  ouvrirElement: (id: string) => void;
  changerVue: (vue: VueAtelier) => void;
  selection?: string | null;
  /** Les compétences qu'aucun domaine ne montre (ADR-107). */
  aClasser?: VueAClasserAtelier[];
  tri?: TriDomaine;
  onArchiver?: (domaineId: string) => void;
  onRestaurer?: (domaineId: string) => void;
  onSupprimer?: (domaineId: string) => void;
}) {
  const router = useRouter();
  const { ouvrir } = useIntention();
  const [domaineAArchiver, setDomaineAArchiver] = useState<VueDomaineAtelier | null>(null);
  const [domaineARestaurer, setDomaineARestaurer] = useState<VueDomaineAtelier | null>(null);
  const [domaineASupprimer, setDomaineASupprimer] = useState<VueDomaineAtelier | null>(null);
  const [selectionClassement, setSelectionClassement] = useState<Record<string, boolean>>({});
  const [classesLocalement, setClassesLocalement] = useState<Set<string>>(() => new Set());
  const [dernierClassement, setDernierClassement] = useState<
    { domaineId: string; domaineNom: string; codes: string[] }[]
  >([]);
  const [classementEnCours, demarrerClassement] = useTransition();
  const [erreurClassement, setErreurClassement] = useState<string | null>(null);

  const estArchives = selection === "domaines-archives";

  const domainesAffiches = useMemo(
    () => filtrerEtTrierDomaines(domaines, { tri }),
    [domaines, tri],
  );

  const domainesParUsage = useMemo(() => {
    const parId = new Map(domainesAffiches.map((domaine) => [domaine.id, domaine]));
    const repartition = repartirDomainesParUsage(domainesAffiches.map((domaine) => domaine.domaine));
    const projeter = (domainesDuGroupe: readonly { id: string }[]) =>
      domainesDuGroupe
        .map(({ id }) => parId.get(id))
        .filter((domaine): domaine is VueDomaineAtelier => Boolean(domaine));

    return {
      modulesActifs: projeter(repartition.modulesActifs),
      modulesClos: projeter(repartition.modulesClos),
      continues: projeter(repartition.continues),
      aPreciser: projeter(repartition.aPreciser),
    };
  }, [domainesAffiches]);

  const groupesModules = useMemo(() => {
    const groupes = new Map<string, VueDomaineAtelier[]>();
    for (const domaine of domainesParUsage.modulesActifs) {
      const usage = usageDuDomaine(domaine.domaine);
      if (usage.type !== "module") continue;
      const cle = `${usage.module.anneeAcademique}\u0000${usage.module.periode ?? ""}`;
      const liste = groupes.get(cle) ?? [];
      liste.push(domaine);
      groupes.set(cle, liste);
    }
    return [...groupes.entries()].map(([cle, valeurs]) => {
      const [anneeAcademique, periode] = cle.split("\u0000");
      return { anneeAcademique, periode, domaines: valeurs };
    });
  }, [domainesParUsage.modulesActifs]);

  const competencesRestantes = useMemo(
    () => aClasser.filter((competence) => !classesLocalement.has(competence.code)),
    [aClasser, classesLocalement],
  );

  const propositionsClassement = useMemo(
    () => competencesRestantes.filter((competence) => competence.proposition),
    [competencesRestantes],
  );

  const groupesClassement = useMemo(() => {
    const groupes = new Map<
      string,
      { domaineId: string; domaineNom: string; justification: string; competences: VueAClasserAtelier[] }
    >();
    for (const competence of propositionsClassement) {
      const proposition = competence.proposition;
      if (!proposition) continue;
      const groupe = groupes.get(proposition.domaineId) ?? {
        domaineId: proposition.domaineId,
        domaineNom: proposition.domaineNom,
        justification: proposition.justification,
        competences: [],
      };
      groupe.competences.push(competence);
      groupes.set(proposition.domaineId, groupe);
    }
    return [...groupes.values()].sort((a, b) => a.domaineNom.localeCompare(b.domaineNom, "fr"));
  }, [propositionsClassement]);

  const classementsSelectionnes = groupesClassement.flatMap((groupe) =>
    groupe.competences
      .filter((competence) => selectionClassement[competence.code] ?? true)
      .map((competence) => competence.code),
  );

  function erreurLisible(cause: unknown): string {
    const message = cause instanceof Error ? cause.message : "";
    if (/version|concurr|modifi/i.test(message)) {
      return "Le référentiel a changé entre-temps. Rechargez la page pour relire les propositions.";
    }
    if (/inconnu|introuvable|autor|permission|session/i.test(message)) {
      return "Ce classement n’est plus disponible. Rechargez la page pour relire votre référentiel.";
    }
    return "Les classements n’ont pas pu être confirmés. Vous pouvez réessayer sans perdre votre sélection.";
  }

  function confirmerClassements() {
    if (classementsSelectionnes.length === 0) {
      setErreurClassement("Sélectionnez au moins une compétence à classer.");
      return;
    }
    setErreurClassement(null);
    demarrerClassement(async () => {
      const parDomaine = new Map<string, string[]>();
      for (const competence of groupesClassement.flatMap((groupe) => groupe.competences)) {
        if (!(selectionClassement[competence.code] ?? true) || !competence.proposition) continue;
        const codes = parDomaine.get(competence.proposition.domaineId) ?? [];
        codes.push(competence.code);
        parDomaine.set(competence.proposition.domaineId, codes);
      }

      const reussis: { domaineId: string; domaineNom: string; codes: string[] }[] = [];
      try {
        for (const groupe of groupesClassement) {
          const codes = parDomaine.get(groupe.domaineId) ?? [];
          if (codes.length === 0) continue;
          await taguerCompetences(groupe.domaineId, codes, true);
          reussis.push({ domaineId: groupe.domaineId, domaineNom: groupe.domaineNom, codes });
        }
        setClassesLocalement((precedents) => new Set([...precedents, ...reussis.flatMap(({ codes }) => codes)]));
        setDernierClassement(reussis);
      } catch (cause) {
        setClassesLocalement((precedents) => new Set([...precedents, ...reussis.flatMap(({ codes }) => codes)]));
        setDernierClassement(reussis);
        setErreurClassement(
          reussis.length > 0
            ? `${reussis.flatMap(({ codes }) => codes).length} classement${reussis.flatMap(({ codes }) => codes).length > 1 ? "s" : ""} confirmé${reussis.flatMap(({ codes }) => codes).length > 1 ? "s" : ""}. ${erreurLisible(cause)}`
            : erreurLisible(cause),
        );
      }
    });
  }

  function annulerDerniersClassements() {
    if (dernierClassement.length === 0) return;
    setErreurClassement(null);
    demarrerClassement(async () => {
      const restants: typeof dernierClassement = [];
      try {
        for (const groupe of dernierClassement) {
          try {
            await taguerCompetences(groupe.domaineId, groupe.codes, false);
          } catch (cause) {
            restants.push(groupe);
            throw cause;
          }
        }
        setDernierClassement([]);
        setClassesLocalement(new Set());
        router.refresh();
      } catch (cause) {
        setDernierClassement(restants);
        setClassesLocalement((precedents) => {
          const aGarder = new Set(restants.flatMap(({ codes }) => codes));
          return new Set([...precedents].filter((code) => aGarder.has(code)));
        });
        setErreurClassement(`L’annulation n’a été que partielle. ${erreurLisible(cause)}`);
      }
    });
  }

  /** Voisins déclarés de chaque domaine, nommés une fois pour toutes. */
  const voisinsParDomaine = useMemo(() => {
    const noms = new Map(grapheDomaines.noeuds.map((noeud) => [noeud.id, noeud.nom]));
    const voisins = new Map<string, Set<string>>();
    for (const lien of grapheDomaines.liens) {
      for (const [de, vers] of [
        [lien.source, lien.target],
        [lien.target, lien.source],
      ]) {
        const nom = noms.get(vers);
        if (!nom) continue;
        const liste = voisins.get(de) ?? new Set<string>();
        liste.add(nom);
        voisins.set(de, liste);
      }
    }
    return voisins;
  }, [grapheDomaines]);

  const carte = (domaine: VueDomaineAtelier) => (
    <CarteDomaine
      key={domaine.id}
      domaine={domaine}
      estArchives={estArchives}
      actif={grapheDomaines.noeuds.some((noeud) => noeud.id === domaine.id && noeud.actif)}
      voisins={[...(voisinsParDomaine.get(domaine.id) ?? [])].sort((a, b) =>
        a.localeCompare(b, "fr"),
      )}
      ouvrirElement={ouvrirElement}
      onArchiverDemande={() => setDomaineAArchiver(domaine)}
      onRestaurerDemande={() => setDomaineARestaurer(domaine)}
      onSupprimerDemande={() => setDomaineASupprimer(domaine)}
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-surface-2/30">
      <div className="p-5 sm:p-6 lg:p-8">
        {estArchives && domainesAffiches.length > 0 && (
          <div className="mb-6 rounded-xl border border-bordure bg-surface p-4 text-xs text-texte-attenue shadow-xs">
            <p className="font-semibold text-texte">Domaines mis de côté</p>
            <p className="mt-1 leading-relaxed text-texte-discret">
              Ces domaines et leurs compétences ne proposent plus de travail. Toutes les traces
              conservées restent intactes. Vous pouvez reprendre un domaine, ou le supprimer s’il ne
              porte aucun historique.
            </p>
          </div>
        )}

        {!estArchives && domainesAffiches.length === 0 && (
          <div className="mb-6 rounded-xl border border-dashed border-bordure bg-surface/40 px-6 py-7 text-center">
            <p className="font-serif text-base font-semibold text-texte">Ajoutez votre premier domaine</p>
            <p className="mx-auto mt-1 max-w-xl text-xs leading-relaxed text-texte-discret">
              Choisissez le cadre qui correspond à ce que vous voulez organiser. Vous pourrez le compléter ensuite.
            </p>
            <div className="mx-auto mt-5 grid max-w-2xl gap-3 text-left sm:grid-cols-2">
              <button
                type="button"
                onClick={() => ouvrir({ usageDomaine: "module" })}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-bordure bg-surface p-4 transition-colors hover:border-primaire/40 hover:bg-primaire-faible/40"
              >
                <IconeCours className="mt-0.5 size-4 shrink-0 text-primaire" />
                <span>
                  <span className="block text-sm font-semibold text-texte">Un module de cours</span>
                  <span className="mt-1 block text-xs leading-relaxed text-texte-discret">
                    Un enseignement suivi pendant une année ou un semestre.
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => ouvrir({ usageDomaine: "continu" })}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-bordure bg-surface p-4 transition-colors hover:border-primaire/40 hover:bg-primaire-faible/40"
              >
                <IconeAmpoule className="mt-0.5 size-4 shrink-0 text-primaire" />
                <span>
                  <span className="block text-sm font-semibold text-texte">Un domaine à long terme</span>
                  <span className="mt-1 block text-xs leading-relaxed text-texte-discret">
                    Un sujet que vous développez au-delà d’un cours.
                  </span>
                </span>
              </button>
            </div>
          </div>
        )}

        {estArchives ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {domainesAffiches.map(carte)}
            {domainesAffiches.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-bordure bg-surface/40 p-8 text-center">
                <p className="font-serif text-sm font-semibold text-texte">
                  Aucun domaine mis de côté
                </p>
                <p className="mt-1 text-xs text-texte-discret">
                  Tous vos domaines proposent encore du travail.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-10">
            {domainesParUsage.modulesActifs.length > 0 && (
              <section>
                <div className="mb-3 flex flex-wrap items-baseline gap-2">
                  <h3 className="font-serif text-base font-semibold text-texte">Modules académiques</h3>
                  <span className="rounded-full bg-primaire-faible px-2 py-0.5 text-[0.625rem] font-semibold text-primaire">
                    {domainesParUsage.modulesActifs.length}
                  </span>
                  <p className="text-xs text-texte-discret">Vos cours actifs, regroupés par année et période.</p>
                </div>
                <div className="space-y-6">
                  {groupesModules.map((groupe) => (
                    <div key={`${groupe.anneeAcademique}-${groupe.periode}`}>
                      <h4 className="mb-2 text-xs font-semibold text-texte-attenue">
                        {groupe.anneeAcademique}{groupe.periode ? ` · ${groupe.periode}` : ""}
                      </h4>
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {groupe.domaines.map(carte)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {domainesParUsage.modulesClos.length > 0 && (
              <section>
                <div className="mb-3 flex flex-wrap items-baseline gap-2">
                  <h3 className="font-serif text-base font-semibold text-texte">Modules clôturés</h3>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[0.625rem] font-semibold text-texte-discret">
                    {domainesParUsage.modulesClos.length}
                  </span>
                  <p className="text-xs text-texte-discret">Leur historique reste consultable.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {domainesParUsage.modulesClos.map(carte)}
                </div>
              </section>
            )}

            {domainesParUsage.continues.length > 0 && (
              <section>
                <div className="mb-3 flex flex-wrap items-baseline gap-2">
                  <h3 className="font-serif text-base font-semibold text-texte">Progression continue</h3>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[0.625rem] font-semibold text-texte-discret">
                    {domainesParUsage.continues.length}
                  </span>
                  <p className="text-xs text-texte-discret">Les domaines travaillés dans la durée, hors cours.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {domainesParUsage.continues.map(carte)}
                </div>
              </section>
            )}

            {domainesParUsage.aPreciser.length > 0 && (
              <section>
                <div className="mb-3 flex flex-wrap items-baseline gap-2">
                  <h3 className="font-serif text-base font-semibold text-texte">À préciser</h3>
                  {domainesParUsage.aPreciser.length > 0 && (
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[0.625rem] font-semibold text-texte-discret">
                      {domainesParUsage.aPreciser.length}
                    </span>
                  )}
                  <p className="text-xs text-texte-discret">
                    Ces domaines restent disponibles jusqu&apos;à ce que vous déclariez leur cadre.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {domainesParUsage.aPreciser.map(carte)}
                </div>
              </section>
            )}

            {(competencesRestantes.length > 0 || dernierClassement.length > 0 || erreurClassement) && (
              <section>
                {competencesRestantes.length > 0 && (
                  <div className="mb-3 flex flex-wrap items-baseline gap-2">
                    <h3 className="font-serif text-base font-semibold text-texte">À classer</h3>
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[0.625rem] font-semibold text-texte-discret">
                      {competencesRestantes.length}
                    </span>
                    <p className="text-xs text-texte-discret">
                      Des compétences encore absentes de vos domaines. Une proposition peut vous aider à les regrouper.
                    </p>
                  </div>
                )}

                {groupesClassement.length > 0 && (
                  <div className="rounded-xl border border-bordure bg-surface p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-texte">Proposition de classement</p>
                        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-texte-attenue">
                          Le domaine de création sert uniquement de point de départ. Vérifiez les choix : aucune donnée ne change avant confirmation.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Bouton
                          variante="discret"
                          taille="petite"
                          onClick={() =>
                            setSelectionClassement((precedente) => ({
                              ...precedente,
                              ...Object.fromEntries(
                                propositionsClassement.map((competence) => [competence.code, true]),
                              ),
                            }))
                          }
                        >
                          Tout sélectionner
                        </Bouton>
                        <Bouton
                          variante="discret"
                          taille="petite"
                          onClick={() =>
                            setSelectionClassement((precedente) => ({
                              ...precedente,
                              ...Object.fromEntries(
                                propositionsClassement.map((competence) => [competence.code, false]),
                              ),
                            }))
                          }
                        >
                          Tout désélectionner
                        </Bouton>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {groupesClassement.map((groupe) => (
                        <fieldset key={groupe.domaineId} className="rounded-lg border border-bordure/80 bg-surface-2/40 p-3">
                          <legend className="px-1 text-xs font-semibold text-texte">{groupe.domaineNom}</legend>
                          <p className="mt-1 text-[0.6875rem] leading-relaxed text-texte-discret">
                            {groupe.justification}
                          </p>
                          <div className="mt-2 grid gap-1 sm:grid-cols-2">
                            {groupe.competences.map((competence) => {
                              const cochee = selectionClassement[competence.code] ?? true;
                              return (
                                <label
                                  key={competence.code}
                                  className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm text-texte hover:bg-surface"
                                >
                                  <input
                                    type="checkbox"
                                    checked={cochee}
                                    onChange={() =>
                                      setSelectionClassement((precedente) => ({
                                        ...precedente,
                                        [competence.code]: !cochee,
                                      }))
                                    }
                                    className="mt-0.5 size-4 rounded border-bordure accent-primaire"
                                  />
                                  <span>{competence.titre}</span>
                                </label>
                              );
                            })}
                          </div>
                        </fieldset>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-bordure pt-3">
                      <p className="text-xs text-texte-discret">
                        {classementsSelectionnes.length} sélectionnée{classementsSelectionnes.length > 1 ? "s" : ""}
                      </p>
                      <Bouton
                        variante="principal"
                        taille="petite"
                        enChargement={classementEnCours}
                        onClick={confirmerClassements}
                      >
                        Confirmer les classements sélectionnés
                      </Bouton>
                    </div>
                  </div>
                )}

                {dernierClassement.length > 0 && (
                  <BandeauInfo ton="succes" taille="compacte" className="mt-3 justify-between">
                    <span>
                      {dernierClassement.flatMap(({ codes }) => codes).length} classement{dernierClassement.flatMap(({ codes }) => codes).length > 1 ? "s" : ""} confirmé{dernierClassement.flatMap(({ codes }) => codes).length > 1 ? "s" : ""}.
                    </span>
                    <Bouton
                      variante="discret"
                      taille="petite"
                      enChargement={classementEnCours}
                      onClick={annulerDerniersClassements}
                    >
                      Annuler ces classements
                    </Bouton>
                  </BandeauInfo>
                )}

                {erreurClassement && (
                  <BandeauInfo ton="danger" taille="compacte" className="mt-3">
                    {erreurClassement}
                  </BandeauInfo>
                )}

                {competencesRestantes.some((competence) => !competence.proposition) && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {competencesRestantes
                      .filter((competence) => !competence.proposition)
                      .map((competence) => (
                        <button
                          key={competence.code}
                          type="button"
                          onClick={() => ouvrirElement(competence.code)}
                          className="flex h-full w-full flex-col justify-between rounded-xl border border-dashed border-bordure bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primaire/40 cursor-pointer"
                        >
                          <div>
                            <p className="text-sm font-semibold leading-snug text-texte">
                              {competence.titre}
                            </p>
                          </div>
                          <p className="mt-3 text-[0.6875rem] text-texte-discret">
                            Aucun domaine actif ne peut être proposé automatiquement. Ouvrez cette compétence pour choisir.
                          </p>
                        </button>
                      ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>

      {domaineAArchiver && (
        <ModaleConfirmationSuppression
          titre="Mettre le domaine de côté"
          nomElement={domaineAArchiver.nom}
          typeElement="domaine"
          mode="archivage"
          explication="Ce domaine et ses compétences ne proposeront plus de travail. Toutes les traces et l'historique restent fidèlement conservés."
          texteBoutonConfirmer="Confirmer"
          onConfirmer={async () => {
            const id = domaineAArchiver.id;
            onArchiver?.(id);
            setDomaineAArchiver(null);
            await archiverDomaine(id);
            router.refresh();
          }}
          onFermer={() => setDomaineAArchiver(null)}
        />
      )}

      {domaineARestaurer && (
        <ModaleConfirmationSuppression
          titre="Reprendre le domaine"
          nomElement={domaineARestaurer.nom}
          typeElement="domaine"
          mode="restauration"
          explication="Ce domaine et ses compétences associées seront remis dans votre référentiel actif."
          texteBoutonConfirmer="Reprendre"
          onConfirmer={async () => {
            const id = domaineARestaurer.id;
            onRestaurer?.(id);
            setDomaineARestaurer(null);
            await restaurerDomaine(id);
            router.refresh();
          }}
          onFermer={() => setDomaineARestaurer(null)}
        />
      )}

      {domaineASupprimer && (
        <ModaleConfirmationSuppression
          titre="Supprimer définitivement le domaine"
          nomElement={domaineASupprimer.nom}
          typeElement="domaine"
          mode="suppression"
          explication="Cette action supprimera définitivement le domaine et ses compétences du compte. Si un historique ou des dépendances existent, ils seront protégés par les règles du référentiel."
          texteBoutonConfirmer="Supprimer définitivement"
          onConfirmer={async () => {
            const id = domaineASupprimer.id;
            const resultat = await supprimerDomaineArchive(id);
            if (!resultat.ok) throw new Error(resultat.erreur);
            onSupprimer?.(id);
            router.refresh();
          }}
          onFermer={() => setDomaineASupprimer(null)}
        />
      )}
    </div>
  );
}
