"use client";

import { useState, useTransition } from "react";
import type { WorkModeSettings } from "@/lib/domain/adaptive-learning";
import { ChampSelect } from "@/components/ui/champ";
import { changeWorkMode } from "@/lib/store/adaptive-actions";

export function WorkModePanel({ initial, runId }: { initial: WorkModeSettings; runId: string }) {
  const [mode, setMode] = useState(initial);
  const [pending, startTransition] = useTransition();
  function apply(next: WorkModeSettings) {
    const previous = mode;
    setMode(next);
    const root = document.querySelector<HTMLElement>(`[data-run-id="${CSS.escape(runId)}"]`);
    if (root) {
      root.dataset.focus = next.focus;
      root.dataset.guidance = next.guidance;
      root.dataset.tools = next.toolPower;
      root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>(
        "[data-requires-advanced]",
      ).forEach((control) => {
        control.disabled = next.toolPower !== "avances";
        if (control instanceof HTMLSelectElement && control.disabled) control.value = "structure";
      });
    }
    startTransition(async () => {
      await changeWorkMode(runId, `mode:${runId}:${crypto.randomUUID()}`, previous, next);
    });
  }
  return (
    <aside className="rounded-carte border border-bordure bg-surface-2 p-4" aria-labelledby="work-mode-title" aria-busy={pending}>
      <h2 id="work-mode-title" className="font-serif text-lg font-medium">Mode de travail</h2>
      <p className="mt-1 text-xs text-texte-attenue">Valeurs initiales proposées ; tu gardes le contrôle.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
        <ChampSelect
          label="Focus"
          value={mode.focus}
          onChange={(event) => apply({ ...mode, focus: event.target.value as WorkModeSettings["focus"] })}
          options={[
            { valeur: "epure", libelle: "Épuré" },
            { valeur: "equilibre", libelle: "Équilibré" },
            { valeur: "riche", libelle: "Riche" },
          ]}
        />
        <ChampSelect
          label="Guidage"
          value={mode.guidance}
          onChange={(event) => apply({ ...mode, guidance: event.target.value as WorkModeSettings["guidance"] })}
          options={[
            { valeur: "guide", libelle: "Guidé" },
            { valeur: "equilibre", libelle: "Équilibré" },
            { valeur: "autonome", libelle: "Autonome" },
          ]}
        />
        <ChampSelect
          label="Puissance des outils"
          value={mode.toolPower}
          onChange={(event) => apply({ ...mode, toolPower: event.target.value as WorkModeSettings["toolPower"] })}
          options={[
            { valeur: "essentiels", libelle: "Essentiels" },
            { valeur: "standards", libelle: "Standards" },
            { valeur: "avances", libelle: "Avancés" },
          ]}
        />
      </div>
      {pending && <p className="mt-2 text-xs text-texte-discret">Mode enregistré…</p>}
    </aside>
  );
}
