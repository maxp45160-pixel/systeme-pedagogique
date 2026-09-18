# NUIT-0003 — Accessibilité des contrôles partagés

Mandat : `2026-09-17-nuit-mandat.md`. Livraison locale, sans changement de
destination, de modèle métier, de base ou de dépendance.

## Défauts et corrections

Recette sous Edge, avec React, la vraie primitive Modale et les CSS de
l'application : avant correction, six scénarios clavier/défilement échouaient.
Les contrôles Axe passaient déjà : leur réussite seule ne détectait pas ces
défauts d'interaction.

- Échap ne traite que la fenêtre supérieure ; les événements déjà consommés
  par son contenu sont respectés.
- Le focus revient au déclencheur lors du masquage du tuteur conservé monté,
  comme lors du démontage. Une autre fenêtre active empêche un retour derrière elle.
- La boucle de tabulation inclut les éditeurs contenteditable, exclut les
  contrôles désactivés, invisibles et explicitement retirés de la tabulation.
  Depuis une cible statique, Tab et Shift+Tab rejoignent la boucle.
- Le verrou du défilement est partagé : fermer le parent avant l'enfant ne
  débloque plus prématurément la page, ni ne laisse le verrou après fermeture.
- Une cible initiale non focalisable déclenche un repli. La revue indépendante
  a reproduit ce défaut présent chez ModaleEngagement, qui désigne un div.
- Le filtre « Une compétence précise » possède un label associé via useId.
- Le bouton « Noter » du bloc-notes devient visible lorsqu'il reçoit le focus.

Les règles DOM réutilisables sont dans `app/src/lib/ui/modales.ts` ; le
composant conserve le cycle React et le rendu existants.

## Vérification reproductible

Depuis la racine : `node app/scripts/verify-accessibilite.mjs`.
Vite, Playwright, axe-core et Edge étaient disponibles, sans installation.
Treize scénarios couvrent les interactions ci-dessus et quatre combinaisons
clair/sombre, largeur 320/1280 px. Axe utilise les tags WCAG 2.1 A/AA sur
la fenêtre de recette ; le document ne déborde pas horizontalement dans ces cas.
Les deux formulaires sont les vrais composants. Seuls les actions serveur,
le traitement des notes et les palettes de formules sont simulés ; aucune
note n'est soumise et aucune donnée réelle n'est consultée.

Les contrôles de clôture et empreintes figurent dans
`ai-company/operations/missions/NUIT-0003.json` : vérification TypeScript,
ESLint et suite Vitest, recette navigateur, build et agents:check.
Revue React et revue indépendante de la gestion des fenêtres effectuées.

## Limites et documentation

Il s'agit de tests ciblés, pas d'une certification WCAG ni d'un audit exhaustif
des parcours. Aucun test avec NVDA/VoiceOver, appareil mobile réel, Safari ou
Firefox. L'isolation de l'arrière-plan pour la navigation virtuelle d'un
lecteur d'écran reste à vérifier ; le correctif porte sur les défauts clavier
démontrés. Aucun jugement global sur les contrastes de l'application.

Le contrat courant de PRODUCT (ergonomie des workspaces, ADR-066) distingue
déjà conformité mécanique et utilité observée. Ces corrections le réalisent
sans nouveau contrat ni promotion de statut ; aucune modification produit ou
architecturale n'est nécessaire pour ce lot.

Références : [pattern de fenêtre modale WAI-ARIA](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
Le critère [taille de cible 2.5.5](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
est de niveau AAA en WCAG 2.1 : une taille inférieure à 44 px n'a pas été
présentée comme une violation AA.
