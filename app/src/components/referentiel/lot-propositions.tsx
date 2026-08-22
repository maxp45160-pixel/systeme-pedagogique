"use client";

/**
 * L'écran des propositions — ADR-108.
 *
 * ## Pourquoi cet écran existe
 *
 * Quatre détecteurs tournaient dans le vide depuis le 18/08/2026 :
 * `chargerCandidatsReferentiel` n'était appelé par rien. C'est le constat qui
 * ouvre ADR-108, et « une surface unique » en est la réponse : ajouter un
 * signal de plus sans surface le rendrait invisible comme les quatre premiers.
 *
 * ## Le vocabulaire
 *
 * Aucun des sept genres — `arete`, `dormance`, `reformulation`, `rangement`,
 * `scission`, `relation`, `manque` — n'apparaît ici, ni dans aucun libellé, ni
 * dans aucune infobulle. Ce sont des termes de maintenance du système. La
 * traduction vit dans `lib/domain/propositions-lisibles.ts`, et ce composant
 * n'affiche que ce qui en sort.
 *
 * ## Un refus est définitif, donc la carte doit rassurer
 *
 * Chaque carte dit ce qui se passera **et ce qui ne se passera pas** : « elles
 * restent comptées dans le domaine d'origine », « rien n'est perdu ». Sans ces
 * phrases, une personne qui n'ose pas accepter refuse — et comme un refus ne
 * revient pas, le lot se vide sans que rien ne se range.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Bouton, Carte, EtatVide, TitreSection, classesLienBouton } from "@/components/ui/primitives";
import { refuserProposition, retenirProposition } from "@/lib/store/propositions-actions";
import type { PropositionLisible, SectionLisible } from "@/lib/domain/propositions-lisibles";

/* ------------------------------------------------------------------ */
/* Une carte                                                           */
/* ------------------------------------------------------------------ */

function CarteProposition({ proposition }: { proposition: PropositionLisible }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState<string | null>(null);

  function arbitrer(decision: "retenir" | "refuser") {
    setErreur(null);
    demarrer(async () => {
      try {
        const resultat =
          decision === "retenir"
            ? await retenirProposition(proposition.id)
            : await refuserProposition(proposition.id);
        /*
         * Le message reste affiché à la place des boutons plutôt que de faire
         * disparaître la carte sur-le-champ. Une carte qui s'évapore au clic ne
         * dit pas ce qu'elle a fait — et « créer un sous-domaine » mérite un
         * retour, pas un trou. Le rafraîchissement retire la carte au passage
         * suivant, quand la personne a lu.
         */
        setFait(resultat.message);
        router.refresh();
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Impossible d'enregistrer ce choix.");
      }
    });
  }

  return (
    <Carte className="p-4">
      <p className="text-sm font-medium leading-snug">{proposition.titre}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-texte-attenue">{proposition.effet}</p>

      {proposition.motifs.length > 0 && (
        <ul className="mt-3 space-y-1 border-l border-bordure pl-3">
          {proposition.motifs.map((motif, index) => (
            <li key={index} className="text-xs leading-relaxed text-texte-discret">
              {motif}
            </li>
          ))}
        </ul>
      )}

      {fait ? (
        <p className="mt-4 text-xs text-texte-attenue" aria-live="polite">
          {fait}
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {proposition.action && (
            <Bouton
              variante="principal"
              taille="compacte"
              enChargement={enCours}
              onClick={() => arbitrer("retenir")}
            >
              {proposition.action}
            </Bouton>
          )}
          {proposition.lien && (
            <Link
              href={proposition.lien.href}
              className={classesLienBouton("secondaire", "compacte")}
            >
              {proposition.lien.libelle}
            </Link>
          )}
          <Bouton
            variante="discret"
            taille="compacte"
            disabled={enCours}
            onClick={() => arbitrer("refuser")}
            title="Cette proposition ne vous sera plus faite."
          >
            Non merci
          </Bouton>
        </div>
      )}

      {erreur && (
        <p className="mt-2 text-xs text-alerte" role="alert">
          {erreur}
        </p>
      )}
    </Carte>
  );
}

/* ------------------------------------------------------------------ */
/* Le lot                                                              */
/* ------------------------------------------------------------------ */

export function LotPropositions({
  sections,
  relectureDue,
}: {
  sections: SectionLisible[];
  /**
   * Une relecture est-elle attendue ? Vrai quand rien n'a jamais été produit,
   * ou quand tout ce qui l'a été porte sur un référentiel qui a changé depuis.
   *
   * C'est le déclencheur d'ADR-108 : la péremption, jamais un seuil de taille.
   */
  relectureDue: boolean;
}) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [avertissement, setAvertissement] = useState<string | null>(null);

  async function relire() {
    setEnCours(true);
    setErreur(null);
    setAvertissement(null);
    try {
      const reponse = await fetch("/api/referentiel/relecture", { method: "POST" });
      const corps = (await reponse.json()) as {
        message?: string;
        avertissement?: string | null;
      };
      if (!reponse.ok) {
        setErreur(corps.message ?? "La relecture n'a pas abouti.");
        return;
      }
      // Un lot amputé se présente comme amputé : masquer l'absence du tuteur
      // ferait passer « pas de moteur » pour « rien à proposer ».
      setAvertissement(corps.avertissement ?? null);
      router.refresh();
    } catch {
      setErreur("La relecture n'a pas abouti. Réessayez dans un instant.");
    } finally {
      setEnCours(false);
    }
  }

  const total = sections.reduce((somme, section) => somme + section.propositions.length, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-texte-attenue">
          {total === 0
            ? "Rien à vous proposer pour l'instant."
            : `${total} proposition${total > 1 ? "s" : ""} à regarder.`}
        </p>
        <Bouton variante="secondaire" taille="compacte" enChargement={enCours} onClick={relire}>
          {relectureDue ? "Relire mon référentiel" : "Relire à nouveau"}
        </Bouton>
      </div>

      {erreur && (
        <p className="text-xs text-alerte" role="alert">
          {erreur}
        </p>
      )}
      {avertissement && <p className="text-xs text-texte-discret">{avertissement}</p>}

      {total === 0 ? (
        <Carte>
          <EtatVide
            titre="Votre référentiel n'appelle aucune proposition"
            message={
              relectureDue
                ? "Il a changé depuis la dernière relecture. Relancez-la pour voir ce qu'il en ressort."
                : "Continuez à travailler : les propositions arrivent quand votre référentiel bouge."
            }
          />
        </Carte>
      ) : (
        sections.map((section) => (
          <section key={section.cle}>
            <TitreSection legende={section.sous_titre}>{section.titre}</TitreSection>
            <div className="space-y-3">
              {section.propositions.map((proposition) => (
                <CarteProposition key={proposition.id} proposition={proposition} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
