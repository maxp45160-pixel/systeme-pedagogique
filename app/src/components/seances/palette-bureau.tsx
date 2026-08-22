"use client";

/**
 * La palette du Bureau (⌘K) — ADR-103.
 *
 * ## Ce qu'elle remplace
 *
 * Le cahier portait un bloc « Chercher dans tout le cahier » en pied de page,
 * visible en permanence. Un index n'est pas un meuble : on l'ouvre quand on
 * cherche, et le reste du temps il occupe un tiers d'écran sur la seule page
 * où l'on veut du calme. La recherche devient donc une commande.
 *
 * ## Ce qu'elle ne fait pas
 *
 * Elle ne fait pas d'écriture silencieuse : les commandes de création ouvrent
 * un formulaire dédié dans l'Atelier. Les seules entrées de navigation sont
 * revenir au jour courant et ouvrir l'archive ; composer une séance est rangé
 * avec les autres créations.
 *
 * Elle ne liste pas non plus les jours : c'est la bande de semaine, les
 * chevrons et le calendrier qui mènent à une date. Voir plus bas.
 *
 * Le filtrage est local et sans état persistant : la palette se rouvre vide.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cx } from "@/components/ui/primitives";
import { IconeRecherche } from "@/components/ui/icones";

export interface CommandePalette {
  id: string;
  libelle: string;
  /** Ce que l'entrée fait, en trois mots — affiché à droite. */
  indice?: string;
  /** Termes supplémentaires pris en compte par le filtre. */
  motsCles?: string;
  executer: () => void;
}

/**
 * Le raccourci d'ouverture, partagé par le déclencheur et la palette.
 *
 * ⌘K sur Mac, Ctrl+K ailleurs. `/` n'est pas retenu : c'est un caractère
 * français courant, et l'intercepter casserait la saisie dans la barre de
 * capture qui vit sur le même écran.
 */
function estRaccourciPalette(event: KeyboardEvent): boolean {
  return (event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey);
}

