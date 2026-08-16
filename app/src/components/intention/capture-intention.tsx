"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modale } from "@/components/ui/modale";
import { Bouton, cx, PointActif } from "@/components/ui/primitives";
import { IconeFleche } from "@/components/ui/icones";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";
import { creerNoteAction } from "@/lib/store/document-actions";
import { FORMATS_PAR_ROLE } from "@/lib/documents/roles-note";
import { ModaleReferentiel } from "@/components/referentiel/modale-referentiel";
import { ParcoursNouveauProjet } from "@/components/projets/modale-nouveau-projet";
import {
  BESOIN_MAX,
  besoinValide,
  urlComposition,
  type ActionIntention,
  type TraductionIntention,
} from "@/lib/domain/intention";

/**
 * Le point d'entrée unique de création.
 *
 * Il remplace treize modales qui demandaient chacune de choisir un **objet** —
 * compétence, thème, exercice, séance, note, projet — avant de pouvoir dire
 * quoi que ce soit. Ici on décrit un besoin, et le moteur choisit l'objet.
 *
 * Ce composant n'exécute jamais directement : il **oriente** vers une surface
 * qui existait déjà. Un travail part au compositeur de séance, une ressource
 * passe par la création de note, une extension de référentiel ouvre la
 * proposition de branche avec son sujet pré-rempli. Aucun nouveau chemin
 * d'écriture n'est ouvert ici, et la validation humaine reste là où elle était.
 */

const PLACEHOLDER = "Ex. j'ai un contrôle sur les stocks vendredi et je bloque sur le calcul de coût";

type Phase = "saisie" | "traduction" | "proposition";

const LIBELLES_ACTION: Record<ActionIntention["genre"], string> = {
  travail: "S'entraîner",
  projet: "Produire",
  note: "Ressource",
  referentiel: "Référentiel",
};

