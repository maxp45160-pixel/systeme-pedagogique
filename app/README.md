# Système pédagogique — interface de suivi longitudinal

Centre de pilotage personnel du développement de compétences en ingénierie des
systèmes complexes. L'application lit le système pédagogique textuel qui existait
déjà dans `data/`, en dérive des indicateurs à partir des preuves accumulées, et
recommande la prochaine action la plus utile.

## Lancer

```bash
cd app && npm install && npm run dev
```

L'application est disponible sur http://localhost:3000.

```bash
npm run verify   # types + lint + tests du moteur
npm run test     # tests du moteur seuls
npm run build    # build de production
```

> **Application locale, mono-utilisateur.** Les Server Functions écrivent sur le
> disque sans authentification. C'est acceptable sur `localhost` ; **ne pas
> exposer cette application sur un réseau public en l'état.**

## IA Tutor (optionnel)

Créer `app/.env.local` :

```
ANTHROPIC_API_KEY=sk-ant-...
```

Sans clé, le chat est désactivé et l'interface bascule sur « Copier le
contexte » : elle construit exactement le même prompt et te le rend pour que tu
le colles dans Claude. **Elle ne simule jamais de réponse.**

Le tuteur n'a **aucun accès en écriture** au profil. Quand une interaction
constitue une preuve, il émet une proposition structurée (compétence, niveau
avant/après, preuve, autonomie, réserve) que tu valides toi-même.

## Le principe qui gouverne tout

Le dossier `data/00_instructions/` définit un protocole anti-hallucination.
L'interface l'applique aussi strictement que le tuteur :

- **rien n'est stocké de ce qui peut être dérivé.** Le disque ne contient que
  des faits observés — preuves, tentatives, séances. Niveaux, scores, XP,
  badges et recommandations sont recalculés à chaque lecture ;
- **aucune valeur sans source.** Chaque nombre affiché porte un « Pourquoi ? »
  qui liste les preuves dont il découle et les réserves qui l'accompagnent ;
- **l'absence de mesure n'est pas un zéro.** Sans preuve, le score global
  affiche `—`, jamais `0/100` ;
- **une faiblesse ne disparaît pas sans démonstration.** Les preuves
  contradictoires sont conservées et réduisent la confiance, pas le niveau.

Conséquence directe : **au premier lancement, l'application est vide.** Ce n'est
pas un défaut d'amorçage, c'est l'état réel du profil. Le bouton « Mode
démonstration » charge un jeu fictif, en mémoire uniquement, sous bandeau
permanent — il ne touche jamais tes données.

## Architecture

```
data/
  00_instructions/     protocoles (lus tels quels par le tuteur)
  01_profil/           matrice, profil, erreurs, historique
  store/               journal d'événements JSON écrit par l'application

app/src/
  lib/domain/          15 entités + référentiel des 43 compétences
  lib/engine/          moteur de dérivation (pur, testé)
  lib/store/           lecture/écriture disque + Server Functions
  lib/tutor/           contexte pédagogique + manifeste
  lib/seed/            10 exercices de diagnostic
  lib/demo/            jeu fictif étiqueté
  components/          ui · charts (SVG maison) · layout · dashboard
  app/                 routes
```

### Le moteur

`lib/engine/` transcrit les protocoles règle par règle. Les seuils ne sont pas
arbitraires : chacun cite le paragraphe qui l'impose.

| Règle | Source |
|---|---|
| Niveau 3 exige 2 preuves autonomes concordantes | instructions §11 |
| Niveau 4 exige 2 contextes distincts | évaluation §4 |
| Niveau 5 exige une preuve intégrée combinant ≥2 compétences | évaluation §4 |
| Un échec isolé baisse la confiance, pas le niveau | évaluation §9 |
| L'ancienneté dégrade confiance et robustesse, jamais le niveau acquis | évaluation §7 |
| Score = 30 % C + 25 % App + 20 % T + 15 % I + 10 % J, sur 5 | évaluation §12 |
| Robustesse = preuves × diversité × autonomie × récence × délai × transfert | évaluation §13 |
| Priorité = importance + écart + erreurs + ancienneté − prérequis − récence | évaluation §16 |
| Preuves de niveau C et D exclues du calcul | anti-hallucination §2 |

20 tests couvrent ces garanties (`npm run test`).

### Gamification non-farmable

Les XP sont une **projection** du journal de preuves : chaque `XPEvent` exige un
`sourceEvidenceId`. Ouvrir l'application, cliquer ou naviguer ne produit
structurellement rien. Une preuve produit au plus un événement, au motif le
mieux-disant. Le niveau global (Observateur → Ingénieur système) est affiché en
pied de barre latérale, délibérément secondaire par rapport à la matrice.

L'autonomie n'est jamais déclarée : elle est **déduite du nombre d'indices
réellement consultés** pendant l'exercice.

## Ce qui n'est pas encore construit

Projets, Lectures et Connaissances ont leur modèle de données et apparaissent
dans la navigation, mais leurs écrans annoncent franchement qu'ils n'existent
pas encore — plutôt qu'une maquette remplie de données inventées.
