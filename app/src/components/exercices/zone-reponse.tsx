"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { enregistrerReponse } from "@/lib/store/actions";
import { useEstHydrate } from "@/lib/ui/hydratation";
import { cleParCompte, ecrireSession, effacerSession, lireSession } from "@/lib/ui/stockage-session";

/**
 * Zone de réponse — enregistrement automatique en base, filet en session.
 *
 * Ce qui était un geste volontaire (le bouton « Enregistrer le brouillon ») est
 * devenu automatique. La règle ne change pas : c'est la valeur en base qui
 * déverrouille le bilan (`reponseSuffisante`) et que le tuteur relit. Seule
 * l'action manuelle qui la servait disparaît — et avec elle le repère visuel
 * qui disait où en était la donnée. L'écran doit donc le dire lui-même, et
 * dire vrai (P3).
 *
 * ## Les quatre états, et pourquoi ils sont distincts
 *
 * | État          | Ce qui est vrai                                    |
 * | ------------- | -------------------------------------------------- |
 * | `enregistre`  | La base porte exactement le texte à l'écran.        |
 * | `modifie`     | Le texte a changé, le décompte tourne, rien n'est parti. |
 * | `envoi`       | Une requête est réellement en vol.                  |
 * | `echec`       | La dernière écriture a échoué ; une relance est armée. |
 *
 * La version précédente annonçait « Enregistrement… » dès la frappe, avant
 * qu'aucune requête n'existe : elle affirmait un fait faux pendant toute la
 * pause. `modifie` et `envoi` sont deux situations différentes pour qui ferme
 * son ordinateur, et l'écran ne doit pas les confondre.
 *
 * ## Ce qui protège la frappe non encore écrite
 *
 * - **Le filet `sessionStorage`** (par compte et par tentative) est tenu à jour
 *   pendant la frappe. Il couvre la navigation interne et le retour arrière.
 * - **Le départ du champ, le passage de l'onglet en arrière-plan et le
 *   démontage** forcent l'écriture sans attendre le décompte.
 * - **`beforeunload`** retient une fermeture ou un rechargement tant qu'une
 *   frappe n'est pas en base : c'est le seul filet contre la perte réelle, le
 *   `sessionStorage` ne survivant pas à la fermeture de l'onglet.
 * - **Une écriture échouée est relancée** (réseau coupé, session expirée) au
 *   lieu de rester en plan jusqu'à la frappe suivante.
 *
 * Ce n'est pas une dorsale de plus : la seule source reste Supabase (ADR-015),
 * et le filet en `sessionStorage` n'entre jamais dans le calcul d'une preuve.
 */

/** Assez court pour ne rien perdre d'une navigation, assez long pour ne pas sérialiser à chaque touche. */
const DELAI_FILET_SESSION_MS = 400;
/** Pause avant l'écriture en base : regroupe une rafale de frappes en une seule requête. */
const DELAI_AUTO_SAUVEGARDE_MS = 800;
/** Une écriture échouée se relance seule : le réseau revient plus souvent qu'il ne part. */
const DELAI_RELANCE_MS = 5000;

type EtatSauvegarde = "enregistre" | "modifie" | "envoi" | "echec";

export function ZoneReponse(proprietes: {
  attemptId: string;
  valeur: string;
  compteId: string;
  urlCorrection?: string;
  onDemanderCorrection?: () => void;
}) {
  // `sessionStorage` n'existe pas côté serveur : on attend l'hydratation pour
  // partir du bon texte dès le premier rendu réel, plutôt que d'afficher la
  // valeur en base puis d'y réinjecter le brouillon dans un effet.
  const hydrate = useEstHydrate();
  if (!hydrate) {
    // `aria-hidden`, pas `aria-busy` : rendait cette attente invisible aux
    // lecteurs d'écran plutôt que de l'annoncer. Un texte alternatif hors
    // écran porte l'information même si la fenêtre est trop brève pour être
    // vue.
    return (
      <div
        className="h-[15.5rem] rounded-md border border-bordure-controle bg-surface lg:h-[min(32rem,calc(100dvh-16rem))]"
        aria-busy="true"
      >
        <span className="sr-only">Chargement de la zone de réponse…</span>
      </div>
    );
  }
  return <ZoneHydrate {...proprietes} />;
}

