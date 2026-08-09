"use client";

/**
 * Ce que devient une compétence maîtrisée — l'arbitrage, pas la décision.
 *
 * Le tuteur propose l'une des trois voies d'ADR-042 ; cet écran les rend
 * applicables et laisse la personne trancher. Il n'invente aucune règle :
 *
 * - **successeur** → `creerBranche`, rattachement au domaine **par nom**, code
 *   attribué par `attribuerCodes`. La compétence maîtrisée devient un prérequis
 *   du successeur : c'est un fait du référentiel, pas une note.
 * - **élargissement** → **rien au référentiel**. Un « contexte » n'est pas un
 *   objet de base : `SkillEvidence.contexte` est le *titre de l'exercice*.
 *   L'élargissement se résout donc en un exercice à générer sur la **même**
 *   compétence, avec ce contexte pour thème.
 * - **retrait** → le mode est **dérivé** du nombre de preuves (ADR-027), jamais
 *   choisi. Une compétence maîtrisée en porte au moins deux par construction :
 *   ce sera **toujours** un archivage, et l'écran le dit avec le compte.
 *
 * ⚠️ Le retrait exige une confirmation : c'est le geste le plus destructeur de
 * l'écran. Et comme `basculerActive` refuse de réactiver une compétence
 * archivée, on propose à côté le geste doux et pleinement réversible — sortir
 * du périmètre. Les deux drapeaux sont distincts et c'est délibéré ; l'écran
 * reflète la distinction plutôt que de la masquer.
 *
 * ## Pourquoi l'appel part du clic et non d'un montage
 *
 * La première version lançait la demande dans un `useEffect` au montage de la
 * modale. C'est ce que fait `bilan-assiste.tsx`, où le verdict doit être là
 * quand on arrive. Ici la personne a **déjà cliqué** pour ouvrir : rattacher
 * l'appel réseau à ce geste, plutôt qu'à un cycle de rendu, supprime l'effet
 * entièrement — donc la question des rendus en cascade, et celle du double
 * montage en mode strict.
 */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BandeauInfo, Bouton, PointActif } from "@/components/ui/primitives";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";
import type { PropositionEvolution } from "@/lib/tutor/outils";
import { archiverCompetence, basculerActive, creerBranche } from "@/lib/store/referentiel-actions";
import { BoutonGenerer } from "@/components/exercices/bouton-generer";
import type {
  CalibrageModale,
  CompetenceModale,
} from "@/components/exercices/proprietes-generation";

interface Cible {
  code: string;
  intitule: string;
  /** Le nom, pas l'identifiant : `creerBranche` rattache par nom. */
  domaineNom: string;
  /** Sert à annoncer le geste de retrait AVANT le clic (ADR-027). */
  nombrePreuves: number;
  compteId: string;
  /** Pour la branche « élargissement », qui monte la modale de génération. */
  competences: CompetenceModale[];
  calibrages: Record<string, CalibrageModale>;
}

type Etat =
  | { phase: "fermee" }
  | { phase: "demande"; progression: string | null }
  | { phase: "proposition"; proposition: PropositionEvolution }
  | { phase: "erreur"; message: string };

/**
 * Le bouton, qui porte l'état et l'appel.
 *
 * La page qui l'affiche est un Server Component : elle ne peut porter ni l'un
 * ni l'autre. Le bouton ne décide de rien — c'est la page qui a déjà tranché,
 * en ne le rendant que si `maitrise.maitrisee`.
 */
