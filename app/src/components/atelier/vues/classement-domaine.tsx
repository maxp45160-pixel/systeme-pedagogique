"use client";

/**
 * Où ce domaine se range.
 *
 * Ce n'est pas un état civil, c'est un tiroir. Le classement sert à relier les
 * domaines entre eux — et, plus tard, à distinguer un sous-domaine d'un
 * sur-domaine sans que personne ait à le déclarer à la main. Un domaine non
 * classé est un état normal : l'écran ne le réclame pas.
 *
 * La première version affichait un pavé — titre solennel, version de carte,
 * source, trois facteurs par candidat. Tout y était vrai et rien n'y servait
 * le geste, qui tient en un clic. Ce qui justifie un candidat reste lisible au
 * survol, parce qu'un rapprochement sans motif ne s'arbitre pas ; le reste est
 * parti.
 *
 * Le geste reste humain. Aucun classement ne s'écrit sans un clic.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PropositionClassification } from "@/lib/engine/classification-domaine";
import {
  cheminCarte,
  noeudsRattachables,
  type RattachementCarte,
} from "@/lib/domain/carte-savoirs";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";
import {
  detacherDomaineDeCarte,
  rattacherDomaineACarte,
} from "@/lib/store/referentiel-actions";
import { cx } from "@/components/ui/primitives";

/** « Créations humaines › Informatique » — la racine ne dit rien, elle saute. */
function cheminCourt(noeudId: string): string {
  return cheminCarte(noeudId)
    .slice(1)
    .map((etape) => etape.nom)
    .join(" › ");
}

