"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { modifierProfil } from "@/lib/store/referentiel-actions";
import { BandeauInfo, Bouton, cx } from "@/components/ui/primitives";
import { Champ } from "@/components/ui/champ";
import { ModaleReferentiel } from "@/components/referentiel/modale-referentiel";
import { IconeFleche } from "@/components/ui/icones";
import { ReglagesTuteur } from "@/components/tuteur/reglages-tuteur";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";
import { DemarrerTour } from "@/components/onboarding/demarrer-tour";

interface ExempleSujet {
  label: string;
  emoji: string;
  sujet: string;
  objectif: string;
  pointDeDepart?: string;
  preferences?: string[];
}

const PREFERENCES_SUGGESTIONS = [
  { label: "Pratique & Code d'abord", emoji: "💻" },
  { label: "Cas concrets métier", emoji: "🎯" },
  { label: "Explications pas-à-pas", emoji: "🪜" },
  { label: "Rigueur théorique & Fondations", emoji: "📚" },
  { label: "Format synthétique & Rapide", emoji: "⚡" },
  { label: "Questions & Feedback réguliers", emoji: "🔄" },
];

const EXEMPLES: ExempleSujet[] = [
  {
    emoji: "💻",
    label: "Développement Web",
    sujet: "Développement Web moderne (TypeScript, React, Next.js, API, bases de données)",
    objectif: "Concevoir et déployer des applications web complètes et robustes de bout en bout",
    pointDeDepart: "Notions de JavaScript / autodidacte",
    preferences: ["Pratique & Code d'abord", "Cas concrets métier"],
  },
  {
    emoji: "⚖️",
    label: "Droit & Fiscalité",
    sujet: "Droit des affaires, des contrats et optimisation fiscale",
    objectif: "Rédiger et analyser des contrats commerciaux et sécuriser des opérations sans risque juridique",
    pointDeDepart: "Débutant en droit commercial",
    preferences: ["Cas concrets métier", "Explications pas-à-pas"],
  },
  {
    emoji: "🇬🇧",
    label: "Anglais professionnel",
    sujet: "Anglais professionnel, communication en entreprise et négociation internationale",
    objectif: "Animer des réunions, argumenter et négocier avec aisance avec des interlocuteurs anglophones",
    pointDeDepart: "Niveau intermédiaire (B1/B2)",
    preferences: ["Pratique & Code d'abord", "Format synthétique & Rapide"],
  },
  {
    emoji: "📊",
    label: "Data & IA appliquée",
    sujet: "Analyse de données, Python pour la data et modèles de Machine Learning",
    objectif: "Extraire des enseignements de jeux de données complexes et modéliser des prédictions métier",
    pointDeDepart: "Bases en programmation ou statistiques",
    preferences: ["Pratique & Code d'abord", "Cas concrets métier"],
  },
  {
    emoji: "📐",
    label: "Mathématiques",
    sujet: "Algèbre linéaire, analyse réelle et probabilités appliquées",
    objectif: "Résoudre des problèmes complexes et préparer des concours techniques",
    pointDeDepart: "Niveau scientifique / prépa",
    preferences: ["Rigueur théorique & Fondations", "Explications pas-à-pas"],
  },
  {
    emoji: "🎸",
    label: "Musique & MAO",
    sujet: "Harmonie musicale, composition, mixage et production sur DAW",
    objectif: "Composer et finaliser des morceaux musicaux cohérents et masterisés",
    pointDeDepart: "Pratique instrumentale autonome",
    preferences: ["Pratique & Code d'abord", "Format synthétique & Rapide"],
  },
];

