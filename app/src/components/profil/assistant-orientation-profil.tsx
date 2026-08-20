"use client";

import { useState } from "react";
import {
  NIVEAUX_DEPART,
  PREFERENCES_APPRENTISSAGE,
  SUGGESTIONS_DOMAINES,
  synthetiserProfilDeterministe,
  type ProfilSynthetise,
  type ReponsesOrientation,
} from "@/lib/domain/assistant-orientation";
import { Bouton, cx } from "@/components/ui/primitives";
import { Champ } from "@/components/ui/champ";
import {
  IconeAmpoule,
  IconeFermer,
  IconeFleche,
  IconeValide,
} from "@/components/ui/icones";

interface PropsAssistantOrientation {
  sujetInitial?: string;
  formationInitiale?: string;
  preferencesInitiales?: string[];
  surSyntheseAppliquee: (profil: ProfilSynthetise) => void;
  onFermer?: () => void;
  modeModale?: boolean;
}

export function AssistantOrientationProfil({
  sujetInitial = "",
  formationInitiale = "",
  preferencesInitiales = [],
  surSyntheseAppliquee,
  onFermer,
  modeModale = false,
}: PropsAssistantOrientation) {
  const [etape, setEtape] = useState<1 | 2 | 3 | 4>(1);

  const [sujet, setSujet] = useState(sujetInitial);
  const [niveauId, setNiveauId] = useState<string>("debutant");
  const [pointDeDepartCustom, setPointDeDepartCustom] = useState(formationInitiale);
  const [preferencesChoisies, setPreferencesChoisies] = useState<string[]>(
    preferencesInitiales.length > 0
      ? preferencesInitiales
      : ["Pratiquer d'abord", "Des cas concrets"],
  );
  const [rythmeHeures, setRythmeHeures] = useState(2);

  const [syntheseApercu, setSyntheseApercu] = useState<ProfilSynthetise | null>(null);

  function basculerPreference(libelle: string) {
    setPreferencesChoisies((prev) =>
      prev.includes(libelle)
        ? prev.filter((p) => p !== libelle)
        : [...prev, libelle],
    );
  }

  function appliquerSuggestionDomaine(domaine: {
    sujetExemple: string;
    objectifExemple: string;
  }) {
    setSujet(domaine.sujetExemple);
  }

  function passerEtapeSuivante() {
    if (etape === 1) {
      if (!sujet.trim()) return;
      setEtape(2);
    } else if (etape === 2) {
      setEtape(3);
    } else if (etape === 3) {
      const reponses: ReponsesOrientation = {
        sujet: sujet.trim(),
        niveauId,
        pointDeDepartPersonnalise: pointDeDepartCustom.trim() || undefined,
        preferencesChoisies,
        rythmeHebdoHeures: rythmeHeures,
      };
      const resultat = synthetiserProfilDeterministe(reponses);
      setSyntheseApercu(resultat);
      setEtape(4);
    }
  }

  function validerEtAppliquer() {
    if (syntheseApercu) {
      surSyntheseAppliquee(syntheseApercu);
      if (onFermer) onFermer();
    }
  }

  const contenu = (
    <div className="space-y-6">
      {/* En-tête avec progression */}
      <div className="border-b border-bordure/70 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-primaire/15 text-xs font-semibold text-primaire">
              {etape <= 3 ? etape : 3}/3
            </span>
            <h3 className="text-sm font-semibold text-texte">
              {etape === 1 && "Étape 1 · Votre axe d'apprentissage"}
              {etape === 2 && "Étape 2 · Votre point de départ actuel"}
              {etape === 3 && "Étape 3 · Votre méthode et vos préférences"}
              {etape === 4 && "Synthèse et validation de votre profil"}
            </h3>
          </div>
          {onFermer && (
            <button
              type="button"
              onClick={onFermer}
              className="rounded-lg p-1 text-texte-discret hover:bg-surface-2 hover:text-texte"
              aria-label="Fermer le diagnostic"
            >
              <IconeFermer className="size-4" />
            </button>
          )}
        </div>

        {/* Barre de progression */}
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <div
            className={cx(
              "h-1 rounded-full transition-all",
              etape >= 1 ? "bg-primaire" : "bg-bordure/40",
            )}
          />
          <div
            className={cx(
              "h-1 rounded-full transition-all",
              etape >= 2 ? "bg-primaire" : "bg-bordure/40",
            )}
          />
          <div
            className={cx(
              "h-1 rounded-full transition-all",
              etape >= 3 ? "bg-primaire" : "bg-bordure/40",
            )}
          />
        </div>
      </div>

      {/* Étape 1 : Le sujet */}
      {etape === 1 && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-texte mb-1.5 block">
              Quel sujet ou domaine souhaitez-vous maîtriser ?
            </label>
            <Champ
              label=""
              value={sujet}
              onChange={(e) => setSujet(e.target.value)}
              placeholder="Ex : Architecture React & TypeScript, Droit fiscal, Négociation commerciale, Analyse de données…"
              aide="Écrivez-le simplement. Le système calibrera le parcours et le découpage à partir de cet intitulé."
            />
          </div>

          <div className="rounded-xl border border-bordure/70 bg-surface-2/40 p-3.5 space-y-2.5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-texte-attenue">
              <IconeAmpoule className="size-3.5 text-primaire" />
              <span>Ou choisissez un exemple pour démarrer en un clic :</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS_DOMAINES.map((dom) => (
                <button
                  key={dom.id}
                  type="button"
                  onClick={() => appliquerSuggestionDomaine(dom)}
                  className={cx(
                    "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all shadow-xs",
                    sujet === dom.sujetExemple
                      ? "border-primaire bg-primaire/15 text-primaire font-semibold"
                      : "border-bordure bg-surface text-texte-attenue hover:border-primaire/40 hover:text-texte hover:bg-surface-2",
                  )}
                >
                  {dom.nom}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Étape 2 : Niveau et point de départ */}
      {etape === 2 && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-texte mb-1 block">
              Où en êtes-vous aujourd&apos;hui sur ce sujet ?
            </label>
            <p className="text-xs text-texte-attenue mb-3">
              Permet d&apos;adapter le vocabulaire du tuteur sans supposer de diplôme.
            </p>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {NIVEAUX_DEPART.map((n) => {
                const estChoisi = niveauId === n.id;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setNiveauId(n.id)}
                    className={cx(
                      "flex flex-col items-start rounded-xl border p-3 text-left transition-all shadow-xs",
                      estChoisi
                        ? "border-primaire bg-primaire/10 ring-1 ring-primaire/30"
                        : "border-bordure bg-surface hover:border-primaire/40 hover:bg-surface-2/60",
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-texte">{n.titre}</span>
                      {estChoisi && <IconeValide className="size-3.5 text-primaire" />}
                    </div>
                    <span className="mt-1 text-[0.75rem] leading-relaxed text-texte-attenue">
                      {n.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2">
            <Champ
              label="Précision sur votre parcours (facultatif)"
              value={pointDeDepartCustom}
              onChange={(e) => setPointDeDepartCustom(e.target.value)}
              placeholder="Ex : Ancien développeur PHP en reconversion, étudiant en 2e année de droit…"
            />
          </div>
        </div>
      )}

      {/* Étape 3 : Méthode & Rythme */}
      {etape === 3 && (
        <div className="space-y-5">
          <div>
            <label className="text-xs font-semibold text-texte mb-1 block">
              Comment préférez-vous vous entraîner ?
            </label>
            <p className="text-xs text-texte-attenue mb-2.5">
              Sélectionnez les formats et consignes que le tuteur doit respecter.
            </p>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PREFERENCES_APPRENTISSAGE.map((p) => {
                const estActif = preferencesChoisies.includes(p.libelle);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => basculerPreference(p.libelle)}
                    className={cx(
                      "flex flex-col items-start rounded-xl border p-3 text-left transition-all shadow-xs",
                      estActif
                        ? "border-primaire bg-primaire/10 ring-1 ring-primaire/30"
                        : "border-bordure bg-surface hover:border-primaire/40 hover:bg-surface-2/60",
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-texte">{p.libelle}</span>
                      {estActif && <IconeValide className="size-3.5 text-primaire" />}
                    </div>
                    <span className="mt-1 text-[0.75rem] leading-relaxed text-texte-attenue">
                      {p.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-bordure/70 bg-surface-2/30 p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-texte block">
                  Rythme hebdomadaire souhaité
                </span>
                <span className="text-[0.75rem] text-texte-attenue">
                  Volume indicatif pour préparer votre premier parcours.
                </span>
              </div>
              <span className="rounded-lg bg-surface border border-bordure px-2.5 py-1 text-xs font-mono font-semibold text-primaire">
                {rythmeHeures}h / sem.
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={rythmeHeures}
              onChange={(e) => setRythmeHeures(Number(e.target.value))}
              className="mt-3 w-full accent-primaire cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Étape 4 : Aperçu de synthèse */}
      {etape === 4 && syntheseApercu && (
        <div className="space-y-4">
          <div className="rounded-xl border border-succes/30 bg-succes-faible/10 p-4 space-y-3">
            <div className="flex items-center gap-2 text-succes">
              <IconeValide className="size-4 shrink-0" />
              <span className="text-xs font-semibold">
                Votre profil d&apos;apprentissage est formulé !
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="rounded-lg bg-surface p-3 border border-bordure/60">
                <span className="font-semibold text-texte block mb-0.5">Intention de départ</span>
                <p className="text-texte-attenue leading-relaxed">
                  {syntheseApercu.intentionDeDepart}
                </p>
              </div>

              <div className="rounded-lg bg-surface p-3 border border-bordure/60">
                <span className="font-semibold text-texte block mb-0.5">Point de départ</span>
                <p className="text-texte-attenue leading-relaxed">
                  {syntheseApercu.formation}
                </p>
              </div>

              <div className="rounded-lg bg-surface p-3 border border-bordure/60">
                <span className="font-semibold text-texte block mb-1">Préférences retenues</span>
                <div className="flex flex-wrap gap-1">
                  {syntheseApercu.preferencesPedagogiques.map((pref) => (
                    <span
                      key={pref}
                      className="inline-flex items-center rounded-md bg-surface-2 border border-bordure px-2 py-0.5 text-[0.6875rem] font-medium text-texte"
                    >
                      {pref}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions de navigation */}
      <div className="flex items-center justify-between pt-3 border-t border-bordure/70">
        <div>
          {etape > 1 && (
            <Bouton
              type="button"
              onClick={() => setEtape((e) => (e - 1) as 1 | 2 | 3)}
              variante="secondaire"
              taille="compacte"
            >
              Retour
            </Bouton>
          )}
        </div>

        <div className="flex items-center gap-2">
          {etape < 4 ? (
            <Bouton
              type="button"
              onClick={passerEtapeSuivante}
              disabled={etape === 1 && !sujet.trim()}
              variante="principal"
              taille="normale"
              className="group"
            >
              <span>{etape === 3 ? "Synthétiser mon profil" : "Suivant"}</span>
              <IconeFleche className="size-3.5 transition-transform group-hover:translate-x-1" />
            </Bouton>
          ) : (
            <Bouton
              type="button"
              onClick={validerEtAppliquer}
              variante="principal"
              taille="normale"
              className="shadow-md"
            >
              <IconeValide className="size-3.5" />
              <span>Appliquer et enregistrer mon profil</span>
            </Bouton>
          )}
        </div>
      </div>
    </div>
  );

  if (modeModale) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center bg-noir/40 backdrop-blur-xs p-4"
      >
        <div className="w-full max-w-xl rounded-2xl border border-bordure bg-surface p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
          {contenu}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-bordure bg-surface p-5 sm:p-6 shadow-sm">
      {contenu}
    </div>
  );
}
