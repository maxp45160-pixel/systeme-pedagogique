"use client";

/**
 * Choisir un travail depuis le tableau de bord.
 *
 * ## Ce qui a été retiré, et pourquoi
 *
 * Une séance passait par une **note opérationnelle** : le clic créait une fiche
 * « Séance d'exercices », l'écran partait sur `/atelier?note=…`, et la
 * composition s'ouvrait par-dessus. Trois conséquences, toutes mauvaises :
 *
 *  - la fiche déclarait `domaine: "transversal"` et aucun thème, donc
 *    `ConcepteurSeance` retombait sur `themesSuggeres[0]` — la prochaine action
 *    du moteur. Taper « Philosophie » donnait une séance sur tout autre chose :
 *    le sujet écrit n'entrait nulle part dans la composition ;
 *  - fermer la composition renvoyait sur cette fiche — un formulaire
 *    Intention / Déroulé / Bilan que personne n'avait demandé ;
 *  - un document était écrit avant même qu'une séance existe.
 *
 * Le sujet libre passe maintenant par `ModaleTheme` : le tuteur désigne des
 * compétences **existantes** (`/api/themes/resoudre`, jamais de code inventé —
 * ADR-053), on relit, et le thème enregistré devient la portée de la séance.
 * Une priorité recommandée, elle, connaît déjà son code : elle va droit au
 * compositeur.
 *
 * Rien n'est écrit avant la validation finale : ni note, ni séance. Le seul
 * objet créé par le chemin « autre sujet » est le thème, et il l'est après
 * relecture explicite.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ParcoursNouveauProjet } from "@/components/projets/modale-nouveau-projet";
import { ModaleTheme } from "@/components/seances/modale-theme";
import { IconeFleche } from "@/components/ui/icones";
import { Modale } from "@/components/ui/modale";
import { Bouton, Carte, cx } from "@/components/ui/primitives";
import { urlComposition, urlCompositionTheme } from "@/lib/domain/intention";
import { FORMATS_OPERATIONNELS_A_VENIR } from "@/lib/documents/roles-note";

/**
 * Séance et projet ne sont plus deux formats du même document : la séance
 * compose, le projet garde sa fiche. La liste vit donc ici et non dans
 * `roles-note.ts`, qui ne décrit que les notes.
 */
const FORMATS_TRAVAIL = [
  { valeur: "seance", libelle: "Séance de travail" },
  { valeur: "projet", libelle: "Projet" },
] as const;

type FormatTravail = (typeof FORMATS_TRAVAIL)[number]["valeur"];

export interface RecommandationTravail {
  code: string;
  intitule: string;
  domaineId: string;
  domaineNom: string;
  raison: string;
}