export function BoutonEvolution(cible: Cible) {
  const [etat, setEtat] = useState<Etat>({ phase: "fermee" });
  const abandonRef = useRef<AbortController | null>(null);

  /** Lance la demande. Appelée depuis un clic, jamais depuis un effet. */
  async function demander() {
    abandonRef.current?.abort();
    const abandon = new AbortController();
    abandonRef.current = abandon;
    setEtat({ phase: "demande", progression: null });

    try {
      const reponse = await fetch("/api/competences/evolution", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: cible.code,
          config: lireConfigTuteur(cible.compteId) ?? undefined,
        }),
        signal: abandon.signal,
      });

      if (!reponse.ok || !reponse.body) {
        const donnees = (await reponse.json().catch(() => null)) as { message?: string } | null;
        setEtat({
          phase: "erreur",
          message: donnees?.message ?? "Le tuteur n'a pas pu répondre.",
        });
        return;
      }

      const lecteur = reponse.body.getReader();
      const decodeur = new TextDecoder();
      let tampon = "";
      /*
       * Un flux fermé sans événement terminal — coupure, troncature, proxy —
       * laissait la modale en « demande » indéfiniment (audit §2.4).
       */
      let verdictRecu = false;

      for (;;) {
        const { done, value } = await lecteur.read();
        if (done) break;
        tampon += decodeur.decode(value, { stream: true });

        const blocs = tampon.split("\n\n");
        tampon = blocs.pop() ?? "";

        for (const bloc of blocs) {
          const lignes = bloc.split("\n");
          const type = lignes.find((l) => l.startsWith("event:"))?.slice(6).trim() ?? "message";
          const donnees = lignes.find((l) => l.startsWith("data:"))?.slice(5).trim();
          if (!donnees) continue;

          if (type === "proposition") {
            const recue = (JSON.parse(donnees) as { evolution: PropositionEvolution }).evolution;
            verdictRecu = true;
            setEtat({ phase: "proposition", proposition: recue });
          } else if (type === "erreur") {
            verdictRecu = true;
            setEtat({
              phase: "erreur",
              message: (JSON.parse(donnees) as { message: string }).message,
            });
          } else if (type === "proposition-en-cours") {
            setEtat({ phase: "demande", progression: "Le tuteur relit ce qui a été mesuré…" });
          }
        }
      }

      if (!verdictRecu && !abandon.signal.aborted) {
        setEtat({
          phase: "erreur",
          message:
            "Le flux s'est interrompu avant que le tuteur n'ait rendu sa proposition. Rien n'a été enregistré — relance la demande.",
        });
      }
    } catch {
      if (!abandon.signal.aborted) {
        setEtat({ phase: "erreur", message: "Proposition interrompue." });
      }
    }
  }

  function fermer() {
    abandonRef.current?.abort();
    setEtat({ phase: "fermee" });
  }

  return (
    <>
      <Bouton onClick={() => void demander()} variante="secondaire" className="w-full">
        Demander une évolution au tuteur
      </Bouton>
      {etat.phase !== "fermee" && (
        <ModaleEvolution
          cible={cible}
          etat={etat}
          onFermer={fermer}
          onRedemander={() => void demander()}
        />
      )}
    </>
  );
}

/**
 * L'écran de relecture — présentation et écritures, aucun appel réseau au tuteur.
 *
 * Il reçoit l'état déjà résolu : il ne sait pas d'où vient la proposition, et
 * n'a donc aucune raison d'en relancer une.
 */
