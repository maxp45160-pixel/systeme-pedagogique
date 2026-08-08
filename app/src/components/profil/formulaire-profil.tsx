"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { modifierProfil } from "@/lib/store/referentiel-actions";
import { Bouton, cx } from "@/components/ui/primitives";
import { Champ } from "@/components/ui/champ";

/**
 * Les préférences pédagogiques sont une liste, une par ligne.
 *
 * Une zone de texte plutôt qu'une interface à puces : ce sont des phrases
 * écrites par l'utilisateur et relues telles quelles par le tuteur, pas des
 * étiquettes à choisir dans un catalogue. Un catalogue supposerait qu'on sache
 * d'avance quelles préférences existent.
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
  const [prefs, setPrefs] = useState(preferencesPedagogiques.join("\n"));
  const [planState, setPlanState] = useState(plan ?? "");

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

      <Champ
        multiligne
        label="Préférences pédagogiques (une par ligne)"
        value={prefs}
        onChange={(e) => setPrefs(e.target.value)}
        rows={4}
        placeholder={"Reformuler avant de corriger.\nPartir d'un cas concret plutôt que de la théorie."}
        className="resize-y"
        aide="Transmises au tuteur comme un fait déclaré : il les respecte, il ne les devine jamais."
      />

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
        <p
          className={cx(
            "rounded-md border px-3 py-2 text-xs",
            message.ton === "alerte"
              ? "border-alerte/30 bg-alerte-faible text-alerte"
              : "border-info/30 bg-info-faible text-texte-attenue",
          )}
        >
          {message.texte}
        </p>
      )}

      <Bouton onClick={enregistrer} disabled={enCours} variante="principal">
        {enCours ? "Enregistrement…" : "Enregistrer"}
      </Bouton>
    </div>
  );
}
