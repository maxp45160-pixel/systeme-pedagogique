"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cx } from "@/components/ui/primitives";
import { BandeauInfo, Bouton } from "@/components/ui/primitives";
import { rattacherCompetences } from "@/lib/store/referentiel-actions";
import type { Skill } from "@/lib/domain/types";

/**
 * Rattacher à ce domaine une compétence portée par un autre.
 *
 * Le geste répond à ce qui poussait à dupliquer : on crée un domaine, un
 * savoir-faire du référentiel le sert déjà, et la seule issue était d'en écrire
 * une seconde version — donc un second code et deux flux de preuves. Ici rien
 * n'est créé : la compétence existante se met à servir un domaine de plus.
 *
 * Le domaine porteur n'est jamais touché. Il garde le code et la gouvernance.
 */
export function ModaleRattachement({
  domaineId,
  domaineNom,
  competences,
  nomDomaine,
  onFermer,
}: {
  domaineId: string;
  domaineNom: string;
  /** Toutes les compétences du référentiel : celles d'ici sont filtrées. */
  competences: Skill[];
  /** Nom lisible d'un domaine, pour situer chaque candidate. */
  nomDomaine: (id: string) => string;
  onFermer: () => void;
}) {
  const router = useRouter();
  const [recherche, setRecherche] = useState("");
  const [selection, setSelection] = useState<string[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const candidates = useMemo(() => {
    const terme = recherche.trim().toLocaleLowerCase("fr-FR");
    return competences
      .filter((skill) => skill.domaine !== domaineId && !skill.archive)
      .filter((skill) => !(skill.domainesSecondaires ?? []).includes(domaineId))
      .filter((skill) =>
        terme
          ? `${skill.code} ${skill.intitule}`.toLocaleLowerCase("fr-FR").includes(terme)
          : true,
      )
      .sort((a, b) => a.intitule.localeCompare(b.intitule, "fr"));
  }, [competences, domaineId, recherche]);

  function basculer(code: string) {
    setSelection((anciens) =>
      anciens.includes(code) ? anciens.filter((autre) => autre !== code) : [...anciens, code],
    );
  }

  function soumettre() {
    if (selection.length === 0) return;
    setErreur(null);
    demarrer(async () => {
      try {
        await rattacherCompetences(domaineId, selection, true);
        router.refresh();
        onFermer();
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Rattachement impossible.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[80vh] w-full max-w-xl flex-col rounded-xl border border-bordure bg-surface shadow-[var(--ombre-levee)]">
        <header className="border-b border-bordure px-5 py-4">
          <h2 className="font-serif text-lg font-medium text-texte">
            Rattacher une compétence à {domaineNom}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-texte-attenue">
            La compétence garde son domaine porteur, son code et ses preuves. Elle se met à servir
            ce domaine en plus, et compte dans sa couverture.
          </p>
        </header>

        <div className="border-b border-bordure px-5 py-3">
          <label className="sr-only" htmlFor="recherche-rattachement">
            Rechercher une compétence
          </label>
          <input
            id="recherche-rattachement"
            type="search"
            value={recherche}
            onChange={(event) => setRecherche(event.target.value)}
            placeholder="Rechercher par code ou intitulé…"
            className="w-full rounded-lg border border-bordure-controle bg-surface px-3 py-1.5 text-sm outline-none transition-colors placeholder:text-texte-discret focus:border-primaire"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {candidates.length === 0 ? (
            <p className="py-8 text-center text-xs text-texte-attenue">
              {recherche.trim()
                ? "Aucune compétence ne correspond."
                : "Toutes les compétences des autres domaines servent déjà celui-ci."}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {candidates.map((skill) => {
                const choisie = selection.includes(skill.code);
                return (
                  <li key={skill.code}>
                    <button
                      type="button"
                      onClick={() => basculer(skill.code)}
                      className={cx(
                        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer",
                        choisie
                          ? "border-primaire bg-primaire-faible"
                          : "border-bordure bg-surface hover:border-primaire/40",
                      )}
                    >
                      <span
                        className={cx(
                          "grid size-4 shrink-0 place-items-center rounded border text-[0.625rem] font-bold",
                          choisie ? "border-primaire bg-primaire text-texte-inverse" : "border-bordure-controle",
                        )}
                        aria-hidden
                      >
                        {choisie ? "✓" : ""}
                      </span>
                      <span className="font-mono text-xs font-semibold text-primaire">{skill.code}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-texte">{skill.intitule}</span>
                      <span className="shrink-0 text-[0.6875rem] text-texte-discret">
                        {nomDomaine(skill.domaine)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {erreur && (
          <div className="px-5 pb-2">
            <BandeauInfo ton="danger" taille="compacte">
              <p className="text-danger">{erreur}</p>
            </BandeauInfo>
          </div>
        )}

        <footer className="flex items-center justify-between gap-3 border-t border-bordure px-5 py-3.5">
          <span className="text-xs text-texte-discret">
            {selection.length === 0
              ? "Aucune compétence sélectionnée"
              : `${selection.length} sélectionnée${selection.length > 1 ? "s" : ""}`}
          </span>
          <div className="flex items-center gap-2">
            <Bouton type="button" variante="secondaire" onClick={onFermer} disabled={enCours}>
              Annuler
            </Bouton>
            <Bouton type="button" onClick={soumettre} disabled={enCours || selection.length === 0}>
              {enCours ? "Rattachement…" : "Rattacher"}
            </Bouton>
          </div>
        </footer>
      </div>
    </div>
  );
}
