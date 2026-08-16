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

interface ExempleSujet {
  label: string;
  emoji: string;
  sujet: string;
  objectif: string;
}

const EXEMPLES: ExempleSujet[] = [
  {
    emoji: "💻",
    label: "Développement Web",
    sujet: "Développement Web moderne (TypeScript, React, Next.js, API, bases de données)",
    objectif: "Concevoir et déployer des applications web complètes et robustes de bout en bout",
  },
  {
    emoji: "⚖️",
    label: "Droit & Fiscalité",
    sujet: "Droit des affaires, des contrats et optimisation fiscale",
    objectif: "Rédiger et analyser des contrats commerciaux et sécuriser des opérations sans risque juridique",
  },
  {
    emoji: "🇬🇧",
    label: "Anglais professionnel",
    sujet: "Anglais professionnel, communication en entreprise et négociation internationale",
    objectif: "Animer des réunions, argumenter et négocier avec aisance avec des interlocuteurs anglophones",
  },
  {
    emoji: "📊",
    label: "Data & IA appliquée",
    sujet: "Analyse de données, Python pour la data et modèles de Machine Learning",
    objectif: "Extraire des enseignements de jeux de données complexes et modéliser des prédictions métier",
  },
  {
    emoji: "📐",
    label: "Mathématiques",
    sujet: "Algèbre linéaire, analyse réelle et probabilités appliquées",
    objectif: "Résoudre des problèmes complexes et préparer des concours techniques",
  },
  {
    emoji: "🎸",
    label: "Musique & MAO",
    sujet: "Harmonie musicale, composition, mixage et production sur DAW",
    objectif: "Composer et finaliser des morceaux musicaux cohérents et masterisés",
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
  const [cleConfiguree, setCleConfiguree] = useState(() => Boolean(lireConfigTuteur(compteId)));
  const [panneauCleOuvert, setPanneauCleOuvert] = useState(false);

  const sujetValide = sujet.trim().length > 2;
  const objectifValide = objectif.trim().length > 2;
  const pret = sujetValide && objectifValide;

  function choisirExemple(ex: ExempleSujet) {
    setSujet(ex.sujet);
    setObjectif(ex.objectif);
  }

  function soumettre() {
    setErreur(null);
    demarrer(async () => {
      try {
        await modifierProfil({
          objectifMoyenTerme: objectif,
          objectifLongTerme: objectifLongTerme || undefined,
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
      <div className="rounded-xl border border-bordure bg-surface px-4 py-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={cx(
                "size-2 rounded-full",
                cleConfiguree ? "bg-succes" : "bg-avertissement animate-pulse",
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
      <div className="rounded-xl border border-bordure/80 bg-surface-2/60 p-4">
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
              pret && "ring-2 ring-primaire/30 animate-pulse",
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
    </div>
  );
}
