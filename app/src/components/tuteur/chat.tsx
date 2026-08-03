"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { classesBouton, CodeCompetence, cx, Etiquette } from "@/components/ui/primitives";
import { Depliant } from "@/components/ui/explication";
import { Markdown } from "@/components/ui/markdown";
import { preparerPromptComplet } from "@/lib/tutor/actions";
import type { SectionContexte } from "@/lib/tutor/contexte";
import { MAX_MESSAGES_FENETRE } from "@/lib/tutor/fenetre";
import { useEstHydrate } from "@/lib/ui/hydratation";
import { cleParCompte, ecrireSession, effacerSession, lireSession } from "@/lib/ui/stockage-session";
import {
  EVENEMENT_CHANGEMENT_CONFIG,
  decrireConfigClient,
  lireConfigTuteur,
  type ConfigTuteurClient,
} from "@/lib/tutor/cle-client";
import {
  OUTIL_EXERCICE,
  OUTIL_PREUVE,
  OUTIL_REFERENTIEL,
  type PropositionRecue,
} from "@/lib/tutor/outils";
import {
  extrairePropositions,
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
 * Ce qu'on affiche pendant qu'un outil se remplit.
 *
 * Nommer l'outil plutôt que dire « en cours » : la rédaction d'un exercice
 * prend nettement plus longtemps que celle d'une preuve, et savoir laquelle
 * on attend est la différence entre patienter et croire à une panne.
 */
const LIBELLE_OUTIL: Record<string, string> = {
  [OUTIL_EXERCICE]: "Le tuteur rédige un exercice — énoncé, indices, correction, critères…",
  [OUTIL_PREUVE]: "Le tuteur prépare une proposition de preuve…",
  [OUTIL_REFERENTIEL]: "Le tuteur compose une branche de compétences…",
};

/** Les six modes rapides — « Donne-moi un exercice » a disparu (lot 1.4). */
const MODES = [
  { cle: "explique", libelle: "Explique-moi", amorce: "Explique-moi " },
  { cle: "evalue", libelle: "Évalue-moi", amorce: "Évalue mon niveau sur " },
  { cle: "indice", libelle: "Donne-moi un indice", amorce: "Donne-moi un indice sur " },
  { cle: "corrige", libelle: "Corrige mon raisonnement", amorce: "Corrige mon raisonnement :\n\n" },
  { cle: "lacunes", libelle: "Fais le point sur mes lacunes", amorce: "Fais le point sur mes lacunes." },
  { cle: "projet", libelle: "Propose-moi un projet", amorce: "Propose-moi un projet sur " },
] as const;

interface Message {
  role: "user" | "assistant";
  content: string;
  /**
   * Propositions reçues en sortie structurée (lot 3.2).
   *
   * Présentes seulement quand le moteur sait appeler un outil. Absentes, les
   * parseurs de `proposition.ts` reprennent la main sur le texte — c'est le
   * filet, tant que la bascule n'est pas vérifiée sur les deux moteurs.
   *
   * Conservées avec le message dans `sessionStorage` : les recalculer depuis le
   * texte à la relecture est précisément ce qu'on cherche à ne plus faire.
   */
  propositions?: PropositionRecue[];
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
  /*
   * Deux sources possibles, jamais les deux à la fois.
   *
   * Le moteur sait appeler un outil : les propositions sont arrivées validées
   * contre un schéma, en fin de tour. Rien à relire dans le texte — et surtout,
   * rien à relire DEUX fois : un tuteur qui appelle l'outil ET recopie le bloc
   * en markdown afficherait la carte en double.
   *
   * Il ne le sait pas (repli de `compatible-openai.ts`, ou mode « copier le
   * contexte ») : les parseurs reprennent la main, avec leurs limites connues.
   */
  const recues = message.propositions;
  const analysable =
    recues === undefined && message.role === "assistant" && message.content !== "" && !enFluxDirect;

  // Preuves proposées, validées contre le référentiel dans les deux cas : on ne
  // fabrique jamais un lien vers un code inventé.
  const propositions = (
    recues
      ? recues.flatMap((r) => (r.genre === "preuve" ? [r.preuve] : []))
      : analysable
        ? extrairePropositions(message.content)
        : []
  ).filter((p) => codesCompetences.includes(p.competence.toUpperCase()));


  return (
    <div
      className={cx(
        "flex flex-col gap-1.5",
        message.role === "user" ? "items-end" : "items-start",
      )}
    >
      <div
        className={cx(
          "max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm",
          message.role === "user"
            ? "bg-primaire text-primaire-contraste"
            : "border border-bordure bg-surface-2",
        )}
      >
        {message.role === "user" ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : message.content === "" ? (
          /* Un message vide *avec* propositions n'attend rien : le tuteur a
             appelé l'outil sans commenter. Afficher « réfléchit… » sous une
             carte déjà rendue annoncerait un travail en cours qui n'existe pas. */
          recues && recues.length > 0 ? (
            <span className="text-xs text-texte-attenue">Proposition ci-dessous.</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-texte-attenue">
              <span className="size-1.5 animate-pulse rounded-full bg-primaire" />
              Le tuteur réfléchit…
            </span>
          )
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
          className="max-w-[85%] rounded-md border border-info/30 bg-info-faible px-3.5 py-2.5 text-xs"
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
  onReinitialiser,
  enCours,
  cleAbsente,
  usage,
  saisieInitiale,
}: {
  onEnvoyer: (texte: string) => void;
  onCopier: (texte: string) => void;
  onArreter: () => void;
  /** Absent quand il n'y a rien à effacer : le bouton ne s'affiche pas. */
  onReinitialiser?: () => void;
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
            /*
             * Le raccourci doit dire exactement ce que dit le bouton.
             *
             * Il ne consultait pas `enCours` : pendant une génération,
             * `envoyer` sortait immédiatement mais `setSaisie("")` s'exécutait
             * quand même. Le message tapé disparaissait sans partir ni laisser
             * de trace — c'est le « le tuteur plante quand on enchaîne » le
             * plus fréquent, et ce n'était pas le tuteur.
             *
             * Le bouton, lui, est remplacé par « Arrêter » dans cet état : le
             * chemin clavier était le seul trou.
             */
            if (enCours) return;
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
          {onReinitialiser && !enCours && (
            <button
              type="button"
              onClick={onReinitialiser}
              title="Efface les messages affichés. Tes preuves et tes exercices ne sont pas touchés."
              className={classesBouton("secondaire", "petite")}
            >
              Réinitialiser
            </button>
          )}
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

export interface ProprietesChat {
  /** Manifeste et moteur, calculés côté serveur au rendu de la page. */
  etatInitial: EtatContexteTuteur;
  competenceCiblee?: string;
  amorce?: string;
  /**
   * Exercice depuis lequel on est arrivé (`/tuteur?exercice=…`).
   *
   * Renvoyé à la route à chaque message : c'est ce qui met l'énoncé dans le
   * contexte, plutôt que d'obliger à le recoller à la main.
   */
  exerciceCible?: string;
  codesCompetences: string[];
  /** Compte courant — isole la conversation conservée (voir `stockage-session`). */
  compteId: string;
}

/**
 * Le chat ne se monte qu'une fois le navigateur disponible.
 *
 * Sa conversation vit dans `sessionStorage`, que le serveur ne peut pas lire.
 * Monter d'abord un chat vide puis y injecter l'historique dans un effet
 * marcherait, au prix d'une cascade de rendus et d'une amorce pré-remplie qu'il
 * faudrait retirer juste après. On attend plutôt l'hydratation, et l'état part
 * du bon pied dès le premier rendu réel.
 *
 * Le cadre est rendu en attendant, à sa hauteur définitive : rien ne saute.
 */
export function ChatTuteur(props: ProprietesChat) {
  const hydrate = useEstHydrate();
  if (!hydrate) {
    return (
      <div className="space-y-4 [&>*]:min-w-0">
        <div className="h-[min(70vh,620px)] rounded-carte border border-bordure bg-surface" />
      </div>
    );
  }
  return <ChatHydrate {...props} />;
}

function ChatHydrate({
  etatInitial,
  competenceCiblee,
  amorce,
  exerciceCible,
  codesCompetences,
  compteId,
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
  /** Exercice ouvert, transmis à la route pour que son énoncé entre au contexte. */
  exerciceCible?: string;
  /** Codes du référentiel — pour valider qu'une compétence citée existe vraiment. */
  codesCompetences: string[];
  /** Compte courant — isole la conversation conservée (voir `stockage-session`). */
  compteId: string;
}) {
  // `etat` ne vient plus d'un chargement asynchrone : il est calculé par le
  // serveur et ne change pas pendant la vie du composant. Pas d'état local.
  const etatServeur = etatInitial;

  /**
   * Configuration saisie côté client (réglages), si présente.
   *
   * Elle prime sur l'état serveur (`cleConfiguree`, `modele`) : l'utilisateur
   * qui a saisi sa clé dans les réglages n'a pas à éditer `app/.env.local`.
   * Lue dans l'initialiseur (le composant n'est monté qu'après hydratation) et
   * rafraîchie sur l'événement de changement diffusé par `cle-client.ts` —
   * sauvegarder une clé dans les réglages met le chat à jour sans recharger.
   */
  const [configClient, setConfigClient] = useState<ConfigTuteurClient | null>(() =>
    lireConfigTuteur(compteId),
  );
  useEffect(() => {
    function surChangement() {
      setConfigClient(lireConfigTuteur(compteId));
    }
    window.addEventListener(EVENEMENT_CHANGEMENT_CONFIG, surChangement);
    return () => window.removeEventListener(EVENEMENT_CHANGEMENT_CONFIG, surChangement);
  }, [compteId]);

  const etat = {
    ...etatServeur,
    cleConfiguree: etatServeur.cleConfiguree || configClient !== null,
    modele: configClient ? decrireConfigClient(configClient) : etatServeur.modele,
  };

  const cleConversation = cleParCompte("conversation", compteId);

  /**
   * La conversation reprend là où elle s'était arrêtée.
   *
   * `ChatTuteur` est démonté à toute navigation — y compris celle que ses
   * propres cartes de proposition provoquent. Aller relire une proposition
   * dans `/exercices` et revenir remontait un chat vide : la conversation ne
   * survivait pas au geste que l'interface elle-même propose.
   *
   * Lecture dans l'initialiseur, jamais dans un effet : le composant n'est
   * monté qu'une fois le navigateur disponible (voir `ChatTuteur` ci-dessus).
   *
   * Même borne qu'à l'envoi (`fenetrerHistorique`) : au-delà, ces messages
   * n'atteindraient pas le modèle, et les afficher laisserait croire à une
   * mémoire que le tuteur n'a pas.
   */
  const [messages, setMessages] = useState<Message[]>(
    () => lireSession<Message[]>(cleConversation)?.slice(-MAX_MESSAGES_FENETRE) ?? [],
  );
  const [enCours, setEnCours] = useState(false);
  const [avis, setAvis] = useState<{ ton: "info" | "alerte" | "danger"; texte: string } | null>(null);
  const [usage, setUsage] = useState<string | null>(null);
  /** Outil que le tuteur est en train de remplir, `null` sinon. */
  const [outilEnCours, setOutilEnCours] = useState<string | null>(null);
  const zoneRef = useRef<HTMLDivElement>(null);

  /**
   * Écriture seulement au repos.
   *
   * Pendant la rédaction, `messages` change 15 fois par seconde ; sérialiser à
   * cette cadence coûterait plus que le flux lui-même, pour n'enregistrer que
   * des états intermédiaires.
   */
  useEffect(() => {
    if (enCours) return;
    if (messages.length === 0) effacerSession(cleConversation);
    else ecrireSession(cleConversation, messages);
  }, [messages, enCours, cleConversation]);

  const reinitialiserConversation = useCallback(() => {
    setMessages([]);
    setAvis(null);
    setUsage(null);
    effacerSession(cleConversation);
  }, [cleConversation]);

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
  /**
   * Propositions validées reçues pendant le tour (lot 3.2).
   *
   * Un ref, comme le texte : elles arrivent en fin de flux et ne sont publiées
   * qu'avec le message final. Les pousser dans l'état à l'arrivée ferait
   * apparaître la carte avant la dernière ligne de la réponse.
   */
  const propositionsRef = useRef<PropositionRecue[]>([]);
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

  /*
   * Au démontage : couper le timer ET le flux.
   *
   * Seul le timer l'était. Le `fetch` restait en vol, et comme la route ne
   * consultait pas `request.signal` (corrigé côté serveur dans le même lot), la
   * génération continuait chez le fournisseur — jetons facturés pour un texte
   * que plus personne n'affichait. Or le chat est démonté par ses PROPRES
   * cartes de proposition : cliquer « Revoir et ajouter » suffisait à le
   * déclencher.
   */
  useEffect(
    () => () => {
      annulerFlush();
      abandonRef.current?.abort();
    },
    [annulerFlush],
  );

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

  /**
   * Publie la réponse du tour : texte accumulé + propositions validées.
   *
   * Un seul endroit, appelé aussi bien à la fin normale qu'à l'interruption.
   * Les deux chemins écrivaient le même bloc ; les propositions structurées en
   * auraient fait un troisième oubli possible.
   *
   * Un message sans texte MAIS avec une proposition est publié quand même : le
   * tuteur peut n'avoir appelé que l'outil, et jeter le message emporterait la
   * carte avec lui.
   */
  const publierReponse = useCallback((historique: Message[]) => {
    const texte = accumuleRef.current;
    const propositions = propositionsRef.current;
    if (texte.trim() === "" && propositions.length === 0) {
      setMessages(historique);
      return;
    }
    setMessages([
      ...historique,
      {
        role: "assistant",
        content: texte,
        ...(propositions.length > 0 ? { propositions } : {}),
      },
    ]);
  }, []);

  const envoyer = useCallback(async (texte: string) => {
    const contenu = texte.trim();
    if (!contenu || enCoursRef.current) return;

    setAvis(null);
    setUsage(null);
    setOutilEnCours(null);
    const historique: Message[] = [...messagesRef.current, { role: "user", content: contenu }];
    historiqueRef.current = historique;
    accumuleRef.current = "";
    propositionsRef.current = [];
    setMessages([...historique, { role: "assistant", content: "" }]);
    setEnCours(true);

    /*
     * Le message de l'utilisateur est enregistré MAINTENANT, pas à la clôture
     * du tour.
     *
     * L'effet de persistance sort tôt quand `enCours` est vrai, et
     * `setMessages` / `setEnCours(true)` sont groupés : il ne voyait jamais
     * l'état intermédiaire. Une navigation pendant la génération — y compris
     * celle que les cartes de proposition provoquent — emportait donc la
     * question elle-même, pas seulement la réponse en cours.
     */
    ecrireSession(cleConversation, historique);
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
      //
      // La config client (clé saisie dans les réglages) est lue à l'envoi plutôt
      // qu'au montage : si l'utilisateur configure sa clé pendant que le chat
      // est ouvert, le prochain message part avec — sans rechargement.
      const reponse = await fetch("/api/tutor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: historique,
          config: lireConfigTuteur(compteId) ?? undefined,
          // Met l'énoncé de l'exercice ouvert dans le contexte, plutôt que
          // d'obliger à le recoller à la main.
          exerciceId: exerciceCible,
        }),
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
          } else if (type === "proposition-en-cours") {
            /*
             * Un appel d'outil n'émet aucun texte.
             *
             * Pendant la rédaction d'un exercice — la partie la plus longue du
             * tour — le flux ne produisait plus rien de visible, et l'écran
             * restait sur « le tuteur réfléchit… » pendant des dizaines de
             * secondes. Indiscernable d'un plantage, et signalé comme tel.
             *
             * Le défaut a été introduit en deux temps : la sortie structurée a
             * déplacé le contenu hors du flux de texte, puis la consigne de ne
             * plus recopier la proposition en prose a supprimé le seul repère
             * qui restait par accident.
             */
            setOutilEnCours(String(donnees.outil ?? ""));
          } else if (type === "proposition") {
            setOutilEnCours(null);
            propositionsRef.current = [
              ...propositionsRef.current,
              donnees as unknown as PropositionRecue,
            ];
          } else if (type === "proposition-rejetee") {
            setOutilEnCours(null);
            // Une proposition rejetée doit se voir. La taire remplacerait le
            // demi-exercice d'avant le lot 3.2 par un exercice disparu — deux
            // pannes silencieuses, pas une correction.
            setAvis({ ton: "alerte", texte: String(donnees.message ?? "") });
          } else if (type === "fin") {
            const u = donnees.usage as Record<string, number | null> | undefined;
            const compte = (donnees.outils as { appels?: number } | undefined)?.appels;
            if (u) {
              /*
               * « dont 0 lus en cache » était un chiffre que personne n'avait
               * mesuré : le moteur lisait un champ absent et le rabattait sur
               * zéro. Un fournisseur muet sur le cache doit produire « non
               * renseigné », pas un zéro — sans quoi l'indicateur affirme un
               * échec du cache là où il n'a aucune information (P2, P3).
               */
              const cache =
                u.cacheLu === null || u.cacheLu === undefined
                  ? "cache non renseigné par le fournisseur"
                  : `dont ${u.cacheLu} lus en cache`;
              setUsage(
                `${u.entree} jetons en entrée (${cache}) · ${u.sortie} en sortie` +
                  // Discret, mais toujours là : « 0 appel » distingue un tuteur
                  // qui n'a rien proposé d'un outil qui n'a pas fonctionné.
                  (compte === undefined ? "" : ` · ${compte} appel(s) d'outil`),
              );
            }

            /*
             * État de la sortie structurée, dit explicitement.
             *
             * Sans cette ligne, l'absence de carte a trois causes possibles et
             * aucune n'est distinguable : le tuteur n'avait rien à proposer, le
             * fournisseur a refusé les outils et le moteur s'est replié en
             * silence, ou l'appel est arrivé invalide. Trois diagnostics, un
             * seul symptôme — c'est la panne muette que ce lot combat, et elle
             * s'était réinstallée dans le lot lui-même.
             */
            const o = donnees.outils as { actifs?: boolean; appels?: number } | undefined;
            if (o && o.actifs === false) {
              setAvis({
                ton: "alerte",
                texte:
                  "Ce fournisseur n'a pas accepté les appels d'outil : les propositions repassent par le texte, sans contrôle de complétude.",
              });
            }
          }
        }
      }

      // Flush final : s'assurer que le dernier contenu est bien dans le state
      annulerFlush();
      publierReponse(historique);
    } catch (e) {
      annulerFlush();

      // Une interruption voulue n'est pas une panne : ce qui est arrivé avant
      // le clic a été lu, et le jeter serait perdre le seul travail du tour.
      // Les cartes de proposition, elles, restent écartées — `exerciceComplet`
      // rejette un bloc inachevé (cf. `MessageBulle`).
      const annule = e instanceof DOMException && e.name === "AbortError";

      if (annule) {
        publierReponse(historique);
        setAvis({ ton: "info", texte: "Réponse interrompue. Le texte déjà reçu est conservé." });
      } else {
        /*
         * Une coupure réseau ne justifie pas de jeter ce qui était déjà arrivé.
         *
         * `setMessages(historique)` effaçait tout l'accumulé : sur une réponse
         * longue coupée aux trois quarts, l'écran se vidait d'un coup et le
         * tour semblait n'avoir rien produit. On publie ce qui a été lu, en le
         * marquant comme interrompu — un texte partiel annoncé comme tel vaut
         * mieux qu'un écran vide (P3).
         */
        publierReponse(historique);
        setAvis({
          ton: "danger",
          texte: `${e instanceof Error ? e.message : "Erreur réseau pendant la réponse."} Le texte reçu avant la coupure est conservé, mais la réponse est incomplète.`,
        });
      }
    } finally {
      abandonRef.current = null;
      setEnCours(false);
      // Y compris à l'interruption et à l'erreur : un tour clos ne rédige plus
      // rien, et laisser le statut allumé afficherait un travail qui n'a pas
      // lieu — exactement la fausse information que ce chat s'interdit.
      setOutilEnCours(null);
    }
  }, [
    annulerFlush,
    planifierFlush,
    publierReponse,
    // `compteId` était lu dans le corps (clé du fournisseur, clé de session) sans
    // figurer ici : changer de compte sans démonter le chat aurait envoyé la clé
    // du précédent. `cleConversation` et `exerciceCible` entrent pour la même
    // raison — ils sont lus à l'envoi.
    compteId,
    cleConversation,
    exerciceCible,
  ]);

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

  /*
   * L'amorce ne pré-remplit que sur une conversation vide.
   *
   * Elle vient de `/demarrer` ou d'une fiche compétence, en `searchParams` :
   * elle reste dans l'adresse tant qu'on n'en change pas. La réappliquer sur
   * une conversation retrouvée reproposerait le message d'ouverture à chaque
   * retour sur la page, alors que la discussion est déjà engagée.
   */
  const saisieInitiale =
    messages.length > 0
      ? ""
      : (amorce ?? (competenceCiblee ? `Explique-moi ${competenceCiblee}.` : ""));

  return (
    <div className="space-y-6 [&>*]:min-w-0">
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

            {/*
              Ce que le tuteur fabrique quand il ne dit rien.

              Un appel d'outil n'émet aucun texte : la rédaction d'un exercice,
              qui est la partie la plus longue d'un tour, ne produisait plus
              rien à l'écran. L'interface restait sur « le tuteur réfléchit… »
              pendant des dizaines de secondes, ce qui se lit comme un
              plantage — et a été signalé comme tel.

              Hors du composant mémoïsé : ce statut change indépendamment du
              contenu des bulles, et le faire descendre dans `MessageBulle`
              relancerait son rendu à chaque transition.
            */}
            {outilEnCours && (
              <div className="flex items-center gap-2 px-1 text-xs text-texte-attenue">
                <span className="size-1.5 animate-pulse rounded-full bg-primaire" />
                {LIBELLE_OUTIL[outilEnCours] ?? "Le tuteur prépare une proposition…"}
              </div>
            )}
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
            onReinitialiser={messages.length > 0 ? reinitialiserConversation : undefined}
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
          <div className="border-b border-bordure px-5 py-3.5">
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
              <li key={i} className="flex items-baseline justify-between gap-2 px-5 py-2.5">
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
          <div className="border-t border-bordure px-5 py-3.5 text-xs">
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

          <div className="rounded-carte border border-bordure bg-surface px-5 py-4 text-xs text-texte-attenue">
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
        <div className="rounded-carte border border-alerte/30 bg-alerte-faible px-5 py-4 text-xs">
          <p className="font-medium text-alerte">Aucune clé API configurée</p>
          <p className="mt-1 text-texte-attenue">
            Le chat intégré est désactivé — il ne simulera pas de réponse. Trois options :
          </p>
          <ol className="mt-2 space-y-1 pl-4 text-texte-attenue">
            <li className="list-decimal">
              Ouvrir les <strong>réglages</strong> (icône engrenage, en bas du rail) et saisir ta
              clé API — Mistral, Anthropic, Groq… La clé est stockée dans ton navigateur et
              n&apos;est jamais envoyée ailleurs qu&apos;à la route du tuteur.
            </li>
            <li className="list-decimal">
              Utiliser <strong>« Copier le contexte »</strong> et coller le prompt dans Claude.
            </li>
            <li className="list-decimal">
              Créer <code className="font-mono">app/.env.local</code> avec{" "}
              <code className="font-mono">ANTHROPIC_API_KEY=…</code> (ou{" "}
              <code className="font-mono">TUTEUR_CLE</code> /{" "}
              <code className="font-mono">TUTEUR_URL_BASE</code> /{" "}
              <code className="font-mono">TUTEUR_MODELE</code>), puis relancer le serveur.
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
