/**
 * Graphe du workflow utilisateur — modèle déclaratif + parcours BFS.
 *
 * ## Pourquoi ce module
 *
 * L'application est une boucle (génération → évaluation → adaptation) mais
 * l'utilisateur, lui, se déplace dans un graphe d'écrans, de modales et
 * d'actions. Ce module déclare **explicitement** ce graphe — chaque nœud est
 * un état atteignable, chaque arête une interaction réelle (bouton, lien,
 * soumission, redirection) — puis le parcourt en largeur (BFS) depuis la page
 * principale pour produire le graphe complet des workflows possibles.
 *
 * ## Pourquoi une déclaration statique et non un crawl
 *
 * Un crawl automatique exigerait un navigateur, des données de compte, et ne
 * verrait que les états atteignables dans l'état courant des données. La
 * déclaration statique couvre **tous** les états possibles — y compris ceux
 * qui dépendent de conditions (référentiel vide, séance en cours, exercice
 * terminé) — et reste lisible, testable et diffable.
 *
 * ## Frontière (AGENTS.md)
 *
 * Ce module est de la couche 1 (Connaît) : il **déclare** ce qui existe, il ne
 * calcule rien. Le BFS est de la couche 3 (Décide) : il **dérive** le graphe
 * complet depuis la déclaration. Rien n'est stocké — tout est recalculable.
 *
 * ## Export formel
 *
 * `workflow-export.ts` transforme le résultat du BFS en objets mathématiques
 * standard : matrice d'adjacence, liste d'adjacence, format DOT (Graphviz),
 * JSON. C'est ce qui permet d'appliquer la théorie des graphes (centralité,
 * chemins critiques, composantes fortement connexes…) à l'optimisation du
 * workflow.
 */

/* ------------------------------------------------------------------ */
/* Types du graphe                                                     */
/* ------------------------------------------------------------------ */

export type TypeNoeudWorkflow =
  | "page" // écran plein (route Next.js)
  | "modal" // fenêtre modale
  | "tiroir" // panneau latéral (tuteur, réglages)
  | "etape" // étape d'un parcours (acte Chercher/Comparer/Mesurer)
  | "action"; // effet de bord (server action, écriture)

export type TypeLienWorkflow =
  | "navigation" // lien ou redirection entre pages
  | "ouverture" // ouvre une modale / un tiroir
  | "transition" // change d'étape dans un parcours
  | "soumission" // formulaire / server action
  | "retour"; // ferme une modale ou revient en arrière

export interface NoeudWorkflow {
  id: string;
  type: TypeNoeudWorkflow;
  libelle: string;
  /** Route Next.js ou URL canonique. Absente pour les états sans URL. */
  url?: string;
  /** Condition d'existence — un état conditionnel n'est pas un défaut. */
  condition?: string;
}

export interface LienWorkflow {
  source: string;
  target: string;
  type: TypeLienWorkflow;
  /** Libellé du bouton / lien / geste qui déclenche la transition. */
  libelle: string;
  /** Condition d'activation — l'arête n'existe que si la condition est vraie. */
  condition?: string;
}

export interface GrapheWorkflow {
  noeuds: NoeudWorkflow[];
  liens: LienWorkflow[];
}

/* ------------------------------------------------------------------ */
/* Déclaration du graphe — la source de vérité                         */
/* ------------------------------------------------------------------ */

/**
 * Le graphe complet du workflow, déclaré à la main.
 *
 * Chaque arête correspond à une interaction réelle lue dans le code :
 * `navigation.ts` (rail), `page.tsx` (tableau de bord), `concepteur-seance.tsx`,
 * `vue-seance-detail.tsx`, `vue-exercice.tsx`, `modale-exercice.tsx`,
 * `modale-competence.tsx`, `tiroir-tuteur.tsx`, `compte.tsx`, etc.
 *
 * Convention d'identifiants :
 *   - `page:<route>`        — écran plein ;
 *   - `modal:<nom>`         — modale ;
 *   - `tiroir:<nom>`        — panneau latéral ;
 *   - `etape:<nom>`         — étape d'un parcours ;
 *   - `action:<nom>`        — effet de bord.
 */
