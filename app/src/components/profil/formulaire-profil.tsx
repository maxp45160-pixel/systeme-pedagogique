"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { modifierProfil } from "@/lib/store/referentiel-actions";
import { BandeauInfo, Bouton, Etiquette, cx } from "@/components/ui/primitives";
import { Champ } from "@/components/ui/champ";
import { IconeAmpoule, IconeValide } from "@/components/ui/icones";
import { AssistantOrientationProfil } from "./assistant-orientation-profil";
import type { ProfilSynthetise } from "@/lib/domain/assistant-orientation";

const PREFIXE_FAMILLE = "adaptive:family:";

const PREFERENCES_SUGGESTIONS = [
  { label: "Pratiquer d'abord" },
  { label: "Des cas concrets" },
  { label: "Pas à pas" },
  { label: "Les fondations d'abord" },
  { label: "Court et rapide" },
  { label: "Beaucoup de questions" },
];

export function FormulaireProfil({
  formation,
  objectifMoyenTerme,
  objectifLongTerme,
  preferencesPedagogiques,
  plan,
}: {
  formation: string;
  objectifMoyenTerme: string;
  objectifLongTerme: string;
  preferencesPedagogiques: string[];
  plan?: string;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ton: "info" | "alerte"; texte: string } | null>(null);
  const [assistantOuvert, setAssistantOuvert] = useState(false);

  const [form, setForm] = useState(formation);
  const [moyen, setMoyen] = useState(objectifMoyenTerme);
  const [long, setLong] = useState(objectifLongTerme);
  const [prefs, setPrefs] = useState(
    preferencesPedagogiques.filter((p) => !p.startsWith(PREFIXE_FAMILLE)).join("\n"),
  );
  const [planState, setPlanState] = useState(plan ?? "");

  const lignesPrefs = prefs
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const estRenseigne = Boolean(moyen.trim() || form.trim() || lignesPrefs.length > 0);

  function basculerSuggestion(label: string) {
    if (lignesPrefs.includes(label)) {
      setPrefs(lignesPrefs.filter((l) => l !== label).join("\n"));
    } else {
      setPrefs([...lignesPrefs, label].join("\n"));
    }
  }

  function appliquerSyntheseAssistant(profil: ProfilSynthetise) {
    if (profil.formation) setForm(profil.formation);
    if (profil.objectifMoyenTerme) setMoyen(profil.objectifMoyenTerme);
    if (profil.objectifLongTerme) setLong(profil.objectifLongTerme);
    if (profil.preferencesPedagogiques.length > 0) {
      setPrefs(profil.preferencesPedagogiques.join("\n"));
    }
    if (profil.plan) setPlanState(profil.plan);
    setAssistantOuvert(false);
    setMessage({
      ton: "info",
      texte: "Profil pré-rempli par le diagnostic. Cliquez sur « Enregistrer » pour valider.",
    });
  }

  function enregistrer() {
    setMessage(null);
    demarrer(async () => {
      try {
        await modifierProfil({
          formation: form,
          objectifMoyenTerme: moyen,
          objectifLongTerme: long,
          preferencesPedagogiques: prefs.split("\n"),
          plan: planState,
        });
        setMessage({ ton: "info", texte: "Profil enregistré avec succès." });
        router.refresh();
      } catch (e) {
        setMessage({
          ton: "alerte",
          texte: e instanceof Error ? e.message : "Enregistrement impossible.",
        });
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* En-tête du profil avec statut & déclencheur diagnostic */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bordure/60 pb-4">
        <div className="flex items-center gap-2.5">
          <div>
            <h3 className="text-sm font-semibold text-texte">Objectifs & Méthode pédagogique</h3>
            <p className="text-xs text-texte-attenue">
              Définit le calibrage des compétences, le style du tuteur et votre feuille de route.
            </p>
          </div>
          <Etiquette ton={estRenseigne ? "succes" : "info"} className="ml-1">
            {estRenseigne ? "Renseigné" : "À compléter"}
          </Etiquette>
        </div>

        <Bouton
          type="button"
          onClick={() => setAssistantOuvert(true)}
          variante="secondaire"
          taille="compacte"
          className="gap-1.5 shadow-xs"
        >
          <IconeAmpoule className="size-3.5 text-primaire" />
          <span>Diagnostic express (3 questions)</span>
        </Bouton>
      </div>

      {assistantOuvert && (
        <AssistantOrientationProfil
          sujetInitial={moyen || ""}
          formationInitiale={form}
          preferencesInitiales={lignesPrefs}
          surSyntheseAppliquee={appliquerSyntheseAssistant}
          onFermer={() => setAssistantOuvert(false)}
          modeModale
        />
      )}

      {/* 1. Objectifs */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Champ
            label="Objectif à moyen terme"
            value={moyen}
            onChange={(e) => setMoyen(e.target.value)}
            placeholder="Ex : Réaliser des applications web autonomes, réussir un concours…"
            aide="Référence centrale pour calibrer l'importance des compétences."
          />

          <Champ
            label="Objectif à long terme (facultatif)"
            value={long}
            onChange={(e) => setLong(e.target.value)}
            placeholder="Ex : Devenir architecte technique, changer de métier…"
            aide="L'horizon final si déjà défini."
          />
        </div>

        <Champ
          label="Formation ou point de départ"
          value={form}
          onChange={(e) => setForm(e.target.value)}
          placeholder="Ex : Autodidacte avec bases en JavaScript, reconversion, junior…"
          aide="Contexte transmis au tuteur pour ajuster son vocabulaire (aucun niveau n'en est déduit)."
        />
      </div>

      {/* 2. Préférences & Style d'entraînement */}
      <div className="border-t border-bordure/60 pt-4 space-y-3">
        <div>
          <label className="text-xs font-semibold text-texte block mb-1.5">
            Préférences pédagogiques (sélection rapide)
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {PREFERENCES_SUGGESTIONS.map((sug) => {
              const active = lignesPrefs.includes(sug.label);
              return (
                <button
                  key={sug.label}
                  type="button"
                  onClick={() => basculerSuggestion(sug.label)}
                  className={cx(
                    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all shadow-xs",
                    active
                      ? "border-primaire bg-primaire/15 text-primaire font-semibold ring-1 ring-primaire/30"
                      : "border-bordure bg-surface text-texte-attenue hover:border-primaire/40 hover:text-texte hover:bg-surface-2",
                  )}
                >
                  <span>{sug.label}</span>
                  {active && <IconeValide className="size-3" />}
                </button>
              );
            })}
          </div>
        </div>

        <Champ
          multiligne
          label="Consignes spécifiques pour le tuteur (une par ligne)"
          value={prefs}
          onChange={(e) => setPrefs(e.target.value)}
          rows={2}
          placeholder={"Reformuler avant de corriger.\nPartir d'un cas concret plutôt que de la théorie."}
          className="resize-y font-mono text-xs"
        />
      </div>

      {/* 3. Plan de travail */}
      <div className="border-t border-bordure/60 pt-4 space-y-3">
        <Champ
          multiligne
          label="Plan de travail (facultatif)"
          value={planState}
          onChange={(e) => setPlanState(e.target.value)}
          rows={3}
          placeholder="Ex : « D'abord consolider les bases de React, puis les tests et APIs. Je travaille surtout le soir, 2h par semaine. »"
          className="resize-y text-xs leading-relaxed"
          aide="Transmis au tuteur pour orienter les exercices sans engagement rigide."
        />
      </div>

      {message && (
        <BandeauInfo ton={message.ton} taille="compacte">
          <p className={message.ton === "alerte" ? "text-alerte" : "text-texte"}>
            {message.texte}
          </p>
        </BandeauInfo>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-bordure/60">
        <Bouton onClick={enregistrer} disabled={enCours} variante="principal" taille="normale">
          {enCours ? "Enregistrement…" : "Enregistrer mon profil"}
        </Bouton>
        <span className="text-xs text-texte-discret">
          Modifications synchronisées avec le tuteur
        </span>
      </div>
    </div>
  );
}
