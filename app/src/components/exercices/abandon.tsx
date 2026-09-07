"use client";

/**
 * Clore une tentative sans en rien conclure.
 *
 * C'est la sortie de la règle de la réponse écrite : le bilan ne s'ouvre plus
 * sans réponse rédigée, donc une tentative qu'on ne veut pas mener doit avoir
 * un chemin propre. Sans lui, elle resterait `en-cours` indéfiniment et
 * l'exercice s'afficherait « en cours » pour toujours.
 *
 * Confirmation en deux temps, sur le modèle de `gestion-domaine.tsx` (ADR-027) :
 * **le geste s'annonce avant le clic**, jamais après. Ce qui est annoncé ici
 * n'est pas ce qui sera écrit mais ce qui ne le sera PAS — et c'est la partie
 * qu'il faut dire, parce qu'un silence laisserait croire à une mesure
 * enregistrée.
 *
 * Aucune décision ne vit dans ce fichier : il n'y a ni boucle, ni seuil, ni
 * dérivation (ADR-039). Le serveur décide, le composant annonce.
 */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { abandonnerExercice } from "@/lib/store/actions";
import type { ContexteNavigationExercice } from "@/lib/domain/navigation-exercice";
import { BandeauInfo, Bouton } from "@/components/ui/primitives";

export function BoutonAbandon({
  attemptId,
  exerciceId,
  dureeMin,
  codes,
  navigation,
  mode = "abandon",
  avantConfirmation,
  avantCloture,
  surClotureEnCours,
  disabled = false,
}: {
  attemptId: string;
  exerciceId: string;
  /** Minutes écoulées depuis le début — le journal enregistre un fait, pas un zéro. */
  dureeMin: number;
  /** Compétences visées, citées dans l'annonce : c'est d'elles qu'il s'agit. */
  codes: string[];
  navigation?: ContexteNavigationExercice;
  /** Variante explicite utilisée quand la correction n'est pas recevable. */
  mode?: "abandon" | "sans-mesure";
  /** Coupe une demande en cours avant d'afficher la confirmation. */
  avantConfirmation?: () => void;
  /** Attend la dernière saisie avant que la réponse ne devienne consultable. */
  avantCloture?: () => Promise<void>;
  surClotureEnCours?: (enCours: boolean) => void;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [confirme, setConfirme] = useState(false);
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const actionLancee = useRef(false);

  function abandonner() {
    if (actionLancee.current || disabled) return;
    actionLancee.current = true;
    surClotureEnCours?.(true);
    setErreur(null);
    demarrer(async () => {
      try {
        await avantCloture?.();
        const destination = await abandonnerExercice(
          attemptId,
          exerciceId,
          dureeMin,
          navigation,
        );
        setConfirme(false);
        router.push(destination);
        router.refresh();
      } catch (e) {
        actionLancee.current = false;
        surClotureEnCours?.(false);
        setErreur(e instanceof Error ? e.message : "Impossible de clore la tentative.");
      }
    });
  }

  if (!confirme) {
    return (
      <Bouton
        onClick={() => {
          avantConfirmation?.();
          setConfirme(true);
        }}
        disabled={enCours || disabled}
        variante="secondaire"
        taille="petite"
      >
        {mode === "sans-mesure" ? "Terminer et consulter le corrigé" : "Abandonner cette tentative"}
      </Bouton>
    );
  }

  return (
    <div className="space-y-2">
      {/* L'annonce du geste, avant qu'il ne se produise (ADR-027). */}
      <BandeauInfo ton="info" taille="compacte">
        <p className="text-texte-attenue">
          <span className="font-medium text-texte">
            {mode === "sans-mesure" ? "Aucune mesure ne sera enregistrée." : "Cet exercice ne comptera pas."}
          </span>{" "}
          {mode === "sans-mesure"
            ? "Votre réponse sera conservée avant de dévoiler le corrigé. Vous pourrez demander un feedback personnalisé plus tard sur cette réponse d'origine."
            : "Un abandon n'est pas un échec : un échec est une mesure, il suppose qu'on ait essayé. Votre niveau sur "}
          {mode === "abandon" && `${codes.join(", ")} restera inchangé.`}
          <br />
          {mode === "abandon" && "La tentative passe en abandonnée et reste au journal — aucune difficulté n'est conseillée pour le prochain exercice."}
          {mode === "sans-mesure" && (
            <>
              <br />
              La comparaison avec le corrigé ne constitue pas une correction personnalisée
              et ne modifie pas votre progression.
            </>
          )}
        </p>
      </BandeauInfo>

      {erreur && (
        <BandeauInfo ton="danger" taille="compacte">
          <p className="text-danger">{erreur}</p>
        </BandeauInfo>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Bouton onClick={abandonner} disabled={enCours || disabled} variante="secondaire" taille="petite">
          {enCours
            ? "Clôture…"
            : mode === "sans-mesure"
              ? "Terminer et afficher le corrigé"
              : "Confirmer l'abandon"}
        </Bouton>
        <button
          type="button"
          onClick={() => setConfirme(false)}
          disabled={enCours}
          className="text-[0.6875rem] text-texte-attenue hover:text-texte"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
