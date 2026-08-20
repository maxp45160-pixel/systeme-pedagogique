"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { modifierProfil } from "@/lib/store/referentiel-actions";
import { BandeauInfo, Bouton, Etiquette, cx } from "@/components/ui/primitives";
import { Champ } from "@/components/ui/champ";
import { IconeValide } from "@/components/ui/icones";
import { PREFERENCES_APPRENTISSAGE } from "@/lib/domain/assistant-orientation";

const PREFIXE_FAMILLE = "adaptive:family:";

export function FormulaireProfil({
  formation,
  preferencesPedagogiques,
}: {
  formation: string;
  preferencesPedagogiques: string[];
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ton: "info" | "alerte"; texte: string } | null>(null);
  const [form, setForm] = useState(formation);
  const [prefs, setPrefs] = useState(
    preferencesPedagogiques.filter((p) => !p.startsWith(PREFIXE_FAMILLE)).join("\n"),
  );

  const lignesPrefs = prefs
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const estRenseigne = Boolean(form.trim() || lignesPrefs.length > 0);

  function basculerSuggestion(label: string) {
    setPrefs(
      lignesPrefs.includes(label)
        ? lignesPrefs.filter((l) => l !== label).join("\n")
        : [...lignesPrefs, label].join("\n"),
    );
  }

  function enregistrer() {
    setMessage(null);
    demarrer(async () => {
      try {
        await modifierProfil({
          formation: form,
          preferencesPedagogiques: lignesPrefs,
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bordure/60 pb-4">
        <div>
          <h3 className="text-sm font-semibold text-texte">Point de départ et méthode</h3>
          <p className="text-xs text-texte-attenue">
            Les objectifs structurés se gèrent dans Twiny, avec un repère et un horizon explicites.
          </p>
        </div>
        <Etiquette ton={estRenseigne ? "succes" : "info"}>
          {estRenseigne ? "Renseigné" : "À compléter"}
        </Etiquette>
      </div>

      <Champ
        label="Formation ou point de départ"
        value={form}
        onChange={(e) => setForm(e.target.value)}
        placeholder="Ex : autodidacte avec bases en JavaScript, reconversion, junior…"
        aide="Contexte transmis au tuteur ; aucun niveau n'en est déduit."
      />

      <div className="border-t border-bordure/60 pt-4 space-y-3">
        <div>
          <label className="text-xs font-semibold text-texte block mb-1.5">
            Préférences pédagogiques
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {PREFERENCES_APPRENTISSAGE.map((pref) => {
              const active = lignesPrefs.includes(pref.libelle);
              return (
                <button
                  key={pref.id}
                  type="button"
                  onClick={() => basculerSuggestion(pref.libelle)}
                  className={cx(
                    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all shadow-xs",
                    active
                      ? "border-primaire bg-primaire/15 text-primaire font-semibold ring-1 ring-primaire/30"
                      : "border-bordure bg-surface text-texte-attenue hover:border-primaire/40 hover:text-texte hover:bg-surface-2",
                  )}
                >
                  <span>{pref.libelle}</span>
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
          rows={3}
          placeholder={"Reformuler avant de corriger.\nPartir d'un cas concret plutôt que de la théorie."}
          className="resize-y font-mono text-xs"
        />
      </div>

      {message && (
        <BandeauInfo ton={message.ton} taille="compacte">
          <p className={message.ton === "alerte" ? "text-alerte" : "text-texte"}>{message.texte}</p>
        </BandeauInfo>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-bordure/60">
        <Bouton onClick={enregistrer} disabled={enCours} variante="principal" taille="normale">
          {enCours ? "Enregistrement…" : "Enregistrer mon profil"}
        </Bouton>
        <span className="text-xs text-texte-discret">Modifications synchronisées avec le tuteur</span>
      </div>
    </div>
  );
}
