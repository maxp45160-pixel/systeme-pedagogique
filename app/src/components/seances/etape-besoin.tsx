"use client";

/**
 * Étape 1 du compositeur — le thème et le temps.
 *
 * Extrait de `concepteur-seance.tsx` : le parent garde la machine à états,
 * cette étape ne reçoit que des valeurs et des setters.
 */

import { useState } from "react";
import { BandeauInfo, Carte, cx } from "@/components/ui/primitives";
import { Champ } from "@/components/ui/champ";
import { DUREE_ESTIMEE_MIN } from "@/lib/domain/exercice";
import { TEMPS_DECLARE_MAX } from "@/lib/domain/seance";
import { nombreExercicesConseille, type ThemeSeance } from "@/lib/engine/caf";

function BoutonSujet({
  sujet,
  actif,
  surChoisir,
}: {
  sujet: ThemeSeance;
  actif: boolean;
  surChoisir: (sujet: ThemeSeance) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => surChoisir(sujet)}
      aria-pressed={actif}
      className={cx(
        "block w-full rounded-lg border px-3 py-2 text-left transition-colors",
        actif
          ? "border-primaire bg-primaire-faible"
          : "border-bordure bg-surface hover:border-primaire/35 hover:bg-primaire-faible/35",
      )}
    >
      <span className="block text-xs font-medium">{sujet.libelle}</span>
      <span className="mt-0.5 block text-[0.6875rem] text-texte-discret">{sujet.detail}</span>
    </button>
  );
}