function ZoneHydrate({
  attemptId,
  valeur,
  compteId,
  urlCorrection,
  onDemanderCorrection,
}: {
  attemptId: string;
  /** Dernière réponse enregistrée en base (valeur figée au rendu serveur). */
  valeur: string;
  compteId: string;
  urlCorrection?: string;
  onDemanderCorrection?: () => void;
}) {
  const router = useRouter();
  const cle = cleParCompte(`brouillon-reponse:${attemptId}`, compteId);

  const [texte, setTexte] = useState<string>(() => lireSession<string>(cle) ?? valeur);
  const [enregistre, setEnregistre] = useState<string>(valeur);
  const [etat, setEtat] = useState<EtatSauvegarde>(() =>
    (lireSession<string>(cle) ?? valeur) === valeur ? "enregistre" : "modifie",
  );
  const [erreur, setErreur] = useState<string | null>(null);
  /** Incrémenté à chaque échec : c'est lui qui réarme la relance, `etat` restant « echec ». */
  const [essai, setEssai] = useState(0);

  /*
   * Les gestes de départ (blur, onglet caché, démontage, fermeture) partent de
   * gestionnaires qui ne rejouent pas au rythme du rendu : ils lisent des refs,
   * jamais une valeur capturée dans une clôture qui pourrait être périmée.
   */
  const texteRef = useRef(texte);
  const enregistreRef = useRef(valeur);
  const envoiEnVol = useRef(false);

  // Synchronisées après le rendu, jamais pendant : un rendu qui écrit dans une
  // ref est un rendu impur. L'effet passe avant tout événement utilisateur
  // suivant, donc les gestionnaires lisent toujours la frappe du dernier rendu.
  useEffect(() => {
    texteRef.current = texte;
    enregistreRef.current = enregistre;
  });

  const ecrireFilet = useCallback(
    (corps: string) => {
      // Aligné sur la base, le filet n'a plus d'objet : le garder ferait
      // réapparaître un vieux texte si la tentative est reprise ailleurs.
      if (corps === enregistreRef.current) effacerSession(cle);
      else ecrireSession(cle, corps);
    },
    [cle],
  );

  const enregistrerMaintenant = useCallback(async () => {
    // Une seule requête en vol : deux écritures concurrentes pourraient
    // aboutir dans le désordre et laisser la base sur la plus ancienne.
    if (envoiEnVol.current) return;
    const corps = texteRef.current;
    if (corps === enregistreRef.current) return;

    envoiEnVol.current = true;
    setEtat("envoi");
    try {
      await enregistrerReponse(attemptId, corps);
      enregistreRef.current = corps;
      setEnregistre(corps);
      setErreur(null);
      // La frappe a pu continuer pendant l'envoi : l'écran ne dit « enregistré »
      // que si la base porte bien ce qui est affiché à cet instant.
      const aJour = texteRef.current === corps;
      setEtat(aJour ? "enregistre" : "modifie");
      if (aJour) effacerSession(cle);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
      setEtat("echec");
      setEssai((n) => n + 1);
      // Le texte n'est pas en base : le filet local reste la seule copie.
      ecrireFilet(corps);
    } finally {
      envoiEnVol.current = false;
    }
  }, [attemptId, cle, ecrireFilet]);

  /** Écriture immédiate, pour les gestionnaires qui ne peuvent pas attendre. */
  const forcer = useCallback(() => {
    if (texteRef.current === enregistreRef.current) return;
    ecrireFilet(texteRef.current);
    void enregistrerMaintenant();
  }, [ecrireFilet, enregistrerMaintenant]);

  // Filet local, cadencé : survit à la navigation interne tant que l'écriture
  // en base n'a pas eu lieu.
  useEffect(() => {
    const minuterie = setTimeout(() => ecrireFilet(texte), DELAI_FILET_SESSION_MS);
    return () => clearTimeout(minuterie);
  }, [texte, enregistre, ecrireFilet]);

  // Auto-sauvegarde : après une pause de frappe, une seule écriture.
  useEffect(() => {
    if (texte === enregistre) return;
    const minuterie = setTimeout(() => void enregistrerMaintenant(), DELAI_AUTO_SAUVEGARDE_MS);
    return () => clearTimeout(minuterie);
  }, [texte, enregistre, enregistrerMaintenant]);

  // Relance après échec : sans elle, une coupure réseau laisserait la réponse
  // hors de la base jusqu'à la frappe suivante — qui peut ne jamais venir.
  useEffect(() => {
    if (etat !== "echec") return;
    const minuterie = setTimeout(() => void enregistrerMaintenant(), DELAI_RELANCE_MS);
    return () => clearTimeout(minuterie);
  }, [etat, essai, enregistrerMaintenant]);

  /*
   * Départs qui n'attendent pas le décompte.
   *
   * `visibilitychange` couvre le changement d'onglet, la minimisation et, sur
   * mobile, le passage en arrière-plan — les seuls moments où le navigateur
   * accepte encore de partir avec une requête. `pagehide` rattrape la
   * navigation hors application. Le démontage (retour au bilan) passe par le
   * nettoyage de l'effet.
   */
  useEffect(() => {
    function quandCache() {
      if (document.visibilityState === "hidden") forcer();
    }
    document.addEventListener("visibilitychange", quandCache);
    window.addEventListener("pagehide", forcer);
    return () => {
      document.removeEventListener("visibilitychange", quandCache);
      window.removeEventListener("pagehide", forcer);
      forcer();
    };
  }, [forcer]);

  /*
   * Fermeture ou rechargement : le `sessionStorage` ne survit pas à la
   * fermeture de l'onglet, et une requête lancée à cet instant n'a aucune
   * garantie d'aboutir. La confirmation du navigateur est le seul filet
   * honnête — elle n'apparaît que si la base est réellement en retard.
   */
  useEffect(() => {
    if (texte === enregistre) return;
    function avantFermeture(evenement: BeforeUnloadEvent) {
      forcer();
      evenement.preventDefault();
    }
    window.addEventListener("beforeunload", avantFermeture);
    return () => window.removeEventListener("beforeunload", avantFermeture);
  }, [texte, enregistre, forcer]);

  /*
   * Raccourci de passage à l'acte suivant.
   *
   * L'écriture est **attendue** avant la navigation : c'est la valeur en base
   * qui déverrouille le bilan (`reponseSuffisante`), pas celle à l'écran.
   * Partir sans attendre ferait tomber sur un écran qui dit « pas de réponse »
   * alors qu'elle vient d'être tapée.
   */
  async function allerCorriger() {
    ecrireFilet(texteRef.current);
    await enregistrerMaintenant();
    if (onDemanderCorrection) onDemanderCorrection();
    else if (urlCorrection) router.push(urlCorrection);
  }

  function gererToucheClavier(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!(e.ctrlKey || e.metaKey) || e.key !== "Enter") return;
    if (!urlCorrection && !onDemanderCorrection) return;
    e.preventDefault();
    void allerCorriger();
  }

  return (
    <div>
      <textarea
        value={texte}
        onChange={(e) => {
          const suivant = e.target.value;
          setTexte(suivant);
          // Pas « Enregistrement… » : rien n'est parti tant que le décompte
          // n'a pas expiré. Un envoi déjà en vol garde son propre état.
          if (!envoiEnVol.current) setEtat(suivant === enregistre ? "enregistre" : "modifie");
        }}
        onKeyDown={gererToucheClavier}
        onBlur={forcer}
        rows={10}
        placeholder="Hypothèses, méthode, calculs, résultat, interprétation, limites…"
        className="h-[15.5rem] w-full resize-y rounded-md border border-bordure-controle bg-surface px-3 py-2 font-mono text-xs leading-relaxed placeholder:text-texte-discret lg:h-[min(32rem,calc(100dvh-16rem))]"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[0.625rem] text-texte-discret">
        <div className="flex flex-wrap items-center gap-2">
          <span aria-live="polite">
            {etat === "envoi"
              ? "Enregistrement…"
              : etat === "modifie"
                ? "Modifications non encore enregistrées"
                : etat === "echec"
                  ? "Enregistrement en échec — nouvelle tentative dans quelques secondes"
                  : "Enregistré"}
          </span>
          <span aria-hidden>·</span>
          <span>
            Le contenu n&apos;est pas corrigé automatiquement — il sert de trace de ton raisonnement.
          </span>
        </div>
        {(urlCorrection || onDemanderCorrection) && (
          <div className="hidden sm:flex items-center gap-1">
            <kbd className="rounded border border-bordure bg-surface-2 px-1 py-0.5 font-mono text-[0.625rem]">Ctrl+Entrée</kbd>
            <span>demander la correction</span>
          </div>
        )}
      </div>

      {erreur && etat === "echec" && (
        <p className="mt-1.5 text-[0.6875rem] text-alerte">{erreur}</p>
      )}
    </div>
  );
}