export const GRAPHE_WORKFLOW: GrapheWorkflow = {
  noeuds: [
    /* ── Pages ─────────────────────────────────────────────────────── */
    { id: "page:/", type: "page", libelle: "Tableau de bord", url: "/" },
    { id: "page:/seances", type: "page", libelle: "Cahier (hub)", url: "/seances" },
    {
      id: "page:/seances?session",
      type: "page",
      libelle: "Workspace séance",
      url: "/seances?session={id}",
    },
    { id: "page:/competences", type: "page", libelle: "Compétences (liste)", url: "/competences" },
    {
      id: "page:/competences?vue=graphe",
      type: "page",
      libelle: "Compétences (graphe)",
      url: "/competences?vue=graphe",
    },
    {
      id: "page:/competences/{code}",
      type: "page",
      libelle: "Fiche compétence",
      url: "/competences/{code}",
    },
    {
      id: "page:/competences/domaine/{id}",
      type: "page",
      libelle: "Domaine",
      url: "/competences/domaine/{id}",
    },
    { id: "page:/profil", type: "page", libelle: "Profil", url: "/profil" },
    { id: "page:/demarrer", type: "page", libelle: "Amorçage", url: "/demarrer" },
    { id: "page:/login", type: "page", libelle: "Connexion", url: "/login" },
    {
      id: "page:/exercices/{id}",
      type: "page",
      libelle: "Exercice autonome",
      url: "/exercices/{id}",
    },

    /* ── Modales ────────────────────────────────────────────────────── */
    {
      id: "modal:composer-seance",
      type: "modal",
      libelle: "Composer une séance — besoin",
    },
    {
      id: "modal:composer-seance-composition",
      type: "modal",
      libelle: "Composer une séance — composition",
    },
    { id: "modal:generer-exercice", type: "modal", libelle: "Générer un exercice — formulaire" },
    {
      id: "modal:generer-exercice-previsualisation",
      type: "modal",
      libelle: "Générer un exercice — prévisualisation",
    },
    { id: "modal:ajouter-competences", type: "modal", libelle: "Ajouter des compétences" },
    { id: "modal:creer-theme", type: "modal", libelle: "Créer un thème" },
    { id: "modal:reviser-domaine", type: "modal", libelle: "Réviser avec le tuteur" },
    { id: "modal:evolution-competence", type: "modal", libelle: "Élargir une compétence maîtrisée" },

    /* ── Tiroirs ────────────────────────────────────────────────────── */
    { id: "tiroir:tuteur", type: "tiroir", libelle: "Tiroir du tuteur IA" },
    { id: "tiroir:reglages", type: "tiroir", libelle: "Compte et synchronisation" },

    /* ── Étapes du parcours exercice ────────────────────────────────── */
    {
      id: "etape:exercice-chercher",
      type: "etape",
      libelle: "Acte Chercher — résolution",
    },
    {
      id: "etape:exercice-comparer",
      type: "etape",
      libelle: "Acte Comparer — correction visible",
    },
    {
      id: "etape:exercice-mesurer",
      type: "etape",
      libelle: "Acte Mesurer — bilan",
    },
    {
      id: "etape:exercice-bilan",
      type: "etape",
      libelle: "Bilan enregistré — preuve écrite",
    },

    /* ── Actions (effets de bord) ───────────────────────────────────── */
    { id: "action:demarrer-tentative", type: "action", libelle: "Commencer / Refaire" },
    { id: "action:debloquer-indice", type: "action", libelle: "Débloquer un indice" },
    { id: "action:abandonner-tentative", type: "action", libelle: "Abandonner la tentative" },
    { id: "action:terminer-exercice", type: "action", libelle: "Enregistrer la preuve" },
    { id: "action:creer-seance", type: "action", libelle: "Créer la séance" },
    { id: "action:demarrer-seance", type: "action", libelle: "Démarrer la séance" },
    { id: "action:terminer-seance", type: "action", libelle: "Terminer la séance" },
    { id: "action:annuler-seance", type: "action", libelle: "Annuler la séance" },
    { id: "action:ajouter-note", type: "action", libelle: "Annoter la séance" },
    { id: "action:exporter-journal", type: "action", libelle: "Exporter le journal" },
    { id: "action:se-deconnecter", type: "action", libelle: "Se déconnecter" },
    { id: "action:refuser-recommandation", type: "action", libelle: "Refuser la recommandation" },
    { id: "action:creer-exercice", type: "action", libelle: "Accepter l'exercice généré" },
    { id: "action:creer-branche", type: "action", libelle: "Valider la branche de compétences" },
    { id: "action:modifier-profil", type: "action", libelle: "Enregistrer le profil" },
    { id: "action:enregistrer-cle-tuteur", type: "action", libelle: "Enregistrer la clé du tuteur" },
    { id: "action:retirer-theme", type: "action", libelle: "Retirer un thème" },
    { id: "action:renommer-theme", type: "action", libelle: "Renommer un thème" },
  ],

  liens: [
    /* ════════════════════════════════════════════════════════════════ */
    /* Depuis le Tableau de bord (page:/)                               */
    /* ════════════════════════════════════════════════════════════════ */
    { source: "page:/", target: "page:/seances", type: "navigation", libelle: "Cahier (rail)" },
    {
      source: "page:/",
      target: "page:/competences",
      type: "navigation",
      libelle: "Compétences (rail)",
    },
    {
      source: "page:/",
      target: "page:/demarrer",
      type: "navigation",
      libelle: "Redirection — référentiel vide",
      condition: "référentiel vide",
    },
    {
      source: "page:/",
      target: "page:/seances?session",
      type: "navigation",
      libelle: "Reprendre la séance",
      condition: "séance en cours",
    },
    {
      source: "page:/",
      target: "modal:composer-seance",
      type: "ouverture",
      libelle: "Composer une séance",
    },
    {
      source: "page:/",
      target: "page:/profil",
      type: "navigation",
      libelle: "Compléter le profil",
    },
    {
      source: "page:/",
      target: "page:/exercices/{id}",
      type: "navigation",
      libelle: "Exercice en cours",
      condition: "tentative ouverte hors séance",
    },
    {
      source: "page:/",
      target: "modal:generer-exercice",
      type: "ouverture",
      libelle: "Générer un exercice",
      condition: "aucun exercice disponible pour la recommandation",
    },
    {
      source: "page:/",
      target: "page:/competences/{code}",
      type: "navigation",
      libelle: "Voir la compétence",
    },
    {
      source: "page:/",
      target: "action:refuser-recommandation",
      type: "soumission",
      libelle: "Refuser la recommandation",
    },
    {
      source: "page:/",
      target: "tiroir:tuteur",
      type: "ouverture",
      libelle: "Ouvrir le tuteur (flottant)",
    },
    {
      source: "page:/",
      target: "tiroir:reglages",
      type: "ouverture",
      libelle: "Compte et synchronisation",
    },

    /* ════════════════════════════════════════════════════════════════ */
    /* Depuis le Cahier (page:/seances)                                 */
    /* ════════════════════════════════════════════════════════════════ */
    { source: "page:/seances", target: "page:/", type: "navigation", libelle: "Tableau de bord (rail)" },
    {
      source: "page:/seances",
      target: "page:/competences",
      type: "navigation",
      libelle: "Compétences (rail)",
    },
    {
      source: "page:/seances",
      target: "modal:composer-seance",
      type: "ouverture",
      libelle: "Composer une séance",
    },
    {
      source: "page:/seances",
      target: "page:/seances?session",
      type: "navigation",
      libelle: "Reprendre / Démarrer / Voir le détail",
      condition: "séance planifiée ou en cours",
    },
    {
      source: "page:/seances",
      target: "page:/seances",
      type: "navigation",
      libelle: "Rechercher dans le cahier",
      condition: "terme de recherche saisi",
    },
    {
      source: "page:/seances",
      target: "tiroir:tuteur",
      type: "ouverture",
      libelle: "Ouvrir le tuteur (flottant)",
    },
    {
      source: "page:/seances",
      target: "tiroir:reglages",
      type: "ouverture",
      libelle: "Compte et synchronisation",
    },

    /* ════════════════════════════════════════════════════════════════ */
    /* Depuis le Workspace séance (page:/seances?session)               */
    /* ════════════════════════════════════════════════════════════════ */
    {
      source: "page:/seances?session",
      target: "page:/seances",
      type: "navigation",
      libelle: "Sortir vers le cahier",
    },
    {
      source: "page:/seances?session",
      target: "action:demarrer-seance",
      type: "soumission",
      libelle: "Démarrer",
      condition: "séance planifiée",
    },
    {
      source: "page:/seances?session",
      target: "action:annuler-seance",
      type: "soumission",
      libelle: "Annuler",
      condition: "séance planifiée",
    },
    {
      source: "page:/seances?session",
      target: "etape:exercice-chercher",
      type: "transition",
      libelle: "Exercice actif — acte Chercher",
      condition: "séance en cours",
    },
    {
      source: "page:/seances?session",
      target: "action:terminer-seance",
      type: "soumission",
      libelle: "Terminer la séance",
      condition: "toutes les activités traitées",
    },
    {
      source: "page:/seances?session",
      target: "tiroir:tuteur",
      type: "ouverture",
      libelle: "Tuteur IA",
      condition: "séance en cours",
    },
    {
      source: "page:/seances?session",
      target: "modal:generer-exercice",
      type: "ouverture",
      libelle: "Générer les exercices manquants",
      condition: "composition avec manquants",
    },

    /* ════════════════════════════════════════════════════════════════ */
    /* Depuis Compétences (page:/competences)                           */
    /* ════════════════════════════════════════════════════════════════ */
    { source: "page:/competences", target: "page:/", type: "navigation", libelle: "Tableau de bord (rail)" },
    {
      source: "page:/competences",
      target: "page:/seances",
      type: "navigation",
      libelle: "Cahier (rail)",
    },
    {
      source: "page:/competences",
      target: "page:/competences?vue=graphe",
      type: "navigation",
      libelle: "Vue Graphe",
    },
    {
      source: "page:/competences",
      target: "page:/competences/domaine/{id}",
      type: "navigation",
      libelle: "Carte domaine",
    },
    {
      source: "page:/competences",
      target: "modal:ajouter-competences",
      type: "ouverture",
      libelle: "+ Compétence",
    },
    {
      source: "page:/competences",
      target: "page:/demarrer",
      type: "navigation",
      libelle: "Déclare ton thème de travail",
      condition: "référentiel vide",
    },
    {
      source: "page:/competences",
      target: "tiroir:tuteur",
      type: "ouverture",
      libelle: "Ouvrir le tuteur (flottant)",
    },

    /* ── Depuis Compétences graphe ── */
    {
      source: "page:/competences?vue=graphe",
      target: "page:/competences",
      type: "navigation",
      libelle: "Vue Liste",
    },
    {
      source: "page:/competences?vue=graphe",
      target: "page:/competences/{code}",
      type: "navigation",
      libelle: "Nœud compétence",
    },
    {
      source: "page:/competences?vue=graphe",
      target: "tiroir:tuteur",
      type: "ouverture",
      libelle: "Ouvrir le tuteur (flottant)",
    },

    /* ── Depuis la fiche compétence ── */
    {
      source: "page:/competences/{code}",
      target: "page:/competences",
      type: "navigation",
      libelle: "Toutes les compétences (retour)",
    },
    {
      source: "page:/competences/{code}",
      target: "page:/exercices/{id}",
      type: "navigation",
      libelle: "Commencer / Réaliser un diagnostic",
      condition: "exercice recommandé ou disponible",
    },
    {
      source: "page:/competences/{code}",
      target: "modal:generer-exercice",
      type: "ouverture",
      libelle: "Générer un exercice",
      condition: "aucun exercice recommandé",
    },
    {
      source: "page:/competences/{code}",
      target: "tiroir:tuteur",
      type: "ouverture",
      libelle: "Explique-moi cette compétence",
    },
    {
      source: "page:/competences/{code}",
      target: "page:/competences/{code}",
      type: "navigation",
      libelle: "Prérequis / dépendants",
      condition: "prérequis ou dépendants déclarés",
    },
    {
      source: "page:/competences/{code}",
      target: "modal:evolution-competence",
      type: "ouverture",
      libelle: "Élargir la compétence",
      condition: "compétence maîtrisée",
    },
    {
      source: "page:/competences/{code}",
      target: "page:/",
      type: "navigation",
      libelle: "Prochaine action recommandée",
      condition: "preuve enregistrée",
    },

    /* ── Depuis le domaine ── */
    {
      source: "page:/competences/domaine/{id}",
      target: "page:/competences",
      type: "navigation",
      libelle: "Toutes les compétences (retour)",
    },
    {
      source: "page:/competences/domaine/{id}",
      target: "modal:reviser-domaine",
      type: "ouverture",
      libelle: "Réviser avec le tuteur",
    },
    {
      source: "page:/competences/domaine/{id}",
      target: "modal:ajouter-competences",
      type: "ouverture",
      libelle: "Ajouter une compétence à la main",
      condition: "via la modale de révision",
    },
    {
      source: "page:/competences/domaine/{id}",
      target: "page:/competences/{code}",
      type: "navigation",
      libelle: "Sous-compétence",
    },

    /* ════════════════════════════════════════════════════════════════ */
    /* Depuis Profil (page:/profil)                                     */
    /* ════════════════════════════════════════════════════════════════ */
    { source: "page:/profil", target: "page:/", type: "navigation", libelle: "Tableau de bord (rail)" },
    {
      source: "page:/profil",
      target: "page:/seances",
      type: "navigation",
      libelle: "Cahier (rail)",
    },
    {
      source: "page:/profil",
      target: "page:/competences",
      type: "navigation",
      libelle: "Gérer le référentiel",
    },
    {
      source: "page:/profil",
      target: "action:modifier-profil",
      type: "soumission",
      libelle: "Enregistrer le profil",
    },

    /* ════════════════════════════════════════════════════════════════ */
    /* Depuis l'amorçage (page:/demarrer)                               */
    /* ════════════════════════════════════════════════════════════════ */
    {
      source: "page:/demarrer",
      target: "modal:ajouter-competences",
      type: "ouverture",
      libelle: "Proposer une première branche",
      condition: "sujet et objectif renseignés",
    },
    {
      source: "page:/demarrer",
      target: "page:/competences",
      type: "navigation",
      libelle: "Redirection après validation",
      condition: "branche validée",
    },
    {
      source: "page:/demarrer",
      target: "page:/competences",
      type: "navigation",
      libelle: "Redirection — référentiel déjà construit",
      condition: "référentiel non vide",
    },

    /* ════════════════════════════════════════════════════════════════ */
    /* Depuis la connexion (page:/login)                                */
    /* ════════════════════════════════════════════════════════════════ */
    {
      source: "page:/login",
      target: "page:/",
      type: "navigation",
      libelle: "Connexion réussie",
    },
    {
      source: "page:/login",
      target: "page:/login",
      type: "navigation",
      libelle: "Échec — erreur affichée",
      condition: "identifiants invalides",
    },

    /* ════════════════════════════════════════════════════════════════ */
    /* Depuis l'exercice autonome (page:/exercices/{id})                */
    /* ════════════════════════════════════════════════════════════════ */
    {
      source: "page:/exercices/{id}",
      target: "page:/seances",
      type: "navigation",
      libelle: "Toutes les séances (retour)",
    },
    {
      source: "page:/exercices/{id}",
      target: "etape:exercice-chercher",
      type: "transition",
      libelle: "Commencer la tentative",
      condition: "aucune tentative en cours",
    },
    {
      source: "page:/exercices/{id}",
      target: "page:/competences/{code}",
      type: "navigation",
      libelle: "Voir l'effet sur la compétence",
      condition: "preuve enregistrée",
    },
    {
      source: "page:/exercices/{id}",
      target: "page:/",
      type: "navigation",
      libelle: "Prochaine action recommandée",
      condition: "preuve enregistrée",
    },
    {
      source: "page:/exercices/{id}",
      target: "tiroir:tuteur",
      type: "ouverture",
      libelle: "Demander de l'aide au tuteur",
      condition: "tentative en cours",
    },

    /* ════════════════════════════════════════════════════════════════ */
    /* Parcours exercice — les trois actes                              */
    /* ════════════════════════════════════════════════════════════════ */
    {
      source: "etape:exercice-chercher",
      target: "action:demarrer-tentative",
      type: "soumission",
      libelle: "Commencer",
    },
    {
      source: "etape:exercice-chercher",
      target: "action:debloquer-indice",
      type: "soumission",
      libelle: "Débloquer l'indice N",
      condition: "indices restants",
    },
    {
      source: "etape:exercice-chercher",
      target: "etape:exercice-comparer",
      type: "transition",
      libelle: "Afficher la correction",
    },
    {
      source: "etape:exercice-chercher",
      target: "action:abandonner-tentative",
      type: "soumission",
      libelle: "Abandonner cette tentative",
    },
    {
      source: "etape:exercice-comparer",
      target: "etape:exercice-mesurer",
      type: "transition",
      libelle: "Passer à l'évaluation",
    },
    {
      source: "etape:exercice-comparer",
      target: "action:abandonner-tentative",
      type: "soumission",
      libelle: "Abandonner cette tentative",
    },
    {
      source: "etape:exercice-mesurer",
      target: "action:terminer-exercice",
      type: "soumission",
      libelle: "Accepter et enregistrer / Enregistrer la preuve",
      condition: "réponse suffisante et critères renseignés",
    },
    {
      source: "etape:exercice-mesurer",
      target: "action:abandonner-tentative",
      type: "soumission",
      libelle: "Abandonner cette tentative",
    },
    {
      source: "action:terminer-exercice",
      target: "etape:exercice-bilan",
      type: "transition",
      libelle: "Preuve enregistrée",
    },
    {
      source: "etape:exercice-bilan",
      target: "page:/competences/{code}",
      type: "navigation",
      libelle: "Voir l'effet sur la compétence",
    },
    {
      source: "etape:exercice-bilan",
      target: "page:/",
      type: "navigation",
      libelle: "Prochaine action recommandée",
    },
    {
      source: "etape:exercice-bilan",
      target: "etape:exercice-chercher",
      type: "transition",
      libelle: "Refaire cet exercice",
    },

    /* ════════════════════════════════════════════════════════════════ */
    /* Concepteur de séance — deux phases                               */
    /* ════════════════════════════════════════════════════════════════ */
    {
      source: "modal:composer-seance",
      target: "modal:composer-seance-composition",
      type: "transition",
      libelle: "Voir la composition",
      condition: "thème choisi et temps renseigné",
    },
    {
      source: "modal:composer-seance",
      target: "modal:creer-theme",
      type: "ouverture",
      libelle: "+ Décrire ce que je veux apprendre",
      condition: "mode personnalisé",
    },
    {
      source: "modal:composer-seance",
      target: "action:retirer-theme",
      type: "soumission",
      libelle: "Retirer un thème",
      condition: "thèmes enregistrés",
    },
    {
      source: "modal:composer-seance",
      target: "action:renommer-theme",
      type: "soumission",
      libelle: "Renommer un thème",
      condition: "thèmes enregistrés",
    },
    {
      source: "modal:composer-seance-composition",
      target: "modal:composer-seance",
      type: "retour",
      libelle: "Revenir au besoin",
    },
    {
      source: "modal:composer-seance-composition",
      target: "modal:generer-exercice",
      type: "ouverture",
      libelle: "Générer les exercices manquants",
      condition: "manquants dans la composition",
    },
    {
      source: "modal:composer-seance-composition",
      target: "action:creer-seance",
      type: "soumission",
      libelle: "Démarrer",
      condition: "au moins un exercice disponible",
    },
    {
      source: "modal:composer-seance-composition",
      target: "action:creer-seance",
      type: "soumission",
      libelle: "Planifier pour plus tard",
      condition: "au moins un exercice disponible",
    },
    {
      source: "action:creer-seance",
      target: "page:/seances?session",
      type: "transition",
      libelle: "Redirection — séance démarrée",
      condition: "mode « Démarrer »",
    },
    {
      source: "action:creer-seance",
      target: "page:/seances",
      type: "transition",
      libelle: "Retour au cahier — séance planifiée",
      condition: "mode « Planifier »",
    },

    /* ════════════════════════════════════════════════════════════════ */
    /* Génération d'exercice                                            */
    /* ════════════════════════════════════════════════════════════════ */
    {
      source: "modal:generer-exercice",
      target: "modal:generer-exercice-previsualisation",
      type: "transition",
      libelle: "Générer",
      condition: "compétence choisie",
    },
    {
      source: "modal:generer-exercice-previsualisation",
      target: "action:creer-exercice",
      type: "soumission",
      libelle: "Accepter",
    },
    {
      source: "modal:generer-exercice-previsualisation",
      target: "modal:generer-exercice-previsualisation",
      type: "transition",
      libelle: "Modifier → Appliquer avec l'IA",
      condition: "consigne de modification saisie",
    },
    {
      source: "action:creer-exercice",
      target: "page:/seances?session",
      type: "transition",
      libelle: "Redirection — workspace focus",
      condition: "ouvrirDansCahierApresAcceptation",
    },
    {
      source: "action:creer-exercice",
      target: "page:/seances",
      type: "transition",
      libelle: "Retour — exercice enregistré",
      condition: "depuis la composition",
    },

    /* ════════════════════════════════════════════════════════════════ */
    /* Ajout de compétences                                             */
    /* ════════════════════════════════════════════════════════════════ */
    {
      source: "modal:ajouter-competences",
      target: "action:creer-branche",
      type: "soumission",
      libelle: "Valider la branche",
    },
    {
      source: "action:creer-branche",
      target: "page:/competences",
      type: "transition",
      libelle: "Redirection après création",
    },

    /* ════════════════════════════════════════════════════════════════ */
    /* Tiroir du tuteur                                                 */
    /* ════════════════════════════════════════════════════════════════ */
    {
      source: "tiroir:tuteur",
      target: "modal:generer-exercice",
      type: "ouverture",
      libelle: "Exercice proposé par le tuteur",
      condition: "proposition d'exercice",
    },
    {
      source: "tiroir:tuteur",
      target: "modal:ajouter-competences",
      type: "ouverture",
      libelle: "Branche proposée par le tuteur",
      condition: "proposition de référentiel",
    },

    /* ════════════════════════════════════════════════════════════════ */
    /* Réglages du compte                                               */
    /* ════════════════════════════════════════════════════════════════ */
    {
      source: "tiroir:reglages",
      target: "action:exporter-journal",
      type: "soumission",
      libelle: "Exporter mon journal",
    },
    {
      source: "tiroir:reglages",
      target: "action:se-deconnecter",
      type: "soumission",
      libelle: "Se déconnecter",
      condition: "connecté",
    },
    {
      source: "tiroir:reglages",
      target: "page:/login",
      type: "navigation",
      libelle: "Se connecter",
      condition: "non connecté mais Supabase configuré",
    },
    {
      source: "tiroir:reglages",
      target: "action:enregistrer-cle-tuteur",
      type: "soumission",
      libelle: "Enregistrer la clé du tuteur",
    },
    {
      source: "action:se-deconnecter",
      target: "page:/login",
      type: "transition",
      libelle: "Redirection après déconnexion",
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Parcours BFS                                                        */
/* ------------------------------------------------------------------ */

export interface ResultatBFS {
  /** Ordre de découverte (BFS). */
  ordre: string[];
  /** Nœuds atteignables depuis la racine. */
  noeuds: NoeudWorkflow[];
  /** Arêtes du sous-graphe atteignable. */
  liens: LienWorkflow[];
  /** Nœuds déclarés mais non atteignables depuis la racine. */
  inatteignables: NoeudWorkflow[];
  /** Profondeur de chaque nœud (distance en arêtes depuis la racine). */
  profondeurs: Map<string, number>;
}

/**
 * Parcours en largeur (BFS) du graphe de workflow depuis un nœud racine.
 *
 * Le graphe est orienté : on ne suit que les arêtes sortantes. Un nœud
 * déclaré mais jamais atteint depuis la racine est signalé — c'est soit un
 * état mort (défaut), soit une entrée volontairement hors du flux principal
 * (ex. `/login`).
 *
 * @param graphe  le graphe déclaré (défaut : `GRAPHE_WORKFLOW`)
 * @param racine  l'identifiant du nœud de départ (défaut : `page:/`)
 */
export function parcourirWorkflow(
  graphe: GrapheWorkflow = GRAPHE_WORKFLOW,
  racine = "page:/",
): ResultatBFS {
  const parId = new Map(graphe.noeuds.map((n) => [n.id, n]));
  const sortants = new Map<string, LienWorkflow[]>();
  for (const lien of graphe.liens) {
    const liste = sortants.get(lien.source) ?? [];
    liste.push(lien);
    sortants.set(lien.source, liste);
  }

  const racineExiste = parId.has(racine);
  if (!racineExiste) {
    throw new Error(`Nœud racine inconnu : ${racine}`);
  }

  const visites = new Set<string>([racine]);
  const file: string[] = [racine];
  const ordre: string[] = [];
  const profondeurs = new Map<string, number>([[racine, 0]]);
  const liensAtteints: LienWorkflow[] = [];

  while (file.length > 0) {
    const courant = file.shift()!;
    ordre.push(courant);

    for (const lien of sortants.get(courant) ?? []) {
      // Une arête vers un nœud inconnu est un défaut de déclaration.
      if (!parId.has(lien.target)) {
        throw new Error(
          `Arête ${lien.source} → ${lien.target} : nœud cible non déclaré.`,
        );
      }
      liensAtteints.push(lien);
      if (!visites.has(lien.target)) {
        visites.add(lien.target);
        profondeurs.set(lien.target, (profondeurs.get(courant) ?? 0) + 1);
        file.push(lien.target);
      }
    }
  }

  const noeudsAtteints = ordre.map((id) => parId.get(id)!);
  const inatteignables = graphe.noeuds.filter((n) => !visites.has(n.id));

  return {
    ordre,
    noeuds: noeudsAtteints,
    liens: liensAtteints,
    inatteignables,
    profondeurs,
  };
}

/* ------------------------------------------------------------------ */
/* Statistiques de base                                                */
/* ------------------------------------------------------------------ */

export interface StatistiquesGraphe {
  totalNoeuds: number;
  totalLiens: number;
  atteignables: number;
  inatteignables: number;
  /** Degré sortant moyen des nœuds atteignables. */
  degreSortantMoyen: number;
  /** Degré entrant moyen des nœuds atteignables. */
  degreEntrantMoyen: number;
  /** Nœuds sans arête sortante — états terminaux. */
  puits: string[];
  /** Nœuds sans arête entrante — points d'entrée. */
  sources: string[];
  /** Diamètre approximatif : profondeur maximale du BFS. */
  diametreBFS: number;
}

export function statistiquesGraphe(
  resultat: ResultatBFS,
  graphe: GrapheWorkflow = GRAPHE_WORKFLOW,
): StatistiquesGraphe {
  const ids = new Set(resultat.noeuds.map((n) => n.id));
  const sortants = new Map<string, number>();
  const entrants = new Map<string, number>();
  for (const id of ids) sortants.set(id, 0);
  for (const id of ids) entrants.set(id, 0);

  for (const lien of resultat.liens) {
    if (!ids.has(lien.source) || !ids.has(lien.target)) continue;
    sortants.set(lien.source, (sortants.get(lien.source) ?? 0) + 1);
    entrants.set(lien.target, (entrants.get(lien.target) ?? 0) + 1);
  }

  const puits = [...ids].filter((id) => (sortants.get(id) ?? 0) === 0);
  const sources = [...ids].filter((id) => (entrants.get(id) ?? 0) === 0);

  const degreSortantMoyen =
    resultat.noeuds.length > 0
      ? [...sortants.values()].reduce((s, v) => s + v, 0) / resultat.noeuds.length
      : 0;
  const degreEntrantMoyen =
    resultat.noeuds.length > 0
      ? [...entrants.values()].reduce((s, v) => s + v, 0) / resultat.noeuds.length
      : 0;

  const diametreBFS = Math.max(0, ...resultat.profondeurs.values());

  return {
    totalNoeuds: graphe.noeuds.length,
    totalLiens: graphe.liens.length,
    atteignables: resultat.noeuds.length,
    inatteignables: resultat.inatteignables.length,
    degreSortantMoyen,
    degreEntrantMoyen,
    puits,
    sources,
    diametreBFS,
  };
}