"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { moisDuJour, moisValide } from "@/lib/domain/pages-cahier";
import { moisAffiche } from "@/components/seances/calendrier-cahier";
import { Bureau, type EntreesCahier } from "@/components/seances/bureau";
import { CahierArchive } from "@/components/seances/cahier-archive";
import { SeancesAVenir } from "@/components/seances/seances-a-venir";
import { cleJour } from "@/lib/engine/dates";
import type { VueSeances } from "@/lib/domain/vue-seances";

/** API historique conservée pour les tests et appelants de la composition. */
export { vueInitialeDepuisParametres } from "@/lib/domain/vue-seances";
export type { VueSeances } from "@/lib/domain/vue-seances";

/**
 * Le conteneur des lectures du pôle.
 *
 * Toutes les données sont reçues une fois du serveur, puis la navigation —
 * entre les jours comme entre les lectures — est locale et instantanée.
 */
export function CahierInteractif({
  jourInitial,
  moisInitial,
  vueInitiale = "avenir",
  jours,
  entrees,
  aujourdHuiIso,
  jourExplicite = false,
  compteId,
  recherche,
  compositeur,
  seanceDeployee,
}: {
  /** Le jour ouvert : la page du jour, sauf lien explicite (`?jour=`, `?session=`). */
  jourInitial: string;
  moisInitial?: string;
  /** `avenir` par défaut ; `cahier` pour l'archive, `bureau` pour un jour explicite. */
  vueInitiale?: VueSeances;
  jours: string[];
  entrees: EntreesCahier;
  aujourdHuiIso: string;
  /**
   * Vrai seulement quand le jour ouvert vient d'un choix explicite (`?jour=`
   * ou `?session=`) : le navigateur n'a alors rien à redire. Faux — cas du
   * Bureau sans paramètre —, le jour civil LOCAL reprend la main après
   * montage : l'horloge initiale était celle du serveur, en UTC en production,
   * et autour de minuit européen elle ouvrait la veille (friction du 25/08).
   */
  jourExplicite?: boolean;
  compteId: string;
  /** Terme de recherche actif, le cas échéant. Le Cahier s'ouvre dessus. */
  recherche?: string;
  compositeur?: ReactNode;
  seanceDeployee?: { id: string; contenu: ReactNode };
}) {
  const [jour, setJour] = useState<string>(jourInitial);
  const [mois, setMois] = useState<string>(() =>
    moisAffiche(moisValide(moisInitial), jourInitial),
  );
  const [vue, setVue] = useState<VueSeances>(vueInitiale);
  const aujourdHui = useMemo(() => new Date(aujourdHuiIso), [aujourdHuiIso]);

  /*
   * Le jour civil appartient au navigateur, pas au serveur.
   *
   * Le rendu initial garde le jour calculé côté serveur pour que l'HTML et
   * l'hydratation coïncident (aucun décalage visible) ; dès le montage, si
   * personne n'a demandé un autre jour explicitement, l'horloge LOCALE
   * reprend la main. L'écart ne peut exister qu'autour de minuit entre les
   * deux fuseaux — exactement le cas que ce correctif traite — et se referme
   * avant toute interaction.
   */
  useEffect(() => {
    if (jourExplicite) return;
    const local = cleJour(new Date());
    if (local !== jourInitial) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- l'horloge locale n'existe qu'après montage : c'est une synchronisation avec l'extérieur, pas un état dériv
      setJour(local);
      setMois(moisDuJour(local));
    }
    // Un seul alignement au montage : ensuite, l'utilisateur pilote.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Navigation locale instantanée entre les pages. Aucune écriture : ni
   * marque-page (le Bureau rouvre toujours sur la page du jour — un marque-
   * page qui ramenait trois jours en arrière était une friction, pas un
   * confort), ni URL (un `?jour=` posé par `replaceState` deviendrait un lien
   * explicite au rechargement et réintroduirait l'ouverture dans le passé).
   */
  const allerALaPage = useCallback((cible: string) => {
    setJour(cible);
    setMois(moisDuJour(cible));
    // Ouvrir un jour depuis l'archive ramène AU Bureau, sur ce jour-là :
    // on ne clique pas une vignette pour rester dans la grille.
    setVue("bureau");
  }, []);

  const ouvrirCahier = useCallback(() => setVue("cahier"), []);
  const fermerCahier = useCallback(() => setVue("avenir"), []);

  if (vue === "cahier") {
    return (
      <CahierArchive
        mois={mois}
        jours={jours}
        entrees={entrees}
        recherche={recherche}
        onChangerJour={allerALaPage}
        onChangerMois={setMois}
        onFermer={fermerCahier}
      />
    );
  }

  return (
    <>
      {compositeur}
      {vue === "bureau" ? (
        <Bureau
          jour={jour}
          jours={jours}
          mois={mois}
          entrees={entrees}
          aujourdHui={aujourdHui}
          compteId={compteId}
          onChangerJour={allerALaPage}
          onChangerMois={setMois}
          onOuvrirCahier={ouvrirCahier}
          seanceDeployee={seanceDeployee}
        />
      ) : (
        <SeancesAVenir
          entrees={entrees}
          compteId={compteId}
          onOuvrirHistorique={ouvrirCahier}
        />
      )}
    </>
  );
}