export function PaletteBureau({
  aujourdHui,
  onChangerJour,
  onOuvrirCahier,
  ouverte,
  onFermer,
}: {
  aujourdHui: string;
  onChangerJour: (jour: string) => void;
  onOuvrirCahier: () => void;
  ouverte: boolean;
  onFermer: () => void;
}) {
  const router = useRouter();
  const [saisie, setSaisie] = useState("");
  const [curseur, setCurseur] = useState(0);
  const champ = useRef<HTMLInputElement>(null);
  const liste = useRef<HTMLUListElement>(null);

  const terme = saisie.trim().toLocaleLowerCase("fr");

  const commandes = useMemo<CommandePalette[]>(() => {
    const creations: CommandePalette[] = [
      {
        id: "composer",
        libelle: "Composer une séance",
        indice: "Créer",
        motsCles: "créer nouvelle exercice travail séance",
        executer: () => router.push("/seances?composer=1"),
      },
      {
        id: "feynman",
        libelle: "Faire une explication Feynman",
        indice: "Créer",
        motsCles: "expliquer reformuler compréhension compétence",
        executer: () => router.push("/atelier?creation=feynman"),
      },
      {
        id: "projet",
        libelle: "Lancer un projet",
        indice: "Créer",
        motsCles: "nouveau produire construire activité",
        executer: () => router.push("/atelier?creation=projet"),
      },
      {
        id: "cours",
        libelle: "Créer une fiche de cours",
        indice: "Créer",
        motsCles: "cours fiche synthèse note ressource",
        executer: () => router.push("/atelier?creation=cours"),
      },
      {
        id: "formule",
        libelle: "Enregistrer une formule",
        indice: "Créer",
        motsCles: "math formule équation note ressource",
        executer: () => router.push("/atelier?creation=formule"),
      },
      {
        id: "ressource",
        libelle: "Ajouter une ressource ou un PDF",
        indice: "Créer",
        motsCles: "pdf document article support cours note",
        executer: () => router.push("/atelier?creation=ressource"),
      },
    ];

    const actions: CommandePalette[] = [
      {
        id: "aujourd-hui",
        libelle: "Revenir à aujourd’hui",
        indice: "Bureau",
        motsCles: "jour date maintenant",
        executer: () => onChangerJour(aujourdHui),
      },
      {
        id: "cahier",
        libelle: "Ouvrir le Cahier",
        indice: "Archive",
        motsCles: "archive historique passe relire",
        executer: onOuvrirCahier,
      },
    ];

    /*
     * ⚠️ **Pas de liste de jours ici** (22/08/2026).
     *
     * La palette en déroulait un par ligne, du plus récent au plus ancien :
     * dix entrées « vendredi 21 août — Page », toutes identiques, qui
     * poussaient les trois actions hors de vue dès l'ouverture. Une palette de
     * commandes qui affiche surtout des dates n'est plus une palette : c'est
     * un calendrier mal dessiné, et il en existe déjà un.
     *
     * Aller à un jour se fait par les commandes qui le disent : la bande de
     * semaine, les chevrons, le calendrier. La recherche plein texte, elle,
     * traverse les dates sans avoir à les nommer.
     */
    /*
     * La recherche plein texte n'est pas une entrée fixe : elle n'apparaît que
     * lorsqu'on a tapé quelque chose, sinon elle proposerait de chercher rien.
     */
    const recherche: CommandePalette[] = terme
      ? [
          {
            id: "recherche",
            libelle: `Rechercher « ${saisie.trim()} » dans tout le Cahier`,
            indice: "Recherche",
            executer: () =>
              router.push(`/seances?vue=cahier&q=${encodeURIComponent(saisie.trim())}`),
          },
        ]
      : [];

    return [...recherche, ...creations, ...actions];
  }, [aujourdHui, onChangerJour, onOuvrirCahier, router, saisie, terme]);

  const filtrees = useMemo(() => {
    if (!terme) return commandes;
    return commandes
      .filter((commande) => {
        // L'entrée « recherche » ne se filtre pas elle-même : elle EST la
        // réponse au terme saisi.
        if (commande.id === "recherche") return true;
        const texte = `${commande.libelle} ${commande.motsCles ?? ""}`.toLocaleLowerCase("fr");
        return texte.includes(terme);
      });
  }, [commandes, terme]);

  /*
   * Réinitialisations pendant le rendu (motif React « adjusting state when a
   * prop changes ») : un curseur qui pointerait au-delà de la liste filtrée,
   * ou une saisie héritée d'une ouverture précédente, sont des incohérences à
   * corriger avant de peindre — pas des effets.
   */
  const [termePrecedent, setTermePrecedent] = useState(terme);
  if (terme !== termePrecedent) {
    setTermePrecedent(terme);
    setCurseur(0);
  }

  const [ouvertePrecedente, setOuvertePrecedente] = useState(ouverte);
  if (ouverte !== ouvertePrecedente) {
    setOuvertePrecedente(ouverte);
    if (ouverte) setSaisie("");
  }

  useEffect(() => {
    if (!ouverte) return;
    champ.current?.focus();
  }, [ouverte]);

  const lancer = useCallback(
    (commande: CommandePalette | undefined) => {
      if (!commande) return;
      onFermer();
      commande.executer();
    },
    [onFermer],
  );

  useEffect(() => {
    if (!ouverte) return;

    function auClavier(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onFermer();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setCurseur((actuel) => (filtrees.length === 0 ? 0 : (actuel + 1) % filtrees.length));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setCurseur((actuel) =>
          filtrees.length === 0 ? 0 : (actuel - 1 + filtrees.length) % filtrees.length,
        );
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        lancer(filtrees[curseur]);
      }
    }

    document.addEventListener("keydown", auClavier);
    return () => document.removeEventListener("keydown", auClavier);
  }, [curseur, filtrees, lancer, onFermer, ouverte]);

  // L'entrée survolée au clavier doit rester visible sans faire défiler la page.
  useEffect(() => {
    liste.current?.children[curseur]?.scrollIntoView({ block: "nearest" });
  }, [curseur]);

  if (!ouverte) return null;

  return (
    <div
      className="fixed inset-0 z-[var(--superposition-modale)] flex items-start justify-center px-4 pt-[12vh]"
      // Cliquer à côté referme : le geste attendu d'une surcouche légère.
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onFermer();
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 cursor-pointer bg-neutral-950/25 backdrop-blur-[2px]"
        onPointerDown={onFermer}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Commandes du Bureau"
        className="relative w-full max-w-lg overflow-hidden rounded-carte border border-bordure bg-surface shadow-[var(--ombre-surcouche)]"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-bordure px-3.5 py-2.5">
          <IconeRecherche className="size-4 shrink-0 text-texte-discret" />
          <input
            ref={champ}
            value={saisie}
            onChange={(event) => setSaisie(event.target.value)}
            placeholder="Ajouter, créer ou rechercher une commande…"
            aria-label="Ajouter, créer ou rechercher une commande"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-texte-discret"
          />
          <kbd className="shrink-0 rounded border border-bordure px-1.5 py-0.5 text-[0.625rem] text-texte-discret">
            Échap
          </kbd>
        </div>

        {filtrees.length === 0 ? (
          <p className="px-3.5 py-6 text-center text-xs text-texte-discret">
            Rien ne correspond à cette saisie.
          </p>
        ) : (
          <ul ref={liste} className="max-h-[52vh] overflow-y-auto py-1.5">
            {filtrees.map((commande, index) => (
              <li key={commande.id}>
                <button
                  type="button"
                  onPointerEnter={() => setCurseur(index)}
                  onClick={() => lancer(commande)}
                  aria-current={index === curseur ? "true" : undefined}
                  className={cx(
                    "flex w-full cursor-pointer items-center justify-between gap-3 px-3.5 py-2 text-left text-sm transition-colors",
                    index === curseur ? "bg-primaire-faible text-primaire" : "text-texte-attenue",
                  )}
                >
                  <span className="min-w-0 truncate">{commande.libelle}</span>
                  {commande.indice && (
                    <span className="shrink-0 text-[0.6875rem] text-texte-discret">
                      {commande.indice}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Branche le raccourci clavier global.
 *
 * Séparé de la palette elle-même : le raccourci doit vivre même quand la
 * palette est fermée, et la palette ne se monte pas tant qu'on ne l'ouvre pas.
 */
export function useRaccourciPalette(onOuvrir: () => void): void {
  useEffect(() => {
    function auClavier(event: KeyboardEvent) {
      if (!estRaccourciPalette(event)) return;
      event.preventDefault();
      onOuvrir();
    }
    document.addEventListener("keydown", auClavier);
    return () => document.removeEventListener("keydown", auClavier);
  }, [onOuvrir]);
}

