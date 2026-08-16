"use client";

import { useState } from "react";
import { Bouton, cx } from "@/components/ui/primitives";
import { Champ, ChampSelect, classesChamp } from "@/components/ui/champ";
import {
  FOURNISSEURS,
  ecrireConfigTuteur,
  effacerConfigTuteur,
  lireConfigTuteur,
  masquerCle,
  validerCleFournisseur,
  type ConfigTuteurClient,
  type FournisseurTuteur,
} from "@/lib/tutor/cle-client";
import { validerUrlFournisseur } from "@/lib/tutor/url-fournisseur";

export function ReglagesTuteur({
  compteId,
  surEnregistre,
  compact = false,
}: {
  compteId: string;
  surEnregistre?: (config: ConfigTuteurClient) => void;
  compact?: boolean;
}) {
  const [config, setConfig] = useState<ConfigTuteurClient | null>(() =>
    lireConfigTuteur(compteId),
  );
  const [fournisseur, setFournisseur] = useState<FournisseurTuteur>(
    () => config?.fournisseur ?? "groq",
  );
  const [cle, setCle] = useState(() => config?.cle ?? "");
  const [urlBase, setUrlBase] = useState(() => config?.urlBase ?? "");
  const [modele, setModele] = useState(() => config?.modele ?? "");
  const [afficherCle, setAfficherCle] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const preset = FOURNISSEURS.find((f) => f.cle === fournisseur);
  const estAnthropic = preset?.anthropic === true;

  function choisirFournisseur(f: FournisseurTuteur) {
    setFournisseur(f);
    const p = FOURNISSEURS.find((x) => x.cle === f);
    if (p?.urlBase && !urlBase) setUrlBase(p.urlBase);
    if (p?.modeleParDefaut && !modele) setModele(p.modeleParDefaut);
  }

  function enregistrer() {
    const cleTrim = cle.trim();
    const validationCle = validerCleFournisseur(fournisseur, cleTrim);
    if (!validationCle.ok) {
      setMessage(validationCle.motif);
      return;
    }

    let nouvelleConfig: ConfigTuteurClient;
    if (!estAnthropic) {
      const url = urlBase.trim() || preset?.urlBase || "";
      const mod = modele.trim() || preset?.modeleParDefaut || "";
      if (!url || !mod) {
        setMessage("L'URL de base et le modèle sont requis pour ce fournisseur.");
        return;
      }
      const validationUrl = validerUrlFournisseur(url);
      if (!validationUrl.ok) {
        setMessage(validationUrl.motif);
        return;
      }
      nouvelleConfig = { fournisseur, cle: cleTrim, urlBase: url, modele: mod };
    } else {
      nouvelleConfig = {
        fournisseur,
        cle: cleTrim,
        ...(modele.trim() ? { modele: modele.trim() } : {}),
      };
    }

    ecrireConfigTuteur(compteId, nouvelleConfig);
    setConfig(lireConfigTuteur(compteId));
    setMessage("Clé enregistrée avec succès.");
    surEnregistre?.(nouvelleConfig);
  }

  function effacer() {
    effacerConfigTuteur(compteId);
    setConfig(null);
    setCle("");
    setUrlBase("");
    setModele("");
    setMessage("Clé effacée.");
  }

  return (
    <div className={cx("space-y-3", compact && "text-xs")}>
      {config && (
        <div className="flex items-center gap-1.5 text-xs">
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-succes" />
          <span className="text-texte-attenue">
            Clé configurée — {masquerCle(config.cle)} ({config.fournisseur})
          </span>
        </div>
      )}

      <ChampSelect
        label="Fournisseur d'IA"
        taille="compacte"
        value={fournisseur}
        onChange={(e) => choisirFournisseur(e.target.value as FournisseurTuteur)}
        options={FOURNISSEURS.map((f) => ({ valeur: f.cle, libelle: f.libelle }))}
      />

      <div>
        <label className="text-[0.6875rem] font-medium text-texte-attenue">Clé API</label>
        <div className="mt-0.5 flex gap-1.5">
          <input
            type={afficherCle ? "text" : "password"}
            value={cle}
            onChange={(e) => setCle(e.target.value)}
            placeholder={preset?.aide ?? "Colle ta clé ici"}
            className={cx(classesChamp("compacte", false), "min-w-0 flex-1 font-mono text-xs")}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setAfficherCle((v) => !v)}
            className="shrink-0 rounded-md border border-bordure bg-surface px-2 py-1 text-[0.6875rem] text-texte-attenue transition-colors hover:bg-surface-2"
            title={afficherCle ? "Masquer la clé" : "Afficher la clé"}
          >
            {afficherCle ? "Masquer" : "Afficher"}
          </button>
        </div>
      </div>

      {!estAnthropic && (
        <Champ
          label="URL de base"
          taille="compacte"
          type="text"
          value={urlBase}
          onChange={(e) => setUrlBase(e.target.value)}
          placeholder={preset?.urlBase ?? "https://api.exemple.com/v1"}
          spellCheck={false}
        />
      )}

      <Champ
        label={preset?.modeleParDefaut ? `Modèle (défaut : ${preset.modeleParDefaut})` : "Modèle"}
        taille="compacte"
        type="text"
        value={modele}
        onChange={(e) => setModele(e.target.value)}
        placeholder={preset?.modeleParDefaut ?? "nom-du-modele"}
        spellCheck={false}
      />

      {preset?.aide && (
        <p className="text-[0.6875rem] leading-relaxed text-texte-discret">{preset.aide}</p>
      )}

      <p className="text-[0.6875rem] leading-relaxed text-texte-discret">
        La clé est stockée localement dans ton navigateur, isolée par compte, et n&apos;est jamais
        partagée.
      </p>

      <div className="flex items-center gap-2 pt-1">
        <Bouton variante="principal" taille="compacte" onClick={enregistrer}>
          Enregistrer ma clé
        </Bouton>
        {config && (
          <Bouton variante="danger" taille="compacte" onClick={effacer}>
            Effacer
          </Bouton>
        )}
      </div>

      {message && <p className="text-[0.6875rem] text-texte-attenue">{message}</p>}
    </div>
  );
}