export function CaptureIntention({
  compteId,
  onFermer,
}: {
  compteId: string;
  onFermer: () => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("saisie");
  const [besoin, setBesoin] = useState("");
  const [traduction, setTraduction] = useState<TraductionIntention | null>(null);
  const [progression, setProgression] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enExecution, setEnExecution] = useState(false);

  /*
   * L'extension du référentiel passe la main à la proposition de référentiel
   * complet, pas à la branche unique : « le stoïcisme » se découpe en thèmes,
   * et le même chemin traite aussi bien un sujet étroit — c'est le prompt qui
   * décide du découpage. Un seul chemin d'extension, donc, là où le tableau de
   * bord en offrait un second par sa carte de pilotage.
   */
  const [sujetBranche, setSujetBranche] = useState<string | null>(null);

  /** Le parcours de projet, qui recible lui-même les compétences depuis la phrase. */
  const [projetDemande, setProjetDemande] = useState<string | null>(null);

  const abandonRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controleur = abandonRef;
    return () => controleur.current?.abort();
  }, []);

  const traduire = useCallback(async () => {
    if (!besoinValide(besoin)) return;
    setPhase("traduction");
    setProgression(null);
    setErreur(null);

    const abandon = new AbortController();
    abandonRef.current = abandon;

    try {
      const reponse = await fetch("/api/intention", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          besoin: besoin.trim(),
          config: lireConfigTuteur(compteId) ?? undefined,
        }),
        signal: abandon.signal,
      });

      if (!reponse.ok || !reponse.body) {
        const donnees = await reponse.json().catch(() => null);
        setErreur(
          donnees?.message ??
            "La traduction n'a pas pu démarrer. Vérifie la configuration du tuteur dans les réglages.",
        );
        setPhase("saisie");
        return;
      }

      const lecteur = reponse.body.getReader();
      const decodeur = new TextDecoder();
      let tampon = "";

      for (;;) {
        const { done, value } = await lecteur.read();
        if (done) break;
        tampon += decodeur.decode(value, { stream: true });

        const evenements = tampon.split("\n\n");
        tampon = evenements.pop() ?? "";

        for (const bloc of evenements) {
          const lignes = bloc.split("\n");
          const type = lignes.find((l) => l.startsWith("event:"))?.slice(6).trim() ?? "message";
          const donnees = lignes.find((l) => l.startsWith("data:"))?.slice(5).trim();

          if (type === "proposition" && donnees) {
            const parsed = JSON.parse(donnees) as { traduction: TraductionIntention };
            setTraduction(parsed.traduction);
            setPhase("proposition");
          } else if (type === "erreur" && donnees) {
            const parsed = JSON.parse(donnees) as { message: string };
            setErreur(parsed.message);
            setPhase("saisie");
          } else if (type === "proposition-en-cours") {
            setProgression("Le moteur choisit l'action qui répond à ton besoin…");
          }
        }
      }
    } catch {
      if (!abandon.signal.aborted) {
        setErreur("Traduction interrompue.");
        setPhase("saisie");
      }
    }
  }, [besoin, compteId]);

  /**
   * Exécute l'action retenue.
   *
   * Chaque genre rejoint une surface existante. La note est le seul cas écrit
   * ici, parce qu'elle n'a pas d'écran intermédiaire : la fiche est créée puis
   * ouverte dans l'Atelier, exactement comme le faisait la carte du tableau de
   * bord qu'on retire.
   */
  const executer = useCallback(
    async (action: ActionIntention) => {
      setErreur(null);

      if (action.genre === "travail") {
        onFermer();
        router.push(urlComposition(action.codes, action.titre));
        return;
      }

      if (action.genre === "projet") {
        setProjetDemande(action.sujet || action.titre);
        return;
      }

      if (action.genre === "referentiel") {
        setSujetBranche(action.sujet || action.titre);
        return;
      }

      setEnExecution(true);
      try {
        const fiche = await creerNoteAction(
          "support",
          FORMATS_PAR_ROLE.support[0].valeur,
          action.titre,
          // Le besoin exprimé EST le contexte de la fiche : le retaper serait
          // redemander ce qui vient d'être dit.
          { contexte: besoin.trim(), domaine: "transversal" },
        );
        onFermer();
        router.push(`/atelier?note=${encodeURIComponent(fiche.id)}`);
        router.refresh();
      } catch (cause) {
        setErreur(cause instanceof Error ? cause.message : "Création impossible.");
      } finally {
        setEnExecution(false);
      }
    },
    [besoin, onFermer, router],
  );

  if (projetDemande !== null) {
    return (
      <ParcoursNouveauProjet
        accountId={compteId}
        intentionInitiale={projetDemande}
        onFermer={onFermer}
      />
    );
  }

  if (sujetBranche !== null) {
    return (
      <ModaleReferentiel
        compteId={compteId}
        sujetInitial={sujetBranche}
        demarrageAutomatique
        onFermer={onFermer}
      />
    );
  }

  return (
    <Modale
      titre="De quoi as-tu besoin ?"
      sousTitre="Décris-le comme tu le dirais à voix haute. Le système choisit quoi faire — tu confirmes."
      largeur="xl"
      onFermer={onFermer}
      pied={
        phase === "saisie" ? (
          <>
            <Bouton variante="secondaire" onClick={onFermer}>
              Annuler
            </Bouton>
            <Bouton variante="principal" onClick={traduire} disabled={!besoinValide(besoin)}>
              Traduire en action
            </Bouton>
          </>
        ) : phase === "proposition" ? (
          <Bouton
            variante="secondaire"
            onClick={() => {
              setTraduction(null);
              setPhase("saisie");
            }}
          >
            Reformuler
          </Bouton>
        ) : undefined
      }
    >
      {phase === "traduction" && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <PointActif />
          <p className="mt-4 font-serif text-base text-texte">
            {progression ?? "Le moteur lit ton besoin…"}
          </p>
          <p className="mt-1 text-xs text-texte-discret">
            Rien n&apos;est enregistré : tu reliras l&apos;action avant qu&apos;elle ne se lance.
          </p>
          <Bouton
            onClick={() => {
              abandonRef.current?.abort();
              setPhase("saisie");
            }}
            variante="secondaire"
            taille="petite"
            className="mt-5"
          >
            Interrompre
          </Bouton>
        </div>
      )}

      {phase === "saisie" && (
        <div className="space-y-3">
          <textarea
            value={besoin}
            onChange={(event) => setBesoin(event.target.value.slice(0, BESOIN_MAX))}
            onKeyDown={(event) => {
              // Entrée valide, Maj+Entrée passe à la ligne : la saisie courante
              // est une phrase, pas un paragraphe.
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void traduire();
              }
            }}
            rows={3}
            placeholder={PLACEHOLDER}
            autoFocus
            className="w-full resize-none rounded-lg border border-bordure-controle bg-surface px-3 py-2.5 text-sm outline-none focus:border-primaire"
          />
          <p className="text-xs text-texte-discret">
            Un besoin, pas un objet : le système décide s&apos;il faut s&apos;entraîner, déposer une
            ressource, ou étendre le référentiel.
          </p>
          {erreur && (
            <p className="rounded-lg bg-danger-faible px-3 py-2 text-xs text-danger">{erreur}</p>
          )}
        </div>
      )}

      {phase === "proposition" && traduction && (
        <div className="space-y-4">
          <PropositionPrincipale
            action={traduction.action}
            enExecution={enExecution}
            onExecuter={() => void executer(traduction.action)}
          />

          {traduction.alternatives.length > 0 && (
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
                Ou bien
              </p>
              <div className="mt-2 grid gap-2">
                {traduction.alternatives.map((alternative, index) => (
                  <button
                    key={`${alternative.genre}-${index}`}
                    type="button"
                    disabled={enExecution}
                    onClick={() => void executer(alternative)}
                    className="group flex items-start justify-between gap-3 rounded-xl border border-bordure bg-surface-2 p-3 text-left transition-colors hover:border-primaire/35 hover:bg-primaire-faible/35 disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{alternative.titre}</span>
                      <span className="mt-1 block text-xs text-texte-discret">
                        {LIBELLES_ACTION[alternative.genre]} · {alternative.pourquoi}
                      </span>
                    </span>
                    <IconeFleche className="mt-0.5 size-3.5 shrink-0 text-texte-discret group-hover:text-primaire" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {erreur && (
            <p className="rounded-lg bg-danger-faible px-3 py-2 text-xs text-danger">{erreur}</p>
          )}
        </div>
      )}
    </Modale>
  );
}

function PropositionPrincipale({
  action,
  enExecution,
  onExecuter,
}: {
  action: ActionIntention;
  enExecution: boolean;
  onExecuter: () => void;
}) {
  return (
    <div className="rounded-xl border border-primaire/35 bg-primaire-faible/35 p-4">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-primaire">
        {LIBELLES_ACTION[action.genre]}
      </p>
      <p className="mt-2 font-serif text-lg font-medium">{action.titre}</p>
      <p className="mt-1.5 text-sm text-texte-attenue">{action.pourquoi}</p>

      {action.codes.length > 0 && (
        <p className="mt-2.5 font-mono text-[0.6875rem] text-texte-discret">
          {action.codes.join(" · ")}
        </p>
      )}

      <Bouton
        variante="principal"
        onClick={onExecuter}
        enChargement={enExecution}
        className={cx("mt-4", enExecution && "pointer-events-none")}
      >
        Lancer
      </Bouton>
    </div>
  );
}
