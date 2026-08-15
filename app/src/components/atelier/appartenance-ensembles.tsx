"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { VueCompetenceAtelier } from "@/lib/documents/vue-atelier";
import { modifierTheme } from "@/lib/store/theme-actions";
import { Bouton, cx } from "@/components/ui/primitives";

/**
 * Les ensembles auxquels une compétence appartient.
 *
 * ## Pourquoi cet écran manquait
 *
 * Le §3 du chantier pose la question à laquelle le produit doit savoir
 * répondre : « dans quel ensemble plus grand mon travail s'inscrit-il ? ». La
 * fiche d'une compétence ne le disait nulle part — les thèmes existaient, avec
 * leur propre page, mais rien ne remontait de la compétence vers eux.
 *
 * ## Pourquoi le rattachement se fait ici
 *
 * Le geste tient en un clic, à l'endroit où la question se pose. Créer un
 * thème demandait jusqu'ici d'ouvrir le compositeur de séance, de nommer un
 * regroupement et d'y choisir des compétences une à une : de l'organisation
 * pure, et personne n'ouvre l'application pour organiser. Rattacher une
 * compétence à un ensemble existant est le seul geste d'ensemble qui se
 * justifie depuis une compétence.
 *
 * Ce composant ne **crée** aucun ensemble : il ne fait qu'ajouter un code à un
 * thème que la personne a déjà nommé. La création reste là où elle a un sens.
 */
export function AppartenanceEnsembles({
  vue,
  ouvrirElement,
}: {
  vue: VueCompetenceAtelier;
  ouvrirElement: (id: string) => void;
}) {
  const router = useRouter();
  const [cible, setCible] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const rienAMontrer = vue.ensembles.length === 0 && vue.ensemblesDisponibles.length === 0;
  if (rienAMontrer) return null;

  function rattacher() {
    const ensemble = vue.ensemblesDisponibles.find((item) => item.id === cible);
    if (!ensemble) return;
    setErreur(null);
    demarrer(async () => {
      try {
        // Le libellé est renvoyé tel quel : `modifierTheme` réécrit la ligne
        // entière, et omettre le nom l'effacerait.
        await modifierTheme(ensemble.id, {
          libelle: ensemble.libelle,
          codes: [...ensemble.codes, vue.code],
        });
        setCible("");
        router.refresh();
      } catch (cause) {
        setErreur(cause instanceof Error ? cause.message : "Rattachement impossible.");
      }
    });
  }

  return (
    <section className="rounded-xl border border-bordure bg-surface p-5 shadow-[var(--ombre-posee)]">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
        Fait partie de
      </h3>

      {vue.ensembles.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {vue.ensembles.map((ensemble) => (
            <li key={ensemble.id}>
              <button
                type="button"
                onClick={() => ouvrirElement(`theme:${ensemble.id}`)}
                className="flex items-center gap-2 rounded-lg border border-accent/35 bg-accent-faible/40 px-3 py-1.5 text-xs font-medium text-texte transition-colors hover:border-accent/60 cursor-pointer"
              >
                <span>{ensemble.libelle}</span>
                <span className="chiffres text-[0.625rem] text-texte-discret">
                  {ensemble.nombreCompetences}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-texte-discret">
          Cette compétence n&apos;appartient à aucun ensemble pour l&apos;instant.
        </p>
      )}

      {vue.ensemblesDisponibles.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-bordure pt-3">
          <label className="sr-only" htmlFor={`ensemble-${vue.code}`}>
            Ajouter cette compétence à un ensemble
          </label>
          <select
            id={`ensemble-${vue.code}`}
            value={cible}
            onChange={(event) => setCible(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-bordure-controle bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-primaire cursor-pointer"
          >
            <option value="">Ajouter à un ensemble…</option>
            {vue.ensemblesDisponibles.map((ensemble) => (
              <option key={ensemble.id} value={ensemble.id}>
                {ensemble.libelle}
              </option>
            ))}
          </select>
          <Bouton
            onClick={rattacher}
            disabled={!cible || enCours}
            variante="secondaire"
            taille="petite"
            className={cx(enCours && "pointer-events-none")}
          >
            {enCours ? "Ajout…" : "Ajouter"}
          </Bouton>
        </div>
      )}

      {erreur && <p className="mt-2 text-xs text-danger">{erreur}</p>}
    </section>
  );
}