export function ClassementDomaine({
  domaineId,
  compteId,
  rattachement,
  classification,
  modifiable,
}: {
  domaineId: string;
  compteId: string;
  rattachement: RattachementCarte | null;
  classification: PropositionClassification | null;
  /** Faux sur un domaine mis de côté : on ne classe pas ce qui ne sert plus. */
  modifiable: boolean;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [listeOuverte, setListeOuverte] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [tuteurEnCours, setTuteurEnCours] = useState(false);
  const [propositionTuteur, setPropositionTuteur] = useState<{
    noeud: string;
    justification: string;
  } | null>(null);

  const tousLesNoeuds = useMemo(
    () =>
      noeudsRattachables()
        .map((noeud) => ({ id: noeud.id, chemin: cheminCourt(noeud.id) }))
        .sort((a, b) => a.chemin.localeCompare(b.chemin, "fr")),
    [],
  );

  function rattacher(noeud: string, origine: "tuteur" | "manuel") {
    setErreur(null);
    demarrer(async () => {
      try {
        await rattacherDomaineACarte(domaineId, noeud, origine);
        setListeOuverte(false);
        setPropositionTuteur(null);
        router.refresh();
      } catch (cause) {
        setErreur(cause instanceof Error ? cause.message : "Le classement n’a pas abouti.");
      }
    });
  }

  function detacher() {
    setErreur(null);
    demarrer(async () => {
      try {
        await detacherDomaineDeCarte(domaineId);
        router.refresh();
      } catch (cause) {
        setErreur(cause instanceof Error ? cause.message : "Le retrait n’a pas abouti.");
      }
    });
  }

  /** Le tuteur lit les compétences, là où le vocabulaire du nom ne suffit pas. */
  async function demanderAuTuteur() {
    setErreur(null);
    setTuteurEnCours(true);
    try {
      const reponse = await fetch("/api/referentiel/carte", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domaineId, config: lireConfigTuteur(compteId) ?? undefined }),
      });
      const donnees = (await reponse.json().catch(() => null)) as {
        carte?: { noeud: string; justification: string };
        message?: string;
      } | null;
      if (!reponse.ok || !donnees?.carte) {
        setErreur(donnees?.message ?? "Le tuteur n’a pas su le classer.");
        return;
      }
      setPropositionTuteur(donnees.carte);
    } catch {
      setErreur("La demande n’a pas abouti.");
    } finally {
      setTuteurEnCours(false);
    }
  }

  const occupe = enCours || tuteurEnCours;
  const candidats = classification?.candidats ?? [];

  return (
    <section className="rounded-xl border border-primaire/25 bg-primaire-faible/15 px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-primaire">
          Classé dans
        </span>

        {rattachement ? (
          <>
            <span className="text-sm font-medium text-texte">
              {rattachement.obsolete
                ? `${rattachement.noeud} — ce tiroir n’existe plus`
                : cheminCourt(rattachement.noeud)}
            </span>
            {modifiable && (
              <span className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  disabled={occupe}
                  onClick={() => setListeOuverte((ouverte) => !ouverte)}
                  className="cursor-pointer text-texte-discret underline-offset-2 transition-colors hover:text-primaire hover:underline"
                >
                  changer
                </button>
                <button
                  type="button"
                  disabled={occupe}
                  onClick={detacher}
                  className="cursor-pointer text-texte-discret underline-offset-2 transition-colors hover:text-primaire hover:underline"
                >
                  retirer
                </button>
              </span>
            )}
          </>
        ) : (
          <span className="text-sm text-texte-attenue">pas encore — une piste ?</span>
        )}
      </div>

      {!rattachement && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {candidats.map((candidat) => (
            <button
              key={candidat.noeud}
              type="button"
              disabled={!modifiable || occupe}
              onClick={() => rattacher(candidat.noeud, "manuel")}
              title={candidat.explication.facteurs
                .map((facteur) => `${facteur.libelle} : ${facteur.valeur}`)
                .join("\n")}
              className={cx(
                "rounded-lg border px-3 py-1.5 text-sm font-medium shadow-xs transition-all",
                candidat.ambigu
                  ? "border-info/50 bg-info-faible/40 text-texte"
                  : "border-bordure bg-surface text-texte",
                modifiable && !occupe
                  ? "cursor-pointer hover:-translate-y-0.5 hover:border-primaire hover:text-primaire hover:shadow-[var(--ombre-levee)]"
                  : "cursor-default",
              )}
            >
              {cheminCourt(candidat.noeud)}
            </button>
          ))}

          {modifiable && (
            <>
              <button
                type="button"
                disabled={occupe}
                onClick={demanderAuTuteur}
                className="cursor-pointer rounded-lg border border-bordure bg-surface-2 px-3 py-1.5 text-xs font-medium text-texte-attenue transition-colors hover:border-primaire/50 hover:text-primaire"
              >
                {tuteurEnCours ? "le tuteur cherche…" : "demander au tuteur"}
              </button>
              <button
                type="button"
                disabled={occupe}
                onClick={() => setListeOuverte((ouverte) => !ouverte)}
                className="cursor-pointer rounded-lg border border-bordure bg-surface-2 px-3 py-1.5 text-xs font-medium text-texte-attenue transition-colors hover:border-primaire/50 hover:text-primaire"
              >
                {listeOuverte ? "fermer" : "tout voir"}
              </button>
            </>
          )}
        </div>
      )}

      {!rattachement && candidats[0]?.ambigu && (
        <p className="mt-2 text-[0.6875rem] text-texte-discret">
          Les deux premiers se valent : à vous de trancher.
        </p>
      )}

      {propositionTuteur && !rattachement && (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accent/30 bg-accent/5 px-2.5 py-2">
          <p className="min-w-0 text-xs text-texte-attenue">
            <span className="font-semibold text-texte">{cheminCourt(propositionTuteur.noeud)}</span>{" "}
            — {propositionTuteur.justification}
          </p>
          {modifiable && (
            <button
              type="button"
              disabled={occupe}
              onClick={() => rattacher(propositionTuteur.noeud, "tuteur")}
              className="cursor-pointer rounded-md bg-primaire-faible px-2 py-1 text-xs font-semibold text-primaire transition-colors hover:bg-primaire hover:text-primaire-contraste"
            >
              classer ici
            </button>
          )}
        </div>
      )}

      {erreur && <p className="mt-2 text-xs text-danger">{erreur}</p>}

      {listeOuverte && modifiable && (
        <div className="mt-2.5 max-h-56 overflow-y-auto rounded-lg border border-bordure bg-surface-2">
          <ul className="divide-y divide-bordure">
            {tousLesNoeuds.map((noeud) => (
              <li key={noeud.id}>
                <button
                  type="button"
                  disabled={occupe}
                  onClick={() => rattacher(noeud.id, "manuel")}
                  className="w-full cursor-pointer px-3 py-1.5 text-left text-xs text-texte-attenue transition-colors hover:bg-surface hover:text-texte"
                >
                  {noeud.chemin}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
