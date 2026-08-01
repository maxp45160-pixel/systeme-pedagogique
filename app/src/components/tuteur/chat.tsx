"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { classesBouton, CodeCompetence, cx, Etiquette } from "@/components/ui/primitives";
import { Depliant } from "@/components/ui/explication";
import { Markdown } from "@/components/ui/markdown";
import { preparerPromptComplet } from "@/lib/tutor/actions";
import type { SectionContexte } from "@/lib/tutor/contexte";
import {
  CLE_PROPOSITION_EXERCICE,
  CLE_PROPOSITION_REFERENTIEL,
  exerciceComplet,
  extrairePropositions,
  extrairePropositionsExercice,
  extrairePropositionsReferentiel,
  type PropositionExercice,
  type PropositionReferentiel,
  type PropositionTuteur,
} from "@/lib/tutor/proposition";

/**
 * Lien vers la fiche compétence avec le formulaire de preuve pré-rempli.
 * Défaut niveau B : une proposition vient d'une observation relayée par le
 * tuteur, pas d'une action faite directement par l'utilisateur sur sa fiche.
 */
function lienProposition(p: PropositionTuteur): string {
  const valeurs = {
    contexte: `Proposition du tuteur — ${p.preuve}`,
    commentaire: p.reserve,
    niveauPreuve: "B" as const,
  };
  return `/competences/${p.competence.toUpperCase()}?proposition=${encodeURIComponent(
    JSON.stringify(valeurs),
  )}`;
}

/**
 * Dépose une proposition d'exercice à destination du formulaire de création.
 *
 * Passe par `sessionStorage` plutôt que par l'URL : un énoncé accompagné de sa
 * correction dépasse vite la longueur exploitable d'une adresse, et la
 * troncature serait silencieuse. L'URL ne porte qu'un drapeau d'ouverture.
 */
function deposerPropositionExercice(p: PropositionExercice): void {
  try {
    window.sessionStorage.setItem(CLE_PROPOSITION_EXERCICE, JSON.stringify(p));
  } catch {
    // sessionStorage indisponible (navigation privée stricte) : on laisse
    // partir vers un formulaire vide plutôt que de bloquer la navigation.
  }
}

/** Même passage que pour l'exercice : une branche de huit compétences ne tient
 *  pas dans une adresse, et la troncature serait silencieuse. */
function deposerPropositionReferentiel(p: PropositionReferentiel): void {
  try {
    window.sessionStorage.setItem(CLE_PROPOSITION_REFERENTIEL, JSON.stringify(p));
  } catch {
    /* idem */
  }
}

/** Les sept modes rapides demandés. */
const MODES = [
  { cle: "explique", libelle: "Explique-moi", amorce: "Explique-moi " },
  { cle: "exercice", libelle: "Donne-moi un exercice", amorce: "Donne-moi un exercice sur " },
  { cle: "evalue", libelle: "Évalue-moi", amorce: "Évalue mon niveau sur " },
  { cle: "indice", libelle: "Donne-moi un indice", amorce: "Donne-moi un indice sur " },
  { cle: "corrige", libelle: "Corrige mon raisonnement", amorce: "Corrige mon raisonnement :\n\n" },
  { cle: "lacunes", libelle: "Fais le point sur mes lacunes", amorce: "Fais le point sur mes lacunes." },
  { cle: "projet", libelle: "Propose-moi un projet", amorce: "Propose-moi un projet sur " },
] as const;

interface Message {
  role: "user" | "assistant";
  content: string;
}

/**
 * État du contexte pédagogique, assemblé par le serveur et reçu en props.
 *
 * Il était auparavant récupéré au montage par un `fetch("/api/tutor")`, ce qui
 * refaisait — dans une requête HTTP distincte, donc hors du `cache()` de React
 * — le `chargerContexte()` que la page venait déjà de payer.
 */