/** Entrée dédiée au travail : les notes support restent dans `CaptureNotes`. */
export function ChoixTravail({
  recommandations,
  competences,
  domaines,
  compteId,
}: {
  recommandations: RecommandationTravail[];
  /** Le référentiel actif, pour afficher lisiblement ce que le tuteur désigne. */
  competences: { code: string; intitule: string; domaine: string }[];
  domaines: { id: string; nom: string; prefixe: string }[];
  compteId: string;
}) {
  const router = useRouter();
  const [ouverte, setOuverte] = useState(false);
  const [cible, setCible] = useState<string | null>(null);
  const [autreSujet, setAutreSujet] = useState("");
  const [format, setFormat] = useState<FormatTravail>("seance");
  const [projetOuvert, setProjetOuvert] = useState(false);
  const [intentionProjet, setIntentionProjet] = useState("");
  const [resolutionOuverte, setResolutionOuverte] = useState(false);

  const competencesParCode = useMemo(
    () =>
      new Map(
        competences.map((competence) => [
          competence.code,
          { intitule: competence.intitule, domaine: competence.domaine },
        ]),
      ),
    [competences],
  );

  const recommandationSelectionnee = cible
    ? recommandations.find((recommandation) => recommandation.code === cible)
    : undefined;
  const sujetLibre = autreSujet.trim();
  const libelleCible = recommandationSelectionnee?.intitule ?? (cible === "autre" ? sujetLibre : "");

  function ouvrir(cibleInitiale: string) {
    setOuverte(true);
    setCible(cibleInitiale);
    setAutreSujet("");
    setFormat("seance");
  }

  function commencer() {
    if (!libelleCible) return;

    /*
      Le projet passe par son propre parcours : le tuteur désigne les
      compétences, la personne confirme, puis il rédige le sujet.
    */
    if (format === "projet") {
      setIntentionProjet(libelleCible);
      setOuverte(false);
      setProjetOuvert(true);
      return;
    }

    /*
      Une priorité recommandée porte déjà son code : la portée est connue, il
      n'y a rien à résoudre. Un sujet libre, lui, n'est pour l'instant qu'une
      phrase — il faut le traduire en compétences existantes avant de composer,
      sinon le compositeur retomberait sur la recommandation générale et
      ignorerait ce qui vient d'être écrit.
    */
    if (recommandationSelectionnee) {
      router.push(urlComposition([recommandationSelectionnee.code], ""));
      return;
    }

    setResolutionOuverte(true);
  }

  return (
    <>
      <Carte className="overflow-hidden">
        <div className="px-5 py-4 sm:px-6">
          <p className="text-sm font-medium">Choisir un travail</p>
          <p className="mt-1 text-xs leading-relaxed text-texte-attenue">
            Deux priorités recommandées, ou un autre sujet si tu préfères.
          </p>
          <div className="mt-4 grid gap-2">
            {recommandations.slice(0, 2).map((recommandation, index) => (
              <button
                key={recommandation.code}
                type="button"
                onClick={() => ouvrir(recommandation.code)}
                className="group rounded-xl border border-bordure bg-surface-2 p-3 text-left transition-colors hover:border-alerte/35 hover:bg-alerte-faible/35"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-alerte">
                    Priorité {index + 1}
                  </span>
                  <IconeFleche className="size-3.5 text-texte-discret group-hover:text-alerte" />
                </span>
                <span className="mt-2 block text-sm font-semibold">{recommandation.intitule}</span>
                <span className="mt-1 block text-xs text-texte-discret">
                  {recommandation.domaineNom} · {recommandation.raison}
                </span>
              </button>
            ))}
            {recommandations.length === 0 && (
              <p className="rounded-lg border border-bordure px-3 py-2 text-xs text-texte-discret">
                Aucune priorité disponible pour le moment.
              </p>
            )}
            <button
              type="button"
              onClick={() => ouvrir("autre")}
              className="group rounded-xl border border-dashed border-bordure-contraste bg-surface p-3 text-left transition-colors hover:border-primaire/35 hover:bg-primaire-faible/35"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">Autre sujet</span>
                <IconeFleche className="size-3.5 text-texte-discret group-hover:text-primaire" />
              </span>
              <span className="mt-1 block text-xs text-texte-discret">Décris ce que tu veux travailler.</span>
            </button>
          </div>
        </div>
      </Carte>

      {projetOuvert && (
        <ParcoursNouveauProjet
          accountId={compteId}
          intentionInitiale={intentionProjet}
          onFermer={() => setProjetOuvert(false)}
        />
      )}

      {/*
        La résolution remplace la modale de choix plutôt que de s'empiler
        par-dessus : c'est la même décision qui continue, pas une seconde.
      */}
      {resolutionOuverte && (
        <ModaleTheme
          compteId={compteId}
          competencesParCode={competencesParCode}
          domainesExistants={domaines}
          intentionInitiale={sujetLibre}
          onFermer={() => setResolutionOuverte(false)}
          onCree={(theme) => {
            setResolutionOuverte(false);
            setOuverte(false);
            router.push(urlCompositionTheme(theme.id, sujetLibre));
          }}
        />
      )}

      {ouverte && !projetOuvert && !resolutionOuverte && (
        <Modale
          titre="Nouveau travail"
          sousTitre="Décris le sujet : il devient directement le travail à ouvrir."
          largeur="md"
          onFermer={() => setOuverte(false)}
          pied={
            <>
              <Bouton variante="secondaire" onClick={() => setOuverte(false)}>Annuler</Bouton>
              <Bouton variante="principal" onClick={commencer} disabled={!libelleCible}>
                {cible === "autre" && format === "seance"
                  ? "Chercher dans mes compétences"
                  : "Commencer"}
              </Bouton>
            </>
          }
        >
          <div className="space-y-5">
            {cible === "autre" && (
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-texte-discret">Autre sujet</span>
                <input
                  value={autreSujet}
                  onChange={(event) => setAutreSujet(event.target.value)}
                  placeholder="Ex. Préparer mon entretien de demain"
                  maxLength={200}
                  autoFocus
                  className="mt-1.5 w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2.5 text-sm outline-none focus:border-primaire"
                />
              </label>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-texte-discret">Sujet de la séance</p>
              <p className="mt-1 rounded-lg border border-primaire/35 bg-primaire-faible/35 px-3 py-2.5 text-sm font-medium">
                {cible === "autre" ? sujetLibre || "Décris ton sujet ci-dessus" : libelleCible}
              </p>
              {cible === "autre" && format === "seance" && (
                <p className="mt-1.5 text-xs text-texte-discret">
                  Le tuteur cherchera les compétences existantes qui couvrent ce sujet. Tu
                  relis avant que quoi que ce soit ne parte.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-texte-discret">Type de travail</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {FORMATS_TRAVAIL.map(({ valeur, libelle }) => (
                  <button
                    key={valeur}
                    type="button"
                    onClick={() => setFormat(valeur)}
                    aria-pressed={format === valeur}
                    className={cx(
                      "rounded-lg border px-3 py-3 text-left text-sm font-medium transition-colors",
                      format === valeur
                        ? "border-primaire bg-primaire-faible text-primaire"
                        : "border-bordure bg-surface-2 hover:border-primaire/35",
                    )}
                  >
                    {libelle}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5 border-t border-bordure pt-3">
                <p className="text-xs text-texte-discret">Coming soon</p>
                {FORMATS_OPERATIONNELS_A_VENIR.map((option) => (
                  <div key={option.valeur} className="flex items-center justify-between rounded-lg border border-bordure/70 px-3 py-2 text-sm text-texte-discret">
                    <span>{option.libelle}</span>
                    <span className="text-[0.6875rem] uppercase tracking-wide">Coming soon</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modale>
      )}
    </>
  );
}
