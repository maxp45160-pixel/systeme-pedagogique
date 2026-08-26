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

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cx } from "@/components/ui/primitives";
import type { VueAClasserAtelier, VueDomaineAtelier } from "@/lib/documents/vue-atelier";
import { usageDuDomaine, repartirDomainesParUsage } from "@/lib/domain/usage-domaine";
import { useIntention } from "@/components/intention/contexte-intention";
import type { GrapheDomaines } from "@/lib/domain/graphe-domaines";
import { RappelNouveauBesoin } from "@/components/intention/bouton-intention";
import {
  BoutonRestaurationCarte,
  BoutonSuppressionCarte,
  ModaleConfirmationSuppression,
} from "../modale-confirmation-suppression";
import { archiverDomaine, restaurerDomaine } from "@/lib/store/referentiel-actions";
import { formatDateRelative } from "@/lib/engine/dates";
import { filtrerEtTrierDomaines, type TriDomaine } from "@/lib/documents/tri-domaines";
import { CarteCreationPointillee, type VueAtelier } from "../vues-synthese-atelier";

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
  compteId,
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
  compteId?: string;
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
          <div className="mb-6 rounded-xl border border-dashed border-bordure bg-surface/40 px-6 py-5 text-center">
            <RappelNouveauBesoin />
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
                  {compteId && (
                    <CarteCreationPointillee
                      titre="Déclarer un besoin"
                      description="Choisir un module académique ou une progression continue"
                      onClick={() => ouvrir()}
                    />
                  )}
                </div>
              </section>
            )}

            {aClasser.length > 0 && (
              <section>
                <div className="mb-3 flex flex-wrap items-baseline gap-2">
                  <h3 className="font-serif text-base font-semibold text-texte">À classer</h3>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[0.625rem] font-semibold text-texte-discret">
                    {aClasser.length}
                  </span>
                  <p className="text-xs text-texte-discret">
                    Au référentiel, mais dans aucun domaine. Ouvrez-en une pour dire où elle sert.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {aClasser.map((competence) => (
                    <button
                      key={competence.code}
                      type="button"
                      onClick={() => ouvrirElement(competence.code)}
                      className="flex h-full w-full flex-col justify-between rounded-xl border border-dashed border-bordure bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primaire/40 cursor-pointer"
                    >
                      <div>
                        <span className="chiffres rounded-md bg-surface-2 px-2 py-0.5 text-[0.625rem] text-texte-discret">
                          {competence.code}
                        </span>
                        <p className="mt-2 text-sm font-semibold leading-snug text-texte">
                          {competence.titre}
                        </p>
                      </div>
                      <p className="mt-3 text-[0.6875rem] text-texte-discret">
                        Code créé dans {competence.domaineCreationNom} ·{" "}
                        {competence.nombreObservations} trace
                        {competence.nombreObservations > 1 ? "s" : ""} de travail
                      </p>
                    </button>
                  ))}
                </div>
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
            onSupprimer?.(id);
            setDomaineASupprimer(null);
            await archiverDomaine(id);
            router.refresh();
          }}
          onFermer={() => setDomaineASupprimer(null)}
        />
      )}
    </div>
  );
}