function ModaleEvolution({
  cible,
  etat,
  onFermer,
  onRedemander,
}: {
  cible: Cible;
  etat: Exclude<Etat, { phase: "fermee" }>;
  onFermer: () => void;
  onRedemander: () => void;
}) {
  const router = useRouter();
  const [confirmeRetrait, setConfirmeRetrait] = useState(false);
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function agir(action: () => Promise<unknown>) {
    setErreurAction(null);
    demarrer(async () => {
      try {
        await action();
        onFermer();
        router.refresh();
      } catch (e) {
        setErreurAction(e instanceof Error ? e.message : "L'action a échoué.");
      }
    });
  }

  const p = etat.phase === "proposition" ? etat.proposition : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Faire évoluer la compétence"
      onClick={onFermer}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-y-auto rounded-xl border border-bordure bg-surface p-5 text-texte shadow-[var(--ombre-surcouche)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-bordure pb-3">
          <div>
            <h2 className="font-serif text-base font-medium">Que devient {cible.code} ?</h2>
            <p className="mt-0.5 text-xs text-texte-attenue">{cible.intitule}</p>
            <p className="mt-0.5 text-xs text-texte-discret">
              Le tuteur propose, tu arbitres. Rien n{"'"}est appliqué sans ton clic.
            </p>
          </div>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="rounded-md px-2 py-1 text-sm text-texte-attenue transition-colors hover:bg-surface-2 hover:text-texte"
          >
            ✕
          </button>
        </div>

        {etat.phase === "demande" && (
          <div className="mt-8 flex flex-col items-center justify-center py-10 text-center">
            <PointActif />
            <p className="mt-3 text-sm text-texte-attenue">
              {etat.progression ?? "Le tuteur prend connaissance de ce qui a été mesuré…"}
            </p>
            <Bouton onClick={onFermer} variante="secondaire" taille="petite" className="mt-4">
              Arrêter
            </Bouton>
          </div>
        )}

        {etat.phase === "erreur" && (
          <div className="mt-4 space-y-3">
            <BandeauInfo ton="danger" taille="compacte">
              <p className="text-danger">{etat.message}</p>
            </BandeauInfo>
            <p className="text-xs text-texte-attenue">
              Tu peux arbitrer sans le tuteur : ajoute une compétence à la main depuis la page
              du domaine, ou sors celle-ci du périmètre — un geste réversible.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Bouton
                onClick={() => agir(() => basculerActive(cible.code, false))}
                disabled={enCours}
                variante="secondaire"
                taille="petite"
              >
                Sortir {cible.code} du périmètre
              </Bouton>
              <button
                type="button"
                onClick={onRedemander}
                className="text-[0.6875rem] text-texte-attenue underline-offset-2 hover:text-texte hover:underline"
              >
                Réessayer
              </button>
            </div>
          </div>
        )}

        {p && (
          <div className="mt-4 space-y-4">
            {/* Le raisonnement d'abord : c'est ce qui rend l'arbitrage instruit (P3). */}
            <div className="rounded-md border border-bordure bg-surface-2 px-3 py-2.5">
              <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-texte-discret">
                Ce que le tuteur observe
              </p>
              <p className="mt-1 text-xs text-texte-attenue">{p.raisonnement}</p>
            </div>

            {erreurAction && (
              <BandeauInfo ton="danger" taille="compacte">
                <p className="text-danger">{erreurAction}</p>
              </BandeauInfo>
            )}

            {p.evolution === "successeur" && (
              <div className="space-y-2">
                <p className="text-xs font-medium">Compétence suivante proposée</p>
                <div className="rounded-md border border-bordure px-3 py-2">
                  <p className="text-sm">{p.intitule}</p>
                  <p className="mt-1 text-[0.6875rem] text-texte-discret">
                    Domaine {cible.domaineNom} · palier {p.palier || "à définir"} · s{"'"}appuiera
                    sur {cible.code}. Le code sera attribué à l{"'"}enregistrement.
                  </p>
                </div>
                <Bouton
                  disabled={enCours}
                  onClick={() =>
                    agir(() =>
                      creerBranche({
                        domaine: cible.domaineNom,
                        prefixe: "",
                        description: "",
                        competences: [
                          {
                            intitule: p.intitule,
                            palier: p.palier,
                            importance: p.importance,
                            prerequis: [cible.code],
                          },
                        ],
                        origine: "tuteur",
                      }),
                    )
                  }
                  variante="principal"
                >
                  {enCours ? "Enregistrement…" : "Ajouter cette compétence"}
                </Bouton>
              </div>
            )}

            {p.evolution === "elargissement" && (
              <div className="space-y-2">
                <p className="text-xs font-medium">Remesurer dans un contexte nouveau</p>
                <div className="rounded-md border border-bordure px-3 py-2">
                  <p className="text-sm">{p.contexte}</p>
                  <p className="mt-1 text-[0.6875rem] text-texte-discret">
                    Rien n{"'"}est ajouté au référentiel : un contexte n{"'"}est pas un objet de
                    base, c{"'"}est le titre d{"'"}un exercice. {cible.code} reste la compétence
                    visée.
                  </p>
                </div>
                {/*
                  Le vrai bouton de génération, pas un lien vers une page qui
                  saurait lire des paramètres. La première version pointait vers
                  `/exercices?generer=…&theme=…` — des paramètres que cette
                  route ne lit pas : le lien ne faisait rien.
                */}
                <BoutonGenerer
                  competences={cible.competences}
                  competenceInitiale={cible.code}
                  themeInitial={p.contexte}
                  calibrages={cible.calibrages}
                  compteId={cible.compteId}
                  libelle="Générer un exercice sur ce contexte"
                  surEnregistre={() => {
                    onFermer();
                    router.refresh();
                  }}
                />
              </div>
            )}

            {p.evolution === "retrait" && (
              <div className="space-y-2">
                <p className="text-xs font-medium">Retirer {cible.code} du référentiel</p>
                {/* L'annonce du geste dérivé, avant le clic (ADR-027). */}
                <BandeauInfo ton="info" taille="compacte">
                  <p className="text-texte-attenue">
                    <span className="font-medium text-texte">Archivage, pas suppression.</span>{" "}
                    {cible.code} porte {cible.nombrePreuves} preuve
                    {cible.nombrePreuves > 1 ? "s" : ""} : elles restent en base et gardent leur
                    intitulé dans ton journal. La compétence sort des calculs et de l{"'"}affichage —
                    une preuve ne disparaît pas. Tu devras la désarchiver pour la remettre au
                    périmètre.
                  </p>
                </BandeauInfo>
                <div className="flex flex-wrap items-center gap-2">
                  {confirmeRetrait ? (
                    <>
                      <Bouton
                        disabled={enCours}
                        onClick={() => agir(() => archiverCompetence(cible.code))}
                        variante="secondaire"
                      >
                        {enCours ? "Archivage…" : "Confirmer l'archivage"}
                      </Bouton>
                      <button
                        type="button"
                        onClick={() => setConfirmeRetrait(false)}
                        className="text-[0.6875rem] text-texte-attenue hover:text-texte"
                      >
                        Annuler
                      </button>
                    </>
                  ) : (
                    <Bouton onClick={() => setConfirmeRetrait(true)} variante="secondaire">
                      Archiver {cible.code}
                    </Bouton>
                  )}
                  {/* Le geste doux, à côté du destructeur — et réversible, lui. */}
                  <Bouton
                    disabled={enCours}
                    onClick={() => agir(() => basculerActive(cible.code, false))}
                    variante="secondaire"
                    taille="petite"
                  >
                    Seulement la sortir du périmètre
                  </Bouton>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={onRedemander}
              disabled={enCours}
              className="text-[0.6875rem] text-texte-attenue underline-offset-2 hover:text-texte hover:underline"
            >
              Demander une autre proposition
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
