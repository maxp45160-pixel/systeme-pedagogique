"use client";

/**
 * Le sas — la coupure entre « je décide de travailler » et « je travaille »
 * (ADR-101).
 *
 * ## Le problème
 *
 * Démarrer une séance était une navigation : un clic, un rechargement, un
 * exercice à l'écran. Rien ne séparait le geste de décision du travail
 * lui-même, et l'intention qu'on venait d'écrire au compositeur disparaissait
 * de la vue au moment précis où elle aurait servi.
 *
 * ## Ce que le sas montre
 *
 * Ce que la personne a **elle-même déclaré** : son intention, et les codes de
 * compétences visés. Rien d'ajouté, rien de calculé, aucun encouragement
 * fabriqué. Le sas relit une déclaration, il ne produit pas de contenu.
 *
 * ## Pourquoi il n'est jamais bloquant
 *
 * Deux secondes, puis il s'efface seul. `Échap`, un clic ou n'importe quelle
 * touche le traversent immédiatement. Un délai qu'on ne peut pas franchir
 * deviendrait une friction quotidienne — c'est le risque nommé au moment de
 * la décision, et la sortie immédiate est ce qui le referme.
 *
 * ## Pourquoi il ne se stocke pas
 *
 * Sa présence est portée par l'URL (`sas=1`, posé par `demarrerSeance`,
 * `reprendreSeance` et le compositeur). Une clé navigateur « déjà vu pour la
 * séance X » aurait été une donnée de plus à isoler par compte, pour un
 * confort que le paramètre d'URL rend gratuitement — et qui disparaît tout
 * seul dès qu'on recharge.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Le temps d'affichage, en millisecondes. Un souffle, pas une attente. */
const DUREE_MS = 2000;

export function SasSeance({
  actif,
  urlApres,
  intention,
  codes,
  nombreExercices,
  dureeCibleMin,
}: {
  /** Vrai quand l'URL porte `sas=1`. Décidé côté serveur : voir plus bas. */
  actif: boolean;
  /** La même URL, sans `sas` — posée dès l'affichage. */
  urlApres: string;
  /** L'intention déclarée au compositeur. Absente : le sas ne s'affiche pas. */
  intention?: string;
  codes: string[];
  nombreExercices: number;
  dureeCibleMin?: number;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(actif);

  /*
   * `actif` vient du serveur plutôt que d'un `useSearchParams()` : le sas doit
   * être peint au PREMIER rendu, pas après hydratation. Lu côté client, il
   * serait apparu une fraction de seconde après l'exercice — exactement
   * l'inverse d'une coupure.
   *
   * Le paramètre est ensuite retiré de l'URL dès l'affichage, pas à la
   * fermeture : ainsi un rechargement pendant les deux secondes ne rejoue pas
   * le sas, et l'URL qu'on copie au milieu du travail ne le contient pas.
   */
  useEffect(() => {
    if (!actif) return;
    router.replace(urlApres, { scroll: false });
  }, [actif, router, urlApres]);

  useEffect(() => {
    if (!visible) return;

    const minuterie = window.setTimeout(() => setVisible(false), DUREE_MS);
    const traverser = () => setVisible(false);

    document.addEventListener("keydown", traverser);
    document.addEventListener("pointerdown", traverser);
    return () => {
      window.clearTimeout(minuterie);
      document.removeEventListener("keydown", traverser);
      document.removeEventListener("pointerdown", traverser);
    };
  }, [visible]);

  /*
   * Pas d'intention déclarée, pas de sas. Le sas relit ce que la personne a
   * écrit ; sans phrase à relire, il n'aurait qu'un compte d'exercices à
   * montrer — un écran de chargement déguisé, et deux secondes prises pour
   * rien.
   */
  if (!visible || !intention?.trim()) return null;

  const details = [
    `${nombreExercices} exercice${nombreExercices > 1 ? "s" : ""}`,
    ...(dureeCibleMin ? [`environ ${dureeCibleMin} min`] : []),
  ].join(" · ");

  return (
    /*
     * `aria-live="polite"` plutôt qu'un `role="dialog"` : le sas n'attend
     * aucune réponse et ne retient pas le focus. En faire une boîte de
     * dialogue obligerait à la fermer — exactement ce qu'il ne doit pas
     * demander.
     */
    <div
      aria-live="polite"
      className="fixed inset-0 z-[70] grid place-items-center bg-fond px-6 text-center"
    >
      <div aria-hidden className="bureau-lampe absolute inset-0" />

      <div className="apparition relative max-w-2xl">
        <p className="text-[0.6875rem] uppercase tracking-[0.16em] text-texte-discret">
          Vous avez demandé
        </p>

        <blockquote className="mt-4 font-serif text-2xl font-normal leading-snug tracking-tight sm:text-[1.9rem]">
          « {intention.trim()} »
        </blockquote>

        {codes.length > 0 && (
          <div className="mt-5 flex flex-wrap justify-center gap-1.5">
            {codes.map((code) => (
              <span
                key={code}
                className="rounded border border-bordure bg-surface-2 px-2 py-0.5 font-mono text-[0.6875rem] text-texte-attenue"
              >
                {code}
              </span>
            ))}
          </div>
        )}

        <div
          aria-hidden
          className="mx-auto mt-10 h-0.5 w-44 overflow-hidden rounded-full bg-surface-3"
        >
          <div
            className="h-full rounded-full bg-primaire motion-reduce:w-full"
            style={{ animation: `sas-jauge ${DUREE_MS}ms linear forwards` }}
          />
        </div>

        <p className="mt-4 text-xs text-texte-discret">
          {details} — une touche pour entrer tout de suite
        </p>
      </div>

      {/*
        La jauge est la seule animation du sas, et elle est déclarée ici plutôt
        que dans `globals.css` parce que sa durée doit rester la même constante
        que la minuterie ci-dessus. Deux valeurs à tenir synchrones dans deux
        fichiers auraient divergé.
      */}
      <style>{`@keyframes sas-jauge { from { width: 0 } to { width: 100% } }`}</style>
    </div>
  );
}