export interface EtatContexteTuteur {
  cleConfiguree: boolean;
  modele: string;
  manifeste: SectionContexte[];
  caracteresTotal: number;
}

/* ------------------------------------------------------------------ */
/* Fix 3 : Bulle de message mémoïsée                                   */
/*                                                                     */
/* Chaque bulle calcule ses propositions et son rendu Markdown          */
/* uniquement quand son `content` change. Pendant le streaming SSE,    */
/* seul le dernier message (contenu changeant) recalcule ; tous les    */
/* messages précédents restent en cache React.                         */
/* ------------------------------------------------------------------ */

const MessageBulle = memo(function MessageBulle({
  message,
  codesCompetences,
  enFluxDirect,
}: {
  message: Message;
  codesCompetences: string[];
  /**
   * Ce message est-il celui que le tuteur est en train d'écrire ?
   *
   * Deux conséquences, et elles ont la même cause — un bloc de proposition
   * n'est pas encore un bloc tant que le flux n'est pas clos.
   *
   * 1. Correction. Les champs arrivent dans l'ordre du gabarit ; une
   *    proposition d'exercice satisfait « titre + énoncé » bien avant que
   *    Correction et Critères n'arrivent. La carte et son lien étaient rendus
   *    dès cet instant, et cliquer déposait un exercice tronqué.
   * 2. Coût. Les trois parseurs et le rendu Markdown tournaient à chaque flush
   *    sur un texte qui ne pouvait rien produire d'exploitable.
   */
  enFluxDirect: boolean;
}) {
  const analysable = message.role === "assistant" && message.content !== "" && !enFluxDirect;

  // Propositions structurées du tuteur, validées contre le
  // référentiel : on ne fabrique jamais un lien vers un code inventé.
  const propositions = analysable
    ? extrairePropositions(message.content).filter((p) =>
        codesCompetences.includes(p.competence.toUpperCase()),
      )
    : [];

  // Exercices proposés par le tuteur (ADR-004). Même contrat que
  // les preuves : rien n'est écrit tant que l'utilisateur n'a pas
  // validé le formulaire pré-rempli.
  //
  // Second filtre, après la fin du flux : une réponse peut aussi être
  // interrompue — plafond de jetons atteint, bouton « Arrêter ». `exerciceComplet`
  // écarte alors le bloc au lieu d'offrir un lien vers un demi-exercice.
  const exercices = analysable
    ? extrairePropositionsExercice(message.content).filter(exerciceComplet)
    : [];

  // Branches proposées (ADR-026). Contrairement aux deux autres, ce bloc n'est
  // PAS filtré contre le référentiel : c'est précisément celui qui a le droit
  // d'introduire des compétences qui n'existent pas encore. Le garde-fou est
  // ailleurs — le tuteur n'y écrit aucun code, l'application les attribue.
  const branches = analysable ? extrairePropositionsReferentiel(message.content) : [];

  return (
    <div
      className={cx(
        "flex flex-col gap-1.5",
        message.role === "user" ? "items-end" : "items-start",
      )}
    >
      <div
        className={cx(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm",
          message.role === "user"
            ? "bg-primaire text-primaire-contraste"
            : "border border-bordure bg-surface-2",
        )}
      >
        {message.role === "user" ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : message.content === "" ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-texte-attenue">
            <span className="size-1.5 animate-pulse rounded-full bg-primaire" />
            Le tuteur réfléchit…
          </span>
        ) : (
          <Markdown contenu={message.content} />
        )}
      </div>

      {/*
        Le tuteur n'a jamais d'accès en écriture : ce bouton ne fait
        que pré-remplir le formulaire de la fiche compétence. Seule
        ta validation explicite y déclenche l'enregistrement.
      */}
      {propositions.map((p, j) => (
        <div
          key={j}
          className="max-w-[85%] rounded-md border border-info/30 bg-info-faible px-3 py-2 text-xs"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <Etiquette ton="info">Proposition</Etiquette>
            <CodeCompetence code={p.competence.toUpperCase()} />
            {p.niveauActuel && p.niveauPropose && (
              <span className="text-texte-attenue">
                niveau {p.niveauActuel} → {p.niveauPropose}
              </span>
            )}
          </div>
          {p.preuve && <p className="mt-1 text-texte-attenue">{p.preuve}</p>}
          <Link
            href={lienProposition(p)}
            className={cx(classesBouton("secondaire", "petite"), "mt-2")}
          >
            Revoir et enregistrer
          </Link>
        </div>
      ))}

      {/*
        Exercice proposé : même garde-fou. Le bouton dépose la
        proposition puis ouvre le formulaire de création — il
        n'ajoute rien au corpus par lui-même.
      */}
      {exercices.map((ex, j) => (
        <div
          key={`ex-${j}`}
          className="max-w-[85%] rounded-md border border-primaire/30 bg-surface-2 px-3 py-2 text-xs"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <Etiquette ton="primaire">Exercice proposé</Etiquette>
            {ex.competences.map((c) => (
              <CodeCompetence key={c} code={c} />
            ))}
            {ex.difficulte && (
              <span className="text-texte-attenue">difficulté {ex.difficulte}/5</span>
            )}
          </div>
          <p className="mt-1 font-medium">{ex.titre}</p>
          <Link
            href="/exercices?proposition=1"
            onClick={() => deposerPropositionExercice(ex)}
            className={cx(classesBouton("secondaire", "petite"), "mt-2")}
          >
            Revoir et ajouter
          </Link>
        </div>
      ))}

      {/*
        Branche proposée : le seul bloc qui peut introduire des compétences
        inconnues. Rien n'est écrit ici non plus — le bouton dépose la
        proposition et ouvre l'écran de validation, où les codes sont attribués
        par l'application et où chaque intitulé reste corrigeable.
      */}
      {branches.map((b, j) => (
        <div
          key={`ref-${j}`}
          className="max-w-[85%] rounded-md border border-primaire/30 bg-surface-2 px-3 py-2 text-xs"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <Etiquette ton="primaire">Branche proposée</Etiquette>
            <span className="font-medium">{b.domaine}</span>
            <span className="text-texte-attenue">
              {b.competences.length} compétence{b.competences.length > 1 ? "s" : ""}
            </span>
          </div>
          <ul className="mt-1.5 space-y-0.5 text-texte-attenue">
            {b.competences.slice(0, 4).map((c, k) => (
              <li key={k} className="truncate">
                · {c.intitule}
              </li>
            ))}
            {b.competences.length > 4 && (
              <li className="text-texte-discret">… et {b.competences.length - 4} autre(s)</li>
            )}
          </ul>
          <Link
            href="/competences/referentiel?proposition=1"
            onClick={() => deposerPropositionReferentiel(b)}
            className={cx(classesBouton("secondaire", "petite"), "mt-2")}
          >
            Revoir et ajouter au référentiel
          </Link>
        </div>
      ))}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Fix 1 : Zone de saisie isolée                                       */
/*                                                                     */
/* `setSaisie` vit dans ce composant enfant : les frappes clavier ne   */
/* déclenchent plus le re-render du transcript ni des boucles          */
/* d'extraction. Le composant parent ne reçoit le texte qu'au submit.  */
/* ------------------------------------------------------------------ */

const ChatInput = memo(function ChatInput({
  onEnvoyer,
  onCopier,
  onArreter,
  enCours,
  cleAbsente,
  usage,
  saisieInitiale,
}: {
  onEnvoyer: (texte: string) => void;
  onCopier: (texte: string) => void;
  onArreter: () => void;
  enCours: boolean;
  cleAbsente: boolean;
  usage: string | null;
  saisieInitiale: string;
}) {
  const [saisie, setSaisie] = useState(saisieInitiale);
  const champRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="border-t border-bordure px-3 py-3">
      <div className="mb-2 flex flex-wrap gap-1">
        {MODES.map((m) => (
          <button
            key={m.cle}
            type="button"
            disabled={enCours}
            onClick={() => {
              setSaisie(m.amorce);
              champRef.current?.focus();
            }}
            className="rounded border border-bordure px-1.5 py-0.5 text-[0.6875rem] font-medium text-texte-attenue transition-colors hover:bg-surface-2 hover:text-texte disabled:opacity-50"
          >
            {m.libelle}
          </button>
        ))}
      </div>

      <textarea
        ref={champRef}
        value={saisie}
        onChange={(e) => setSaisie(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            const texte = saisie.trim();
            if (texte) {
              onEnvoyer(texte);
              setSaisie("");
            }
          }
        }}
        rows={3}
        placeholder="Pose ta question, colle ton raisonnement, demande un exercice…"
        className="w-full resize-y rounded-md border border-bordure bg-surface px-3 py-2 text-sm placeholder:text-texte-discret focus:border-primaire focus:outline-none"
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[0.625rem] text-texte-discret">
          Ctrl+Entrée pour envoyer
          {usage && <> · {usage}</>}
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onCopier(saisie)}
            className={classesBouton("secondaire", "petite")}
          >
            Copier le contexte
          </button>
          {/* Pendant la rédaction, le bouton devient la seule action utile.
              « En cours… » désactivé n'offrait aucune sortie. */}
          {enCours ? (
            <button
              type="button"
              onClick={onArreter}
              className={classesBouton("secondaire", "petite")}
            >
              Arrêter
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                const texte = saisie.trim();
                if (texte) {
                  onEnvoyer(texte);
                  setSaisie("");
                }
              }}
              disabled={!saisie.trim() || cleAbsente}
              className={classesBouton("principal", "petite")}
            >
              Envoyer
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Composant principal                                                 */
/* ------------------------------------------------------------------ */

export function ChatTuteur({
  etatInitial,
  competenceCiblee,
  amorce,
  codesCompetences,
}: {
  /** Manifeste et moteur, calculés côté serveur au rendu de la page. */
  etatInitial: EtatContexteTuteur;
  competenceCiblee?: string;
  /**
   * Message pré-écrit dans la zone de saisie, sans être envoyé — l'amorçage
   * d'un compte neuf y dépose ce que la personne vient de déclarer. Pré-remplir
   * plutôt qu'envoyer : le premier message reste le sien, relisible et
   * modifiable avant départ.
   */
  amorce?: string;
  /** Codes du référentiel — pour valider qu'une compétence citée existe vraiment. */
  codesCompetences: string[];
}) {
  // `etat` ne vient plus d'un chargement asynchrone : il est calculé par le
  // serveur et ne change pas pendant la vie du composant. Pas d'état local.
  const etat = etatInitial;
  const [messages, setMessages] = useState<Message[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [avis, setAvis] = useState<{ ton: "info" | "alerte" | "danger"; texte: string } | null>(null);
  const [usage, setUsage] = useState<string | null>(null);
  const zoneRef = useRef<HTMLDivElement>(null);

  /* ---------------------------------------------------------------- */
  /* Suivi du bas, plutôt que recadrage forcé                          */
  /*                                                                   */
  /* Le scroll était repris à chaque changement de `messages`, sans     */
  /* condition — donc à chaque flush du flux. Toute tentative de        */
  /* remonter pour relire était écrasée au flush suivant : il fallait   */
  /* attendre la fin de la rédaction pour pouvoir lire.                 */
  /*                                                                   */
  /* On ne recadre plus que si l'utilisateur était déjà en bas. Sinon   */
  /* on le laisse où il est, et on le lui dit.                          */
  /* ---------------------------------------------------------------- */

  /**
   * Marge sous laquelle on considère qu'on est « en bas ».
   *
   * Pas zéro : `scrollHeight - scrollTop - clientHeight` n'atteint pas
   * l'égalité exacte quand le navigateur arrondit au sous-pixel, et un
   * décalage d'une frame suffirait à croire l'utilisateur parti lire plus haut.
   */
  const SEUIL_BAS_PX = 64;

  const suitLeBas = useRef(true);
  const [detache, setDetache] = useState(false);

  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    const surScroll = () => {
      const auBas = zone.scrollHeight - zone.scrollTop - zone.clientHeight < SEUIL_BAS_PX;
      suitLeBas.current = auBas;
      setDetache(!auBas);
    };
    zone.addEventListener("scroll", surScroll, { passive: true });
    return () => zone.removeEventListener("scroll", surScroll);
  }, []);

  const rafScroll = useRef<number>(0);
  useEffect(() => {
    // L'allongement du contenu ne déclenche pas d'événement `scroll` : la
    // valeur lue ici est bien celle du dernier mouvement réel de l'utilisateur.
    if (!suitLeBas.current) return;
    cancelAnimationFrame(rafScroll.current);
    rafScroll.current = requestAnimationFrame(() => {
      zoneRef.current?.scrollTo({ top: zoneRef.current.scrollHeight });
    });
    return () => cancelAnimationFrame(rafScroll.current);
  }, [messages]);

  const reprendreLeSuivi = useCallback(() => {
    suitLeBas.current = true;
    setDetache(false);
    const zone = zoneRef.current;
    if (zone) zone.scrollTo({ top: zone.scrollHeight });
  }, []);

  /* ---------------------------------------------------------------- */
  /* Accumulation par ref + flush cadencé                              */
  /*                                                                   */
  /* Pendant le flux SSE les jetons arrivent plus vite que le          */
  /* rafraîchissement écran. Au lieu de `setMessages` à chaque jeton    */
  /* (→ re-render complet × nombre de jetons), on accumule dans un ref  */
  /* et on ne publie qu'à intervalle fixe.                              */
  /*                                                                   */
  /* La cadence était celle de `requestAnimationFrame`, soit ~60 Hz.    */
  /* Chaque publication reconstruit le Markdown du message entier ; à   */
  /* 60 Hz sur une réponse longue, le rendu ne suit plus. L'œil ne fait */
  /* pas la différence à 15 Hz, le navigateur si.                       */
  /* ---------------------------------------------------------------- */
  const DELAI_FLUSH_MS = 66;

  const accumuleRef = useRef("");
  const historiqueRef = useRef<Message[]>([]);
  const flushRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const annulerFlush = useCallback(() => {
    if (flushRef.current !== null) {
      clearTimeout(flushRef.current);
      flushRef.current = null;
    }
  }, []);

  const flushAccumule = useCallback(() => {
    flushRef.current = null;
    setMessages([...historiqueRef.current, { role: "assistant", content: accumuleRef.current }]);
  }, []);

  const planifierFlush = useCallback(() => {
    if (flushRef.current === null) {
      flushRef.current = setTimeout(flushAccumule, DELAI_FLUSH_MS);
    }
  }, [flushAccumule]);

  // Un flux encore en vol au démontage laisserait un `setMessages` sans cible.
  useEffect(() => annulerFlush, [annulerFlush]);

  /* Miroirs des états lus par `envoyer`. Sans eux, `envoyer` changerait
   * d'identité à chaque message et à chaque changement d'état, ce qui
   * invaliderait le `memo` de `ChatInput` et rendrait son isolation — le
   * correctif de la saisie — inopérante dès le deuxième tour. */
  const messagesRef = useRef<Message[]>([]);
  const enCoursRef = useRef(false);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    enCoursRef.current = enCours;
  }, [enCours]);

  /**
   * Flux en cours, pour pouvoir l'interrompre.
   *
   * Il n'y en avait aucun : une réponse partie allait jusqu'au bout, même
   * manifestement hors sujet, et le seul recours était d'attendre.
   */
  const abandonRef = useRef<AbortController | null>(null);

  const arreter = useCallback(() => {
    abandonRef.current?.abort();
  }, []);

  const envoyer = useCallback(async (texte: string) => {
    const contenu = texte.trim();
    if (!contenu || enCoursRef.current) return;

    setAvis(null);
    setUsage(null);
    const historique: Message[] = [...messagesRef.current, { role: "user", content: contenu }];
    historiqueRef.current = historique;
    accumuleRef.current = "";
    setMessages([...historique, { role: "assistant", content: "" }]);
    setEnCours(true);
    // Envoyer, c'est vouloir lire la réponse : on raccroche le suivi du bas,
    // quelle qu'ait été la position avant.
    suitLeBas.current = true;
    setDetache(false);

    const abandon = new AbortController();
    abandonRef.current = abandon;

    try {
      // L'historique part en entier, volontairement : c'est la route qui
      // décide ce qui atteint le modèle (`fenetrerHistorique`). Elle a besoin
      // du compte de tours réel pour le chargement conditionnel des
      // protocoles (ADR-021) ; fenêtrer ici lui ferait perdre cette
      // information, et la borne serait appliquée deux fois.
      const reponse = await fetch("/api/tutor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: historique }),
        signal: abandon.signal,
      });

      if (!reponse.ok || !reponse.body) {
        const donnees = await reponse.json().catch(() => null);
        setMessages(historique);
        setAvis({
          ton: "alerte",
          texte:
            donnees?.message ??
            "Le tuteur n'a pas pu répondre. Utilise le mode « copier le contexte » ci-dessous.",
        });
        return;
      }

      const lecteur = reponse.body.getReader();
      const decodeur = new TextDecoder();
      let tampon = "";

      // Lecture du flux SSE : découpage sur la ligne vide séparant les événements.
      for (;;) {
        const { done, value } = await lecteur.read();
        if (done) break;
        tampon += decodeur.decode(value, { stream: true });

        let coupure: number;
        while ((coupure = tampon.indexOf("\n\n")) !== -1) {
          const brut = tampon.slice(0, coupure);
          tampon = tampon.slice(coupure + 2);

          const ligneEvenement = brut.split("\n").find((l) => l.startsWith("event: "));
          const ligneDonnees = brut.split("\n").find((l) => l.startsWith("data: "));
          if (!ligneEvenement || !ligneDonnees) continue;

          const type = ligneEvenement.slice(7).trim();
          let donnees: Record<string, unknown>;
          try {
            donnees = JSON.parse(ligneDonnees.slice(6));
          } catch {
            continue;
          }

          if (type === "texte") {
            accumuleRef.current += String(donnees.delta ?? "");
            planifierFlush();
          } else if (type === "refus" || type === "erreur") {
            setAvis({
              ton: type === "refus" ? "alerte" : "danger",
              texte: String(donnees.message ?? "Erreur."),
            });
          } else if (type === "tronque") {
            setAvis({ ton: "info", texte: String(donnees.message ?? "") });
          } else if (type === "fin") {
            const u = donnees.usage as Record<string, number> | undefined;
            if (u) {
              setUsage(
                `${u.entree} jetons en entrée (dont ${u.cacheLu} lus en cache) · ${u.sortie} en sortie`,
              );
            }
          }
        }
      }

      // Flush final : s'assurer que le dernier contenu est bien dans le state
      annulerFlush();
      const final = accumuleRef.current;
      if (final.trim() === "") {
        setMessages(historique);
      } else {
        setMessages([...historique, { role: "assistant", content: final }]);
      }
    } catch (e) {
      annulerFlush();

      // Une interruption voulue n'est pas une panne : ce qui est arrivé avant
      // le clic a été lu, et le jeter serait perdre le seul travail du tour.
      // Les cartes de proposition, elles, restent écartées — `exerciceComplet`
      // rejette un bloc inachevé (cf. `MessageBulle`).
      const annule = e instanceof DOMException && e.name === "AbortError";
      const final = accumuleRef.current;

      if (annule) {
        if (final.trim() === "") {
          setMessages(historique);
        } else {
          setMessages([...historique, { role: "assistant", content: final }]);
        }
        setAvis({ ton: "info", texte: "Réponse interrompue. Le texte déjà reçu est conservé." });
      } else {
        setMessages(historique);
        setAvis({
          ton: "danger",
          texte: e instanceof Error ? e.message : "Erreur réseau pendant la réponse.",
        });
      }
    } finally {
      abandonRef.current = null;
      setEnCours(false);
    }
  }, [annulerFlush, planifierFlush]);

  const copierContexte = useCallback(async (saisie: string) => {
    try {
      const prompt = await preparerPromptComplet(saisie);
      await navigator.clipboard.writeText(prompt);
      setAvis({
        ton: "info",
        texte: `Contexte complet copié (${prompt.length.toLocaleString("fr-FR")} caractères). Colle-le dans Claude, puis saisis la réponse du tuteur dans l'exercice ou le journal.`,
      });
    } catch {
      setAvis({ ton: "danger", texte: "Copie impossible : le presse-papier est inaccessible." });
    }
  }, []);

  const cleAbsente = !etat.cleConfiguree;

  const saisieInitiale =
    amorce ?? (competenceCiblee ? `Donne-moi un exercice sur ${competenceCiblee}.` : "");

  return (
    <div className="space-y-4 [&>*]:min-w-0">
      <div>
        <div className="flex h-[min(70vh,620px)] flex-col rounded-carte border border-bordure bg-surface">
          {/* Conversation */}
          <div ref={zoneRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="py-6 text-center">
                <p className="text-sm font-medium">Le tuteur connaît ton profil</p>
                <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-texte-attenue">
                  Il reçoit les protocoles du système et l&apos;état réel de tes{" "}
                  {codesCompetences.length} compétences, calculé depuis tes preuves. Il ne peut
                  pas modifier ton profil : il propose des mises à jour que tu valides.
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <MessageBulle
                key={i}
                message={m}
                codesCompetences={codesCompetences}
                // Seul le dernier message peut être en cours de rédaction. Le
                // passer aux autres les ferait tous re-rendre au démarrage et à
                // la fin du flux, pour rien.
                enFluxDirect={enCours && i === messages.length - 1}
              />
            ))}
          </div>

          {/*
            Le suivi du bas a été relâché parce que l'utilisateur est remonté
            lire. On ne le ramène pas de force — on lui laisse le geste.
          */}
          {detache && (
            <div className="relative">
              <button
                type="button"
                onClick={reprendreLeSuivi}
                className={cx(
                  classesBouton("secondaire", "petite"),
                  "absolute -top-10 right-4 shadow-md",
                )}
              >
                ↓ Reprendre le suivi
              </button>
            </div>
          )}

          {avis && (
            <div
              className={cx(
                "border-t px-4 py-2 text-xs",
                avis.ton === "info" && "border-info/30 bg-info-faible text-info",
                avis.ton === "alerte" && "border-alerte/30 bg-alerte-faible text-alerte",
                avis.ton === "danger" && "border-danger/30 bg-danger-faible text-danger",
              )}
            >
              {avis.texte}
            </div>
          )}

          {/* Saisie — composant isolé (Fix 1) */}
          <ChatInput
            onEnvoyer={envoyer}
            onCopier={copierContexte}
            onArreter={arreter}
            enCours={enCours}
            cleAbsente={cleAbsente}
            usage={usage}
            saisieInitiale={saisieInitiale}
          />
        </div>
      </div>

      {/*
        Contexte réellement transmis.

        Il occupait un tiers de la largeur en permanence, alors qu'on ne le
        consulte qu'en cas de doute. Il passe au repos derrière un `<details>`
        natif — donc consultable sans JavaScript, et sans qu'une seule ligne
        d'information soit retirée : la traçabilité exigée par le protocole
        (« aucune valeur sans source ») tient à ce que l'information soit
        atteignable, pas à ce qu'elle soit dépliée.

        L'encart « clé absente » reste, lui, hors du dépliant : il est
        actionnable, le masquer transformerait une panne explicable en panne
        muette.
      */}
      <Depliant
        resume={`Contexte transmis — ${(etat.caracteresTotal / 1000).toFixed(1)} k caractères · ${etat.modele}`}
      >
        <div className="space-y-4">
          <div className="rounded-carte border border-bordure bg-surface">
          <div className="border-b border-bordure px-4 py-3">
            <div className="flex items-center gap-2">
              {/* Le contexte est assemblé par le serveur : il est chargé dès le
                  premier rendu, il n'y a plus d'état « en attente ». */}
              <span className="size-1.5 rounded-full bg-succes" />
              <h2 className="text-[0.9375rem] font-semibold tracking-tight">
                Contexte pédagogique chargé
              </h2>
            </div>
            <p className="mt-1 text-xs text-texte-attenue">
              Contenu exact transmis au modèle à chaque message. Rien d&apos;autre n&apos;est
              connu du tuteur.
            </p>
          </div>

          <ul className="divide-y divide-bordure">
            {etat.manifeste.map((s, i) => (
              <li key={i} className="flex items-baseline justify-between gap-2 px-4 py-2">
                <span className="min-w-0 text-xs">
                  {s.nom}
                  {s.origine === "fichier" && (
                    <span className="ml-1 text-[0.625rem] text-texte-discret">fichier</span>
                  )}
                </span>
                <span className="chiffres shrink-0 text-[0.6875rem] text-texte-discret">
                  {(s.caracteres / 1000).toFixed(1)} k car.
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-bordure px-4 py-3 text-xs">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-texte-attenue">Total</span>
              <span className="chiffres font-medium">
                {(etat.caracteresTotal / 1000).toFixed(1)} k caractères
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="text-texte-attenue">Modèle</span>
              <span className="font-mono text-[0.6875rem]">{etat.modele}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="text-texte-attenue">Clé API</span>
              <Etiquette ton={etat.cleConfiguree ? "succes" : "alerte"}>
                {etat.cleConfiguree ? "configurée" : "absente"}
              </Etiquette>
            </div>
          </div>
          </div>

          <div className="rounded-carte border border-bordure bg-surface px-4 py-3 text-xs text-texte-attenue">
            <p className="font-medium text-texte">Ce que le tuteur ne peut pas faire</p>
            <ul className="mt-1.5 space-y-1">
              <li>· Écrire dans ton profil — il propose, tu valides.</li>
              <li>· Se souvenir d&apos;une séance absente du contexte ci-dessus.</li>
              <li>· Affirmer une maîtrise que les preuves ne soutiennent pas.</li>
            </ul>
          </div>
        </div>
      </Depliant>

      {cleAbsente && (
        <div className="rounded-carte border border-alerte/30 bg-alerte-faible px-4 py-3 text-xs">
          <p className="font-medium text-alerte">Aucune clé API configurée</p>
          <p className="mt-1 text-texte-attenue">
            Le chat intégré est désactivé — il ne simulera pas de réponse. Deux options :
          </p>
          <ol className="mt-2 space-y-1 pl-4 text-texte-attenue">
            <li className="list-decimal">
              Utiliser <strong>« Copier le contexte »</strong> et coller le prompt dans Claude.
            </li>
            <li className="list-decimal">
              Créer <code className="font-mono">app/.env.local</code> avec{" "}
              <code className="font-mono">ANTHROPIC_API_KEY=…</code>, puis relancer le serveur.
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