function ListeSujets({
  titre,
  sujets,
  actif,
  surChoisir,
  vide,
}: {
  titre: string;
  sujets: ThemeSeance[];
  /** Clé du sujet courant, pour le marquer sans le rendre deux fois. */
  actif: string;
  surChoisir: (sujet: ThemeSeance) => void;
  /** Phrase affichée quand la liste est vide. Absente : la section disparaît. */
  vide?: string;
}) {
  if (sujets.length === 0 && !vide) return null;
  return (
    <div className="space-y-2">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
        {titre}
      </p>
      {sujets.length === 0 ? (
        <p className="text-xs text-texte-discret">{vide}</p>
      ) : (
        <div className="space-y-1.5">
          {sujets.map((sujet) => (
            <BoutonSujet
              key={sujet.cle}
              sujet={sujet}
              actif={sujet.cle === actif}
              surChoisir={surChoisir}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function EtapeBesoin({
  themePrincipal,
  sourceTheme,
  suggestions,
  themesDeDomaine,
  themesDeCompetence,
  surChoisirTheme,
  temps,
  setTemps,
  conseil,
  intention,
  setIntention,
  intentionOuverte,
  setIntentionOuverte,
  erreur,
}: {
  themePrincipal: ThemeSeance | null;
  sourceTheme: string;
  suggestions: ThemeSeance[];
  themesDeDomaine: ThemeSeance[];
  themesDeCompetence: ThemeSeance[];
  surChoisirTheme: (theme: ThemeSeance | null) => void;
  temps: string;
  setTemps: (v: string) => void;
  conseil: ReturnType<typeof nombreExercicesConseille>;
  intention: string;
  setIntention: (v: string) => void;
  intentionOuverte: boolean;
  setIntentionOuverte: (v: boolean) => void;
  erreur: string | null;
}) {
  // Déclarés avant toute sortie anticipée : l'ordre des hooks ne se négocie pas.
  const [choixOuvert, setChoixOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");

  const q = recherche.trim().toLowerCase();
  /*
   * La recherche ne porte que sur les compétences : les trois autres listes
   * sont courtes et se lisent d'un coup d'œil, là où le référentiel actif peut
   * compter des dizaines d'entrées. Sans filtre, choisir une compétence précise
   * redeviendrait l'inventaire à trier que cet écran a supprimé.
   */
  const competencesFiltrees = q
    ? themesDeCompetence
        .filter(
          (t) =>
            t.libelle.toLowerCase().includes(q) || t.detail.toLowerCase().includes(q),
        )
        .slice(0, 12)
    : [];

  if (!themePrincipal) {
    return (
      <div className="space-y-3 pt-2">
        <Carte>
          <div className="px-4 py-8 text-center">
            <p className="text-sm font-medium">Aucun thème à proposer</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-texte-attenue">
              Le moteur n&apos;a rien à recommander : soit le référentiel est vide, soit
              toutes les compétences actives ont été écartées récemment.
            </p>
          </div>
        </Carte>
      </div>
    );
  }

  return (
    <div className="space-y-5 pt-2">
      {/* Hero Card thématique */}
      <div className="rounded-xl border border-primaire/30 bg-gradient-to-br from-surface to-surface-2 p-4 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-primaire-faible px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-primaire">
            {sourceTheme}
          </span>
        </div>
        <h3 className="mt-2 text-base font-semibold tracking-tight text-texte">
              {themePrincipal.libelle}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-texte-attenue">
          {themePrincipal.detail}
        </p>
        <button
          type="button"
          onClick={() => setChoixOuvert((ouvert) => !ouvert)}
          className="mt-2 text-xs text-primaire underline-offset-2 hover:underline"
          aria-expanded={choixOuvert}
        >
          {choixOuvert
            ? "Garder ce sujet"
            : sourceTheme === "Aucun sujet imposé"
              ? "Choisir un sujet"
              : "Choisir un autre sujet"}
        </button>
      </div>

      {choixOuvert && (
        <div className="space-y-4 rounded-xl border border-bordure bg-surface-2 p-4">
          <ListeSujets
            titre="Ce que le moteur recommande"
            sujets={suggestions}
            actif={themePrincipal.cle}
            surChoisir={(theme) => {
              surChoisirTheme(theme);
              setChoixOuvert(false);
            }}
          />
          <ListeSujets
            titre="Un domaine entier"
            sujets={themesDeDomaine}
            actif={themePrincipal.cle}
            surChoisir={(theme) => {
              surChoisirTheme(theme);
              setChoixOuvert(false);
            }}
          />
          <div className="space-y-2">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
              Une compétence précise
            </p>
            <input
              type="search"
              value={recherche}
              onChange={(event) => setRecherche(event.target.value)}
              placeholder="Filtrer par intitulé ou par code…"
              className="w-full rounded-md border border-bordure-controle bg-surface px-2.5 py-1.5 text-xs placeholder:text-texte-discret focus:border-primaire focus:outline-none"
            />
            {q && competencesFiltrees.length === 0 && (
              <p className="text-xs text-texte-discret">
                Aucune compétence active ne correspond.
              </p>
            )}
            {competencesFiltrees.length > 0 && (
              <div className="space-y-1.5">
                {competencesFiltrees.map((sujet) => (
                  <BoutonSujet
                    key={sujet.cle}
                    sujet={sujet}
                    actif={sujet.cle === themePrincipal.cle}
                    surChoisir={(theme) => {
                      surChoisirTheme(theme);
                      setChoixOuvert(false);
                      setRecherche("");
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sélection du temps */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
            Temps disponible pour la séance
          </label>
          <span className="text-xs font-mono font-medium text-primaire">
            {temps} minutes
          </span>
        </div>

        {/* Puces de presets rapides */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { temps: 15, titre: "15 min", badge: "Express" },
            { temps: 30, titre: "30 min", badge: "Équilibré" },
            { temps: 45, titre: "45 min", badge: "Approfondi" },
            { temps: 60, titre: "60 min", badge: "Standard" },
          ].map((preset) => {
            const actif = temps === String(preset.temps);
            return (
              <button
                key={preset.temps}
                type="button"
                onClick={() => setTemps(String(preset.temps))}
                className={cx(
                  "flex flex-col items-center justify-center rounded-xl border p-2.5 transition-all cursor-pointer text-center",
                  actif
                    ? "border-primaire bg-primaire-faible/70 text-primaire ring-1 ring-primaire shadow-xs font-semibold"
                    : "border-bordure bg-surface hover:bg-surface-2 text-texte-attenue hover:text-texte",
                )}
              >
                <span className="text-xs font-bold">
                  {preset.titre}
                </span>
                <span className="mt-0.5 text-[0.625rem] text-texte-discret">
                  {preset.badge}
                </span>
              </button>
            );
          })}
        </div>

        <Champ
          label="Durée personnalisée (minutes)"
          type="number"
          min={DUREE_ESTIMEE_MIN}
          max={TEMPS_DECLARE_MAX}
          value={temps}
          onChange={(e) => setTemps(e.target.value)}
          aide={
            conseil
              ? conseil.explication
              : "Aucune durée de référence observée : vous fixerez le nombre d'exercices à l'étape suivante."
          }
        />
      </div>

      {/* Intention facultative */}
      {intentionOuverte ? (
        <div className="rounded-xl border border-bordure bg-surface p-3.5 shadow-xs">
          <Champ
            label="Pourquoi cette séance ? (facultatif)"
            multiligne
            formules
            rows={2}
            value={intention}
            onChange={(e) => setIntention(e.target.value)}
            placeholder="Ex. : Révision avant l'examen de vendredi, focus sur les biais..."
            aide="Conservée telle quelle dans votre journal de travail."
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIntentionOuverte(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-primaire hover:underline cursor-pointer"
        >
          <span>+</span>
          <span>Ajouter une note d&apos;intention (facultatif)</span>
        </button>
      )}

      {erreur && (
        <BandeauInfo ton="danger" taille="compacte">
          <p className="text-xs text-danger">{erreur}</p>
        </BandeauInfo>
      )}
    </div>
  );
}
