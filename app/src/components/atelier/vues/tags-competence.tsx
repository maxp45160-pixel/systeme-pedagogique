"use client";

/**
 * Les domaines où cette compétence sert (ADR-107).
 *
 * Un savoir-faire n'appartient à personne : il sert. « Lire un tableau de
 * données » sert les statistiques et la logistique, et lui donner deux codes
 * dédoublerait ses traces de travail. D'où des tags, plusieurs, sur une seule
 * compétence — et une compétence sans tag, qui reste au référentiel sans
 * apparaître dans aucun domaine, jusqu'à ce qu'une personne la range.
 *
 * Trois choses que ce panneau ne fait pas :
 *
 * - **il ne range rien tout seul.** Le tuteur propose sur demande, avec un
 *   motif par ligne ; aucun classement lexical n'écrit ici (ADR-107) ;
 * - **il ne montre pas les domaines hérités.** Un tag posé sur un sous-domaine
 *   rend la compétence visible dans tous ses parents, mais il n'y a rien à
 *   retirer là-haut : seul un tag posé se retire ;
 * - **il ne réclame pas de tag.** Zéro est un état, pas une alerte.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";
import { taguerCompetences } from "@/lib/store/referentiel-actions";
import { cx } from "@/components/ui/primitives";

interface TagPropose {
  domaineId: string;
  justification: string;
  chemin: string;
}

export function TagsCompetence({
  code,
  compteId,
  /*
   * Défauts pour la même raison que dans `ParenteDomaine` : une fiche rendue
   * avant le déploiement des tags ne les porte pas, et un panneau secondaire
   * ne doit pas faire tomber la fiche entière.
   */
  tags = [],
  domainesExistants = [],
  modifiable,
  ouvrirDomaine,
}: {
  code: string;
  compteId: string;
  /** Les tags déclarés, chemin compris. Vide = « À classer ». */
  tags?: Array<{ id: string; nom: string; chemin: string }>;
  domainesExistants?: Array<{ id: string; nom: string }>;
  modifiable: boolean;
  ouvrirDomaine: (id: string) => void;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [listeOuverte, setListeOuverte] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [tuteurEnCours, setTuteurEnCours] = useState(false);
  const [propositions, setPropositions] = useState<TagPropose[] | null>(null);

  const poses = useMemo(() => new Set(tags.map((tag) => tag.id)), [tags]);
  const ajoutables = useMemo(
    () =>
      domainesExistants
        .filter((domaine) => !poses.has(domaine.id))
        .sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    [domainesExistants, poses],
  );

  function ecrire(domaineId: string, tague: boolean) {
    setErreur(null);
    demarrer(async () => {
      try {
        await taguerCompetences(domaineId, [code], tague);
        setListeOuverte(false);
        setPropositions((courantes) =>
          courantes ? courantes.filter((tag) => tag.domaineId !== domaineId) : null,
        );
        router.refresh();
      } catch (cause) {
        setErreur(cause instanceof Error ? cause.message : "Le tag n’a pas abouti.");
      }
    });
  }

  /** Le tuteur lit l'intitulé, là où le nom du domaine ne suffit pas. */
  async function demanderAuTuteur() {
    setErreur(null);
    setTuteurEnCours(true);
    try {
      const reponse = await fetch("/api/referentiel/tags", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, config: lireConfigTuteur(compteId) ?? undefined }),
      });
      const donnees = (await reponse.json().catch(() => null)) as {
        tags?: TagPropose[];
        message?: string;
      } | null;
      if (!reponse.ok || !donnees?.tags) {
        setErreur(donnees?.message ?? "Le tuteur n’a pas su où la ranger.");
        return;
      }
      setPropositions(donnees.tags);
    } catch {
      setErreur("La proposition n’a pas abouti.");
    } finally {
      setTuteurEnCours(false);
    }
  }

  return (
    <section className="rounded-xl border border-bordure bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-texte-discret">
          Sert dans
        </span>
        {tags.length === 0 ? (
          <span className="text-sm text-texte-attenue">
            À classer — aucun domaine ne la montre pour l’instant.
          </span>
        ) : (
          tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1.5 rounded-lg border border-bordure bg-surface-2 px-2.5 py-1 text-xs font-medium text-texte"
            >
              <button
                type="button"
                onClick={() => ouvrirDomaine(tag.id)}
                title={tag.chemin}
                className="cursor-pointer underline-offset-2 transition-colors hover:text-primaire hover:underline"
              >
                {tag.nom}
              </button>
              {modifiable && (
                <button
                  type="button"
                  onClick={() => ecrire(tag.id, false)}
                  disabled={enCours}
                  aria-label={`Retirer le tag ${tag.nom}`}
                  className="cursor-pointer text-texte-discret transition-colors hover:text-danger disabled:opacity-60"
                >
                  ×
                </button>
              )}
            </span>
          ))
        )}

        {modifiable && (
          <>
            <button
              type="button"
              onClick={() => setListeOuverte((ouvert) => !ouvert)}
              aria-expanded={listeOuverte}
              disabled={enCours}
              className="cursor-pointer rounded-lg border border-bordure bg-surface-2 px-2.5 py-1 text-xs font-medium text-texte transition-colors hover:border-primaire/50 hover:text-primaire disabled:opacity-60"
            >
              Ajouter un domaine
            </button>
            {compteId && (
              <button
                type="button"
                onClick={demanderAuTuteur}
                disabled={tuteurEnCours || enCours}
                className="cursor-pointer text-xs text-texte-discret underline-offset-2 transition-colors hover:text-primaire hover:underline disabled:opacity-60"
              >
                {tuteurEnCours ? "le tuteur cherche…" : "demander au tuteur"}
              </button>
            )}
          </>
        )}
      </div>

      {listeOuverte && modifiable && (
        <div className="mt-3 flex flex-wrap gap-2">
          {ajoutables.length === 0 ? (
            <p className="text-xs text-texte-attenue">
              Elle sert déjà tous les domaines du compte.
            </p>
          ) : (
            ajoutables.map((domaine) => (
              <button
                key={domaine.id}
                type="button"
                onClick={() => ecrire(domaine.id, true)}
                disabled={enCours}
                className="cursor-pointer rounded-lg border border-bordure bg-surface-2 px-2.5 py-1 text-xs font-medium text-texte transition-colors hover:border-primaire/50 hover:text-primaire disabled:opacity-60"
              >
                {domaine.nom}
              </button>
            ))
          )}
        </div>
      )}

      {propositions && (
        <div className="mt-3 space-y-2">
          {propositions.length === 0 ? (
            <p className="text-xs text-texte-attenue">
              Le tuteur ne voit aucun domaine existant qui convienne. Il en manque peut-être un.
            </p>
          ) : (
            propositions.map((tag) => (
              <div
                key={tag.domaineId}
                className={cx(
                  "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-bordure bg-surface-2 px-3 py-2",
                )}
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-texte">{tag.chemin}</p>
                  <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-texte-attenue">
                    {tag.justification}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => ecrire(tag.domaineId, true)}
                    disabled={enCours}
                    className="cursor-pointer rounded-lg border border-primaire bg-primaire-faible px-2.5 py-1 text-xs font-medium text-primaire transition-colors disabled:opacity-60"
                  >
                    Poser ce tag
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPropositions((courantes) =>
                        courantes ? courantes.filter((autre) => autre.domaineId !== tag.domaineId) : null,
                      )
                    }
                    className="cursor-pointer text-xs text-texte-discret underline-offset-2 transition-colors hover:text-primaire hover:underline"
                  >
                    écarter
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {erreur && <p className="mt-2 text-xs text-danger">{erreur}</p>}
    </section>
  );
}
