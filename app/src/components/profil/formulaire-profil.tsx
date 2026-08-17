"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { modifierProfil } from "@/lib/store/referentiel-actions";
import { BandeauInfo, Bouton } from "@/components/ui/primitives";
import { Champ } from "@/components/ui/champ";
import { IconeValide } from "@/components/ui/icones";

/**
 * Jetons de famille écrits par l'ancien sélecteur, retiré le 15/08/2026 avec
 * les familles qu'il proposait (ADR-070).
 *
 * Le filtre survit au sélecteur : des comptes en portent encore dans
 * `preferencesPedagogiques`, et les afficher dans la zone de texte donnerait à
 * relire une ligne `adaptive:family:produire` que personne n'a écrite. Ils
 * disparaissent au premier enregistrement, sans migration.
 */
const PREFIXE_FAMILLE = "adaptive:family:";

const PREFERENCES_SUGGESTIONS = [
  { label: "Pratiquer d'abord" },
  { label: "Des cas concrets" },
  { label: "Pas à pas" },
  { label: "Les fondations d'abord" },
  { label: "Court et rapide" },
  { label: "Beaucoup de questions" },
];

/**
 * Les préférences pédagogiques sont une liste, une par ligne.
 *
 * Une zone de texte enrichie de suggestions rapides à puces : l'utilisateur
 * peut cliquer sur des formats types ou saisir des consignes sur-mesure pour le tuteur.
 */
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

  const [form, setForm] = useState(formation);
  const [moyen, setMoyen] = useState(objectifMoyenTerme);
  const [long, setLong] = useState(objectifLongTerme);
  const [prefs, setPrefs] = useState(
    preferencesPedagogiques.filter((p) => !p.startsWith(PREFIXE_FAMILLE)).join("\n"),
  );
  const [planState, setPlanState] = useState(plan ?? "");

  const lignesPrefs = prefs.split("\n").map((l) => l.trim()).filter(Boolean);

  function basculerSuggestion(label: string) {
    if (lignesPrefs.includes(label)) {
      setPrefs(lignesPrefs.filter((l) => l !== label).join("\n"));
    } else {
      setPrefs([...lignesPrefs, label].join("\n"));
    }
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
          // Chaîne vide et non `undefined` : vider le plan doit l'effacer en
          // base, or `modifierProfil` ignore les champs absents.
          plan: planState,
        });
        setMessage({ ton: "info", texte: "Profil enregistré." });
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
    <div className="max-w-2xl space-y-4">
      <Champ
        label="Formation ou point de départ"
        value={form}
        onChange={(e) => setForm(e.target.value)}
        placeholder="ce que tu as étudié ou pratiqué"
        aide="Contexte transmis au tuteur. Aucun niveau n'en est déduit."
      />

      <Champ
        label="Objectif à moyen terme"
        value={moyen}
        onChange={(e) => setMoyen(e.target.value)}
        placeholder="ce que tu veux pouvoir faire dans les mois qui viennent"
        aide="C'est la référence de l'importance des compétences. Sans lui, elles se vaudraient toutes et la recommandation perdrait son premier facteur."
      />

      <Champ
        label="Objectif à long terme (facultatif)"
        value={long}
        onChange={(e) => setLong(e.target.value)}
        placeholder="l'horizon, s'il est déjà clair"
      />

      <div className="space-y-2">
        <div>
          <label className="text-xs font-semibold text-texte block mb-1">
            Préférences pédagogiques (clic rapide ou texte libre)
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {PREFERENCES_SUGGESTIONS.map((sug) => {
              const active = lignesPrefs.includes(sug.label);
              return (
                <button
                  key={sug.label}
                  type="button"
                  onClick={() => basculerSuggestion(sug.label)}
                  className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-all shadow-xs ${
                    active
                      ? "border-primaire bg-primaire/15 text-primaire font-medium ring-1 ring-primaire/30"
                      : "border-bordure bg-surface text-texte-attenue hover:border-primaire/40 hover:text-texte"
                  }`}
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
          label=""
          value={prefs}
          onChange={(e) => setPrefs(e.target.value)}
          rows={3}
          placeholder={"Reformuler avant de corriger.\nPartir d'un cas concret plutôt que de la théorie."}
          className="resize-y"
          aide="Transmises au tuteur comme un fait déclaré : il les respecte, il ne les devine jamais."
        />
      </div>

      <Champ
        multiligne
        label="Plan de travail (facultatif)"
        value={planState}
        onChange={(e) => setPlanState(e.target.value)}
        rows={6}
        placeholder={
          "Ce que tu veux accomplir, dans quel ordre, avec quel contexte.\nEx : « D'abord consolider les fondamentaux de logique, puis attaquer l'optimisation linéaire pour le Master. Je travaille surtout le soir, 1h par session. »"
        }
        className="resize-y"
        aide="Transmis au tuteur pour orienter les exercices et la priorisation. Plus c'est précis, plus le tuteur peut cibler — mais rien ne t'engage à suivre ce plan à la lettre."
      />

      {message && (
        <BandeauInfo ton={message.ton} taille="compacte">
          <p className={message.ton === "alerte" ? "text-alerte" : "text-texte-attenue"}>
            {message.texte}
          </p>
        </BandeauInfo>
      )}

      <Bouton onClick={enregistrer} disabled={enCours} variante="principal">
        {enCours ? "Enregistrement…" : "Enregistrer"}
      </Bouton>
    </div>
  );
}