export function FormulaireAmorcage({
  objectifMoyenTerme,
  objectifLongTerme,
  compteId,
}: {
  objectifMoyenTerme: string;
  objectifLongTerme: string;
  compteId: string;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [validationOuverte, setValidationOuverte] = useState(false);

  const [sujet, setSujet] = useState("");
  const [objectif, setObjectif] = useState(objectifMoyenTerme);
  const [pointDeDepart, setPointDeDepart] = useState("");
  const [preferencesChoisies, setPreferencesChoisies] = useState<string[]>([
    "Pratique & Code d'abord",
    "Cas concrets métier",
  ]);
  const [cleConfiguree, setCleConfiguree] = useState(() => Boolean(lireConfigTuteur(compteId)));
  const [panneauCleOuvert, setPanneauCleOuvert] = useState(false);

  const sujetValide = sujet.trim().length > 2;
  const objectifValide = objectif.trim().length > 2;
  const pret = sujetValide && objectifValide;

  function choisirExemple(ex: ExempleSujet) {
    setSujet(ex.sujet);
    setObjectif(ex.objectif);
    if (ex.pointDeDepart) setPointDeDepart(ex.pointDeDepart);
    if (ex.preferences) setPreferencesChoisies(ex.preferences);
  }

  function basculerPreference(pref: string) {
    setPreferencesChoisies((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref],
    );
  }

  function soumettre() {
    setErreur(null);
    demarrer(async () => {
      try {
        await modifierProfil({
          objectifMoyenTerme: objectif,
          objectifLongTerme: objectifLongTerme || undefined,
          formation: pointDeDepart.trim() || undefined,
          preferencesPedagogiques: preferencesChoisies,
        });
        setValidationOuverte(true);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* En-tête guidé pas-à-pas */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-bordure/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-primaire/15 px-2.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-primaire">
            Étape 1 sur 2 · Ton axe d&apos;apprentissage
          </span>
        </div>
        <span className="text-xs text-texte-discret">Configuration initiale en 2 min</span>
      </div>

      {/* État de la clé IA */}
      <div
        data-tour="cle-ia"
        className="rounded-xl border border-bordure bg-surface px-4 py-3 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={cx(
                "size-2 rounded-full",
                cleConfiguree ? "bg-succes" : "bg-avertissement",
              )}
            />
            <span className="text-xs font-medium text-texte">
              {cleConfiguree
                ? "Clé IA configurée (prête à générer)"
                : "Clé IA non configurée (Mistral, Groq gratuit, Anthropic)"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPanneauCleOuvert((v) => !v)}
            className="text-xs font-medium text-primaire hover:underline"
          >
            {panneauCleOuvert ? "Fermer les réglages" : cleConfiguree ? "Modifier la clé" : "Renseigner ma clé IA"}
          </button>
        </div>

        {panneauCleOuvert && (
          <div className="mt-3 border-t border-bordure/60 pt-3">
            <ReglagesTuteur
              compteId={compteId}
              compact
              surEnregistre={() => {
                setCleConfiguree(true);
                setPanneauCleOuvert(false);
              }}
            />
          </div>
        )}
      </div>

      {/* Chips d'exemples d'inspiration */}
      <div
        data-tour="exemples-inspiration"
        className="rounded-xl border border-bordure/80 bg-surface-2/60 p-4"
      >
        <p className="text-xs font-medium text-texte mb-2 flex items-center gap-1.5">
          <span>💡 Exemples d&apos;inspiration (remplissage en 1 clic) :</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {EXEMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => choisirExemple(ex)}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all shadow-xs",
                sujet === ex.sujet
                  ? "border-primaire bg-primaire/15 text-primaire"
                  : "border-bordure bg-surface text-texte-attenue hover:border-primaire/40 hover:text-texte hover:bg-surface-2",
              )}
            >
              <span>{ex.emoji}</span>
              <span>{ex.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Formulaire avec indicateurs d'étapes */}
      <div className="space-y-5">
        <div className="relative">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-texte flex items-center gap-1.5">
              <span className="flex size-5 items-center justify-center rounded-full bg-surface-2 border border-bordure text-[0.6875rem] font-mono">
                1
              </span>
              Le sujet à maîtriser
            </span>
            {sujetValide && (
              <span className="text-xs font-medium text-primaire flex items-center gap-1">
                ✓ Prêt
              </span>
            )}
          </div>
          <Champ
            label=""
            value={sujet}
            onChange={(e) => setSujet(e.target.value)}
            placeholder="Ex : développement web, droit fiscal, lutherie, philosophie morale…"
            aide="Écris-le avec tes propres mots. Le tuteur IA le découpera ensuite en compétences mesurables."
          />
        </div>

        <div className="relative">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-texte flex items-center gap-1.5">
              <span className="flex size-5 items-center justify-center rounded-full bg-surface-2 border border-bordure text-[0.6875rem] font-mono">
                2
              </span>
              Pour quoi faire (ton objectif concret)
            </span>
            {objectifValide && (
              <span className="text-xs font-medium text-primaire flex items-center gap-1">
                ✓ Prêt
              </span>
            )}
          </div>
          <Champ
            label=""
            value={objectif}
            onChange={(e) => setObjectif(e.target.value)}
            placeholder="Ex : préparer un concours, changer de métier, mener un projet en autonomie…"
            aide="Permet de calibrer l'importance de chaque compétence selon ton ambition réelle."
          />
        </div>

        {/* Section 3 : Style d'apprentissage et point de départ */}
        <div
          data-tour="style-apprentissage"
          className="relative rounded-xl border border-bordure/80 bg-surface-2/40 p-4 space-y-3.5 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-texte flex items-center gap-1.5">
              <span className="flex size-5 items-center justify-center rounded-full bg-surface border border-bordure text-[0.6875rem] font-mono">
                3
              </span>
              Ton style d&apos;apprentissage (calibrage direct du tuteur IA)
            </span>
            <span className="text-[0.6875rem] text-texte-discret">
              Optionnel · Sélection en 1 clic
            </span>
          </div>

          <div>
            <label className="text-[0.6875rem] font-medium text-texte-attenue mb-1.5 block">
              Comment préfères-tu apprendre ?
            </label>
            <div className="flex flex-wrap gap-2">
              {PREFERENCES_SUGGESTIONS.map((pref) => {
                const selectionne = preferencesChoisies.includes(pref.label);
                return (
                  <button
                    key={pref.label}
                    type="button"
                    onClick={() => basculerPreference(pref.label)}
                    className={cx(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all shadow-xs",
                      selectionne
                        ? "border-primaire bg-primaire/15 text-primaire font-semibold ring-1 ring-primaire/30"
                        : "border-bordure bg-surface text-texte-attenue hover:border-primaire/40 hover:text-texte hover:bg-surface-2",
                    )}
                  >
                    <span>{pref.emoji}</span>
                    <span>{pref.label}</span>
                    {selectionne && <span className="text-[0.625rem] font-bold">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Champ
              label="Ton point de départ / contexte (facultatif)"
              value={pointDeDepart}
              onChange={(e) => setPointDeDepart(e.target.value)}
              placeholder="Ex : débutant complet, autodidacte, reconversion, junior, étudiant..."
              aide="Transmis au tuteur pour qu'il adapte son vocabulaire et ses analogies sans inventer de diplôme."
            />
          </div>
        </div>
      </div>

      {erreur && (
        <BandeauInfo ton="alerte" taille="compacte">
          <p className="text-alerte">{erreur}</p>
        </BandeauInfo>
      )}

      {/* Bouton d'action interactif */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-bordure/60">
        <div className="flex items-center gap-3">
          <Bouton
            onClick={soumettre}
            disabled={!pret || enCours}
            variante="principal"
            className={cx(
              "group px-5 py-2.5 shadow-md transition-all",
              pret && "ring-2 ring-primaire/30",
            )}
          >
            <span>{enCours ? "Génération en cours…" : "Générer mon référentiel avec l'IA"}</span>
            <IconeFleche className="size-3.5 transition-transform group-hover:translate-x-1" />
          </Bouton>

          {!pret && (
            <span className="text-xs text-texte-discret">
              Remplis le sujet et l&apos;objectif pour continuer.
            </span>
          )}
        </div>

        <span className="text-xs text-texte-discret">
          Rien n&apos;est enregistré sans ta validation.
        </span>
      </div>

      {validationOuverte && (
        <ModaleReferentiel
          compteId={compteId}
          sujetInitial={sujet.trim()}
          demarrageAutomatique
          guideEtape="Étape 2 sur 2 : Relis les compétences découpées par le tuteur. Tu peux en décocher ou valider directement pour lancer ton Tableau de bord !"
          onFermer={() => setValidationOuverte(false)}
          surEnregistre={() => router.replace("/")}
        />
      )}

      {/* Visite guidée dynamique pour /demarrer */}
      <DemarrerTour />
    </div>
  );
}
