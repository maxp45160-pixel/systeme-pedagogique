"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDateHeure } from "@/lib/engine/dates";
import type { VueExerciceProjectionAtelier } from "@/lib/documents/vue-atelier";
import { cx } from "@/components/ui/primitives";
import { urlComposerAutonome } from "@/lib/domain/navigation-exercice";
import { IconeExercices, IconeFleche } from "@/components/ui/icones";
import { BoutonRetirerExercice } from "@/components/exercices/bouton-retirer";
import { Markdown } from "@/components/ui/markdown";
import { LIBELLES_PALIERS } from "./elements-fiche";

export function VueExercice({
  vue,
  ouvrirElement,
}: {
  vue: VueExerciceProjectionAtelier;
  ouvrirElement: (id: string) => void;
}) {
  const router = useRouter();

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-surface-2/40">
      <header className="border-b border-bordure bg-surface px-6 py-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-primaire/20 bg-primaire-faible text-primaire shadow-xs">
              <IconeExercices className="size-7" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-info-faible px-2.5 py-0.5 text-xs font-semibold text-info">
                  Exercice
                </span>
                <span className="rounded-md bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-texte-discret">
                  Difficulté {vue.difficulte}/5
                </span>
                <span className="rounded-md bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-texte-discret">
                  ~{vue.dureeEstimeeMin} min
                </span>
                <span className="rounded-md bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-texte-discret capitalize">
                  {vue.typeExercice}
                </span>
              </div>
              <h2 className="mt-2 font-serif text-[2.2rem] font-medium leading-tight tracking-tight text-texte">
                {vue.titre}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={urlComposerAutonome(vue.competences[0]?.code, vue.dureeEstimeeMin)}
              className="inline-flex items-center gap-2 rounded-xl bg-primaire px-5 py-3 text-sm font-semibold text-texte-inverse shadow hover:bg-primaire-survol transition-colors"
            >
              <span>S’exercer dans le cahier</span>
              <IconeFleche className="size-4" />
            </Link>
            {!vue.tentatives.some((tentative) => tentative.statut === "en-cours") && (
              <BoutonRetirerExercice
                exerciceId={vue.id}
                titre={vue.titre}
                tentatives={vue.nombreTentatives}
                onRetire={() => {
                  ouvrirElement(`domaine:${vue.domaineId}`);
                  router.refresh();
                }}
              />
            )}
          </div>
        </div>
      </header>

      <div className="space-y-6 p-6 lg:p-8">
        {/* Énoncé de l'exercice */}
        <section className="rounded-xl border border-bordure bg-surface p-6 shadow-[var(--ombre-posee)]">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-texte-discret">
            Énoncé de l’exercice
          </h3>
          <div className="prose-exo mt-4 text-sm leading-relaxed text-texte">
            <Markdown contenu={vue.enonce || "Aucun énoncé fourni pour cet exercice."} />
          </div>
        </section>

        {/* Compétences visées */}
        <section className="rounded-xl border border-bordure bg-surface p-6 shadow-[var(--ombre-posee)]">
          <div className="flex items-center justify-between border-b border-bordure pb-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-texte-discret">
              Compétences cibles
            </h3>
            <span className="text-xs text-texte-discret">{vue.competences.length} compétence(s)</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {vue.competences.map((comp) => (
              <button
                key={comp.code}
                type="button"
                onClick={() => ouvrirElement(comp.code)}
                className="group flex items-center justify-between rounded-xl border border-bordure bg-surface-2/40 p-3.5 text-left transition-all hover:border-primaire/40 hover:bg-surface-2 cursor-pointer"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[0.625rem] text-texte-discret">
                      {LIBELLES_PALIERS[comp.palier] ?? comp.palier}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-texte truncate group-hover:text-primaire">
                    {comp.titre}
                  </p>
                </div>
                <span className="text-texte-discret transition-transform group-hover:translate-x-1 group-hover:text-primaire">→</span>
              </button>
            ))}
          </div>
        </section>

        {/* Historique des tentatives */}
        <section className="rounded-xl border border-bordure bg-surface p-6 shadow-[var(--ombre-posee)]">
          <div className="flex items-center justify-between border-b border-bordure pb-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-texte-discret">
              Historique des tentatives
            </h3>
            <span className="text-xs text-texte-discret">{vue.nombreTentatives} tentative(s)</span>
          </div>
          {vue.tentatives.length > 0 ? (
            <div className="mt-4 space-y-2">
              {vue.tentatives.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-bordure bg-surface-2/30 px-4 py-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cx(
                        "rounded px-2 py-0.5 font-semibold text-xs",
                        t.resultat === "reussi"
                          ? "bg-succes-faible text-succes"
                          : t.resultat === "partiel"
                          ? "bg-info-faible text-info"
                          : "bg-danger-faible text-danger",
                      )}
                    >
                      {t.resultat === "reussi" ? "Réussi" : t.resultat === "partiel" ? "Partiel" : "Échec"}
                    </span>
                    <span className="text-texte-discret">
                      {formatDateHeure(t.fin ?? t.debut)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-texte-discret">
                    {t.dureeMin !== undefined && <span>{t.dureeMin} min</span>}
                    <span>{t.indicesUtilises} indice{t.indicesUtilises > 1 ? "s" : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-xs text-texte-discret">
              Aucune tentative enregistrée sur cet exercice. Lance une session pour enregistrer ta première observation.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
