"use client";

import { useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/** Durée d'un tour de page. Assez lent pour être lu, assez court pour ne pas attendre. */
const DUREE = 460;
const COURBE = "cubic-bezier(.36,.06,.24,1)";

/**
 * L'angle où la feuille s'efface.
 *
 * Un cahier ouvert à plat a deux pages : la feuille qu'on tourne va se poser
 * sur celle de gauche, et le demi-tour complet se lit. Ici il n'y a qu'une
 * page — passé la verticale, la feuille n'a plus rien où atterrir et vient
 * balayer la reliure puis la barre latérale : un grand rectangle sombre qui
 * traverse l'écran, ce que personne ne lit comme « tourner une page ».
 *
 * Elle s'arrête donc à l'oblique et s'efface là, sur le geste de départ, qui
 * est celui qui porte le sens.
 */
const ANGLE = 96;

/**
 * Le tour de page.
 *
 * ## Pourquoi un calque, et pas une transition de route
 *
 * Tourner une page n'est pas un changement d'écran : c'est un geste sur un
 * objet. Le feuillet qu'on quitte doit pivoter depuis la reliure, porter son
 * lustre et jeter son ombre sur celui qui se découvre — rien de tout cela ne
 * s'exprime en fondu.
 *
 * Le calque est une **photo** du feuillet courant, prise avant la navigation :
 * il couvre l'écran pendant que Next remplace le contenu dessous, et disparaît
 * quand la rotation est finie. Le rendu reste donc entièrement serveur ; la
 * seule chose que ce composant ajoute est le mouvement.
 *
 * ## Deux sens, un seul principe : on regarde partir ce qu'on quitte
 *
 *  - **en avant** — la feuille se soulève par la droite et pivote vers la
 *    gauche, du côté de la reliure ;
 *  - **en arrière** — le même geste, miroir : elle se soulève par la gauche et
 *    part vers la droite.
 *
 * La feuille qui pivote porte donc toujours la photo du feuillet **quitté**.
 * Faire arriver celui qu'on rejoint serait plus juste physiquement, mais son
 * contenu n'existe pas encore au moment où le geste commence : la première
 * version peignait une feuille vierge qui se posait, et on regardait un
 * fantôme traverser l'écran. Mieux vaut un geste tenu qu'une page fausse.
 *
 * ## Ce qui reste au navigateur
 *
 * Clic milieu, ⌘/Ctrl-clic, Maj-clic : jamais interceptés — ouvrir un feuillet
 * dans un onglet reste un droit du lien. Et sous `prefers-reduced-motion`,
 * aucun calque n'est créé : le lien navigue, point.
 */
export function TournePage({ children }: { children: ReactNode }) {
  const router = useRouter();
  const racine = useRef<HTMLDivElement>(null);
  const hote = useRef<HTMLDivElement>(null);
  const enCours = useRef(false);

  function auClic(evenement: React.MouseEvent<HTMLDivElement>) {
    // Les gestes « ouvrir ailleurs » appartiennent au navigateur.
    if (evenement.button !== 0 || evenement.metaKey || evenement.ctrlKey || evenement.shiftKey || evenement.altKey) {
      return;
    }

    const cible = evenement.target instanceof Element ? evenement.target.closest("a[data-tourne]") : null;
    if (!(cible instanceof HTMLAnchorElement)) return;

    const sens = cible.dataset.tourne === "arriere" ? -1 : 1;
    const href = cible.getAttribute("href");
    if (!href) return;

    const feuillet = racine.current?.querySelector<HTMLElement>("[data-feuillet]");
    const scene = hote.current;
    if (!feuillet || !scene) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Sans l'API d'animation, on ne dégrade pas le lien : il navigue.
    if (typeof feuillet.animate !== "function") return;
    if (enCours.current) {
      // Un tour est déjà lancé : on laisse le lien faire, sans empiler les calques.
      return;
    }

    /*
     * ⚠️ `Link` a déjà fait le travail.
     *
     * Le composant de Next pose son propre `onClick` sur l'ancre : il appelle
     * `preventDefault()` et navigue, bien avant que le clic ne remonte
     * jusqu'ici. Naviguer une seconde fois empilerait deux entrées d'historique
     * pour un seul geste ; on se contente donc d'animer.
     *
     * Le repli couvre le cas d'une ancre ordinaire — sans `Link`, personne n'a
     * empêché le navigateur de recharger la page, et une animation sur une page
     * qui s'en va ne servirait à rien.
     */
    enCours.current = true;
    if (!evenement.defaultPrevented) {
      evenement.preventDefault();
      router.push(href);
    }
    jouerLeTour({
      scene,
      feuillet,
      sens,
      // Le feuillet quitté, pour savoir quand celui d'après est enfin là.
      quitte: feuillet.dataset.feuillet ?? "",
      contenu: racine.current,
      fini: () => {
        enCours.current = false;
      },
    });
  }

  return (
    <div ref={racine} className="tourne-page" onClick={auClic}>
      {children}
      {/*
        L'hôte du calque : rendu vide et jamais mis à jour par React, qui n'a
        donc rien à réconcilier dedans. Y insérer la feuille directement parmi
        les enfants de la scène exposerait React à retirer un nœud qu'il n'a
        pas créé — le `removeChild` qui casse une page entière.
      */}
      <div ref={hote} className="hote-du-tour" aria-hidden />
    </div>
  );
}

/** Au-delà, on montre la page plutôt que d'attendre : un cahier ne bloque pas. */
const ATTENTE_MAX = 2500;

function jouerLeTour({
  scene,
  feuillet,
  sens,
  quitte,
  contenu,
  fini,
}: {
  scene: HTMLElement;
  feuillet: HTMLElement;
  sens: 1 | -1 | number;
  /** L'identité du feuillet qu'on quitte (`jour-rang`). */
  quitte: string;
  /** Le conteneur où surveiller l'arrivée du feuillet suivant. */
  contenu: HTMLElement | null;
  fini: () => void;
}) {
  const boite = feuillet.getBoundingClientRect();
  const repere = scene.getBoundingClientRect();

  const versLaGauche = sens > 0;

  const calque = document.createElement("div");
  calque.className = versLaGauche ? "feuillet-tournant" : "feuillet-tournant vers-la-droite";
  calque.setAttribute("aria-hidden", "true");
  calque.style.top = `${boite.top - repere.top}px`;
  calque.style.left = `${boite.left - repere.left}px`;
  calque.style.width = `${boite.width}px`;
  calque.style.height = `${boite.height}px`;

  const recto = document.createElement("div");
  recto.className = "face-feuillet";
  const verso = document.createElement("div");
  verso.className = "face-feuillet verso";

  // Dans les deux sens, la feuille qui bouge est celle qu'on quitte.
  const photo = document.createElement("div");
  photo.className = "photo-feuillet";
  photo.innerHTML = feuillet.innerHTML;
  recto.appendChild(photo);

  const classeLustre = versLaGauche ? "lustre-feuillet" : "lustre-feuillet vers-la-droite";
  const lustre = document.createElement("div");
  lustre.className = classeLustre;
  recto.appendChild(lustre);
  const lustreVerso = document.createElement("div");
  lustreVerso.className = classeLustre;
  verso.appendChild(lustreVerso);

  calque.append(recto, verso);

  const ombre = document.createElement("div");
  ombre.className = versLaGauche ? "ombre-du-pli" : "ombre-du-pli vers-la-droite";
  ombre.setAttribute("aria-hidden", "true");
  ombre.style.top = `${boite.top - repere.top}px`;
  ombre.style.left = `${boite.left - repere.left}px`;
  ombre.style.width = `${boite.width}px`;
  ombre.style.height = `${boite.height}px`;

  /*
   * Le voile — ce qui règle le « retour en arrière » d'une seconde.
   *
   * La page est rendue par le serveur : entre le clic et l'arrivée du feuillet
   * suivant, il s'écoule le temps d'une requête. La feuille, elle, avait fini
   * de tourner en 460 ms et découvrait… le feuillet qu'on venait de quitter,
   * encore là. On voyait donc la page tourner, puis revenir.
   *
   * Le voile est la feuille vierge qui se trouve dessous : réglée, sans
   * contenu, posée dès que la première s'écarte. Elle s'efface quand
   * `data-feuillet` change — c'est-à-dire quand la page rejointe est
   * réellement à l'écran. Rien n'est deviné, rien n'est simulé : on attend ce
   * qui arrive, en le couvrant.
   */
  const voile = document.createElement("div");
  voile.className = "voile-feuillet";
  voile.setAttribute("aria-hidden", "true");
  voile.style.top = `${boite.top - repere.top}px`;
  voile.style.left = `${boite.left - repere.left}px`;
  voile.style.width = `${boite.width}px`;
  voile.style.height = `${boite.height}px`;

  scene.append(voile, ombre, calque);

  /*
   * Le même geste dans les deux sens, miroir l'un de l'autre : la feuille se
   * soulève et part, vers la reliure quand on avance, vers la tranche quand on
   * revient. Elle s'efface avant la verticale (voir `ANGLE`).
   */
  const signe = versLaGauche ? -1 : 1;
  const rotation = calque.animate(
    [
      { transform: "rotateY(0deg)", opacity: 1 },
      { transform: `rotateY(${signe * ANGLE * 0.55}deg)`, opacity: 1, offset: 0.55 },
      { transform: `rotateY(${signe * ANGLE}deg)`, opacity: 0 },
    ],
    { duration: DUREE, easing: COURBE, fill: "forwards" },
  );

  /*
   * Le lustre et l'ombre disent le papier — à condition de rester des reflets.
   * À 0,55 d'opacité sur un dégradé déjà noir, ils devenaient l'objet principal
   * du mouvement : une plaque sombre qui traverse, plutôt qu'une feuille qui se
   * soulève.
   */
  for (const reflet of [lustre, lustreVerso]) {
    reflet.animate([{ opacity: 0 }, { opacity: 0.32, offset: 0.5 }, { opacity: 0 }], {
      duration: DUREE,
      easing: "ease-in-out",
    });
  }
  ombre.animate([{ opacity: 0 }, { opacity: 0.28, offset: 0.4 }, { opacity: 0 }], {
    duration: DUREE,
    easing: "ease-out",
  });

  function nettoyer() {
    calque.remove();
    ombre.remove();
    voile.remove();
    fini();
  }

  /** Le feuillet rejoint est-il à l'écran ? */
  function arrive(): boolean {
    const actuel = contenu?.querySelector<HTMLElement>("[data-feuillet]");
    return !actuel || actuel.dataset.feuillet !== quitte;
  }

  function leverLeVoile() {
    voile
      .animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 180,
        easing: "ease-out",
        fill: "forwards",
      })
      .finished.then(nettoyer)
      .catch(nettoyer);
  }

  rotation.finished
    .then(() => {
      calque.remove();
      ombre.remove();
      if (arrive()) {
        leverLeVoile();
        return;
      }

      /*
       * On surveille le remplacement du feuillet plutôt que d'attendre un délai
       * arbitraire : une requête lente ne doit pas découvrir une page périmée,
       * et une requête rapide ne doit pas faire patienter pour rien.
       */
      const observateur = new MutationObserver(() => {
        if (!arrive()) return;
        observateur.disconnect();
        clearTimeout(secours);
        leverLeVoile();
      });
      if (contenu) observateur.observe(contenu, { childList: true, subtree: true });

      const secours = setTimeout(() => {
        observateur.disconnect();
        leverLeVoile();
      }, ATTENTE_MAX);
    })
    .catch(nettoyer);
}
