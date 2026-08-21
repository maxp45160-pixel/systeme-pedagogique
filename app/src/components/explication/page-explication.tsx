"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Skill, Domaine } from "@/lib/domain/types";
import type { EvaluationExplication } from "@/lib/domain/explication";
import {
  EXPLICATION_MIN_CARACTERES,
  EXPLICATION_MAX_CARACTERES,
  verifierTexteExplication,
} from "@/lib/domain/explication";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";
import { enregistrerExplicationAction } from "@/lib/store/explication-actions";
import {
  Carte,
  Bouton,
  classesLienBouton,
  Etiquette,
  BandeauInfo,
} from "@/components/ui/primitives";
import {
  IconeAmpoule,
  IconeFleche,
  IconeValide,
  IconeRedaction,
} from "@/components/ui/icones";

export function PageExplication({
  skill,
  domaine,
  compteId,
}: {
  skill: Skill;
  domaine?: Domaine;
  compteId: string;
}) {
  const router = useRouter();
  const [texte, setTexte] = useState("");
  const [enCoursEvaluation, setEnCoursEvaluation] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationExplication | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enEnregistrement, setEnEnregistrement] = useState(false);
  const [termine, setTermine] = useState(false);

  const nbCaracteres = texte.trim().length;
  const peutEvaluer = nbCaracteres >= EXPLICATION_MIN_CARACTERES;

  async function evaluer() {
    const verif = verifierTexteExplication(texte);
    if (!verif.valide) {
      setErreur(verif.erreur ?? "Texte invalide.");
      return;
    }

    setEnCoursEvaluation(true);
    setErreur(null);
    setEvaluation(null);

    try {
      const config = lireConfigTuteur(compteId);
      const reponse = await fetch("/api/explication/evaluer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillCode: skill.code,
          texteExplication: texte,
          config: config ?? undefined,
        }),
      });

      if (!reponse.ok) {
        const json = await reponse.json().catch(() => ({}));
        throw new Error(json.message || "Impossible d'évaluer l'explication.");
      }

      const lecteur = reponse.body?.getReader();
      if (!lecteur) throw new Error("Flux d'évaluation indisponible.");

      const decodeur = new TextDecoder();
      let tampon = "";

      while (true) {
        const { done, value } = await lecteur.read();
        if (done) break;
        tampon += decodeur.decode(value, { stream: true });

        const lignes = tampon.split("\n\n");
        tampon = lignes.pop() ?? "";

        for (const bloc of lignes) {
          const ligneEvenement = bloc.split("\n").find((l) => l.startsWith("event: "));
          const ligneDonnees = bloc.split("\n").find((l) => l.startsWith("data: "));
          const evenement = ligneEvenement?.replace("event: ", "").trim();
          const donneesBrutes = ligneDonnees?.replace("data: ", "").trim();

          if (evenement === "erreur") {
            const parsed = JSON.parse(donneesBrutes || "{}");
            throw new Error(parsed.message || "Erreur d'évaluation.");
          }

          if (evenement === "proposition") {
            const parsed = JSON.parse(donneesBrutes || "{}");
            if (parsed.evaluation) {
              setEvaluation(parsed.evaluation);
            }
          }
        }
      }
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : "Erreur imprévue.");
    } finally {
      setEnCoursEvaluation(false);
    }
  }

  async function enregistrer() {
    if (!evaluation) return;
    setEnEnregistrement(true);
    setErreur(null);

    try {
      await enregistrerExplicationAction({
        skillCode: skill.code,
        texteExplication: texte,
        evaluation,
        dureeMin: 10,
      });
      setTermine(true);
      router.refresh();
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : "Échec de l'enregistrement.");
    } finally {
      setEnEnregistrement(false);
    }
  }

  if (termine) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Carte className="p-6 sm:p-8 text-center space-y-5">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-succes/15 text-succes">
            <IconeValide className="size-7" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-medium text-texte">
              Compréhension enregistrée
            </h1>
            <p className="mt-2 text-sm text-texte-attenue max-w-md mx-auto leading-relaxed">
              Votre auto-explication de la compétence{" "}
              <strong className="font-medium text-texte">{skill.intitule}</strong> a été validée.
              La compétence atteint le <strong>Niveau 1</strong> (compréhension démontrée).
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-4 border-t border-bordure/60">
            <Link
              href={`/seances?composer=1&code=${encodeURIComponent(skill.code)}`}
              className={classesLienBouton("principal")}
            >
              Passer à un exercice guidé (Niveau 2)
              <IconeFleche className="size-4" />
            </Link>
            <Link href="/" className={classesLienBouton("secondaire")}>
              Retour au tableau de bord
            </Link>
          </div>
        </Carte>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      {/* Fil d'ariane & En-tête */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-texte-discret">
          <Link href="/" className="hover:text-texte transition-colors">
            Tableau de bord
          </Link>
          <span>/</span>
          {domaine && (
            <>
              <span>{domaine.nom}</span>
              <span>/</span>
            </>
          )}
          <span className="text-texte">{skill.code}</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primaire/15 px-2.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-primaire">
                Palier 0 → 1
              </span>
              <Etiquette>{domaine?.nom ?? "Transversal"}</Etiquette>
              <span className="text-xs text-texte-discret">Palier : {skill.palier}</span>
            </div>
            <h1 className="mt-2 font-serif text-2xl sm:text-3xl font-medium tracking-tight text-texte">
              {skill.intitule}
            </h1>
          </div>
        </div>
      </div>

      {/* Cadrage pédagogique : Méthode Feynman */}
      <Carte className="p-5 sm:p-6 bg-surface-2/60 border-bordure space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primaire/10 text-primaire">
            <IconeAmpoule className="size-5" />
          </div>
          <div>
            <h2 className="font-serif text-base font-medium text-texte">
              La méthode Feynman : expliquez avec vos propres mots
            </h2>
            <p className="mt-1 text-xs text-texte-attenue leading-relaxed">
              Pour vous approprier réellement un concept, formulez-le comme si vous l&apos;expliquiez à un pair
              ou à un débutant. Évitez le jargon non expliqué et privilégiez la clarté.
            </p>
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 pt-2 border-t border-bordure/60 text-xs text-texte-attenue">
          <div className="rounded-lg border border-bordure/60 bg-surface p-3 space-y-1">
            <strong className="text-texte block font-medium">1. L&apos;essence du concept</strong>
            <span>Qu&apos;est-ce que c&apos;est en termes simples et directs ?</span>
          </div>
          <div className="rounded-lg border border-bordure/60 bg-surface p-3 space-y-1">
            <strong className="text-texte block font-medium">2. L&apos;utilité & contexte</strong>
            <span>À quel problème répond-il ? Quand doit-on l&apos;utiliser ?</span>
          </div>
          <div className="rounded-lg border border-bordure/60 bg-surface p-3 space-y-1">
            <strong className="text-texte block font-medium">3. Un exemple concret</strong>
            <span>Illustrez par un cas pratique, une analogie ou un calcul simple.</span>
          </div>
          <div className="rounded-lg border border-bordure/60 bg-surface p-3 space-y-1">
            <strong className="text-texte block font-medium">4. Le piège classique</strong>
            <span>Quelle erreur ou fausse intuition faut-il éviter ?</span>
          </div>
        </div>
      </Carte>

      {/* Zone de rédaction */}
      <Carte className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <label htmlFor="explication-texte" className="text-sm font-medium text-texte flex items-center gap-2">
            <IconeRedaction className="size-4 text-primaire" />
            Votre explication
          </label>
          <span
            className={`text-xs ${
              nbCaracteres < EXPLICATION_MIN_CARACTERES
                ? "text-texte-discret"
                : nbCaracteres > EXPLICATION_MAX_CARACTERES
                  ? "text-alerte font-medium"
                  : "text-succes font-medium"
            }`}
          >
            {nbCaracteres} / {EXPLICATION_MAX_CARACTERES} car. (min {EXPLICATION_MIN_CARACTERES})
          </span>
        </div>

        <textarea
          id="explication-texte"
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder={`Expliquez le concept "${skill.intitule}" avec vos propres mots...`}
          rows={10}
          disabled={enCoursEvaluation || enEnregistrement}
          className="w-full rounded-xl border border-bordure bg-surface p-4 text-sm text-texte placeholder:text-texte-discret focus:border-primaire focus:outline-none focus:ring-1 focus:ring-primaire leading-relaxed resize-y"
        />

        {erreur && <BandeauInfo ton="alerte">{erreur}</BandeauInfo>}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-xs text-texte-discret">
            Le tuteur IA évaluera la précision de votre compréhension sans stocker de note automatique.
          </p>

          <Bouton
            type="button"
            variante="principal"
            disabled={!peutEvaluer || enCoursEvaluation || enEnregistrement}
            onClick={evaluer}
          >
            {enCoursEvaluation ? "Évaluation en cours..." : "Évaluer ma compréhension"}
            <IconeFleche className="size-4" />
          </Bouton>
        </div>
      </Carte>

      {/* Résultat de l'évaluation */}
      {evaluation && (
        <Carte className="p-5 sm:p-6 space-y-5 border-primaire/30 bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-bordure/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
                Retour pédagogique du tuteur
              </span>
              <Etiquette
                ton={
                  evaluation.resultat === "reussi"
                    ? "succes"
                    : evaluation.resultat === "partiel"
                      ? "info"
                      : "danger"
                }
              >
                {evaluation.resultat === "reussi"
                  ? "Compréhension démontrée"
                  : evaluation.resultat === "partiel"
                    ? "Compréhension partielle"
                    : "À retravailler"}
              </Etiquette>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-texte-discret">Compréhension : </span>
                <strong className="text-texte font-medium">
                  {Math.round(evaluation.scoreComprehension * 100)}%
                </strong>
              </div>
              <div>
                <span className="text-texte-discret">Justification : </span>
                <strong className="text-texte font-medium">
                  {Math.round(evaluation.scoreJustification * 100)}%
                </strong>
              </div>
            </div>
          </div>

          {/* Points clés & Manques */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-bordure bg-surface-2/40 p-4 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-succes flex items-center gap-1.5">
                <IconeValide className="size-3.5" />
                Ce qui est bien assimilé
              </h3>
              <ul className="space-y-1.5 text-xs text-texte-attenue">
                {evaluation.pointsCles.map((point, index) => (
                  <li key={index} className="leading-relaxed">
                    · {point}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-bordure bg-surface-2/40 p-4 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
                Ce qui manque ou reste imprécis
              </h3>
              {evaluation.pointsManquants.length > 0 ? (
                <ul className="space-y-1.5 text-xs text-texte-attenue">
                  {evaluation.pointsManquants.map((point, index) => (
                    <li key={index} className="leading-relaxed">
                      · {point}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-texte-discret italic">Aucun manque majeur relevé.</p>
              )}
            </div>
          </div>

          {/* Synthèse et conseil */}
          <div className="rounded-xl border border-bordure/60 bg-surface-2/20 p-4 space-y-2">
            <p className="text-xs sm:text-sm text-texte leading-relaxed">
              {evaluation.feedbackFormatif}
            </p>
            {evaluation.conseilSuivant && (
              <p className="text-xs text-texte-attenue pt-1 border-t border-bordure/40">
                <strong className="text-texte font-medium">Conseil pour la suite : </strong>
                {evaluation.conseilSuivant}
              </p>
            )}
          </div>

          {/* Actions d'enregistrement */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-bordure/60">
            <Bouton
              type="button"
              variante="secondaire"
              disabled={enEnregistrement}
              onClick={() => {
                const zone = document.getElementById("explication-texte");
                zone?.focus();
              }}
            >
              Ajuster mon texte
            </Bouton>

            <Bouton
              type="button"
              variante="principal"
              disabled={enEnregistrement}
              onClick={enregistrer}
            >
              {enEnregistrement
                ? "Enregistrement..."
                : evaluation.resultat === "reussi"
                  ? "Valider la compréhension (Niveau 1)"
                  : "Enregistrer cette tentative"}
              <IconeValide className="size-4" />
            </Bouton>
          </div>
        </Carte>
      )}
    </div>
  );
}
