# PRODUCT_VISION.md — Système pédagogique

**Version 1.0 — 27/07/2026.** Document vivant. Toute modification doit préciser
ce qui passe d'une catégorie à l'autre (décision / hypothèse / question / idée
abandonnée).

> **Comment lire ce document.** Les quatre statuts sont utilisés partout dans
> ce dépôt et ont un sens strict :
>
> | Statut | Signification |
> |---|---|
> | ✅ **Décision** | Tranché, par une personne, explicitement. Ne se rediscute qu'en changeant ce document. |
> | 🔬 **Hypothèse** | Plausible et argumenté, **non vérifié**. Doit porter son test de réfutation. |
> | ❓ **Question ouverte** | Arbitrage identifié, pas encore rendu. Bloque ou oriente du travail. |
> | 🗑️ **Abandonné** | Envisagé puis écarté. Conservé avec sa raison, pour ne pas y revenir par oubli. |

---

## 1. Ce que le produit est

Un **instrument de mesure de compétences**, dont la fonction première est de
**refuser d'affirmer ce qu'il ne peut pas prouver**.

L'utilisateur travaille. Le système enregistre des **preuves** de ce travail,
en **dérive** un niveau par compétence, et **recommande** la prochaine action.
Rien de ce qui peut être recalculé n'est stocké.

Ce n'est pas un tracker d'habitudes, pas un LMS, pas un outil de révision. La
distinction tient en une phrase : **un tracker enregistre ce que tu déclares
avoir fait ; ce système enregistre ce qui a été observé, et en tire ce qu'il
peut honnêtement en tirer — souvent moins que ce qu'on aimerait.**

## 2. Ce que le produit n'est pas

- **Pas un outil de motivation.** L'XP et les jalons existent, adossés à des
  preuves, et restent secondaires. Le système n'a pas vocation à faire
  plaisir : un score de 10/100 après trois jours de travail sérieux est une
  information, pas un échec de conception.
- **Pas un générateur de contenu pédagogique de référence.** Il ne prétend pas
  remplacer un cours ou un enseignant.
- **Pas un réseau social.** Voir `ARCHITECTURE_DECISIONS.md` — la comparaison
  entre utilisateurs est en tension directe avec le principe fondateur.
- **Pas un système d'évaluation certifiante.** Aucun niveau produit ici n'a de
  valeur institutionnelle.

## 3. Public

**Aujourd'hui, factuellement :** 3 comptes existent en production.
Un utilisateur actif (15 preuves, 12 compétences, 8 diagnostics terminés,
4 séances le 27/07), un compte de développement (1 preuve), un compte sans
aucune activité.

**Cible déclarée :** toute personne souhaitant un suivi longitudinal de ses
compétences avec un parcours personnalisé, en autoformation ou en complément
d'une formation.

🔬 **Hypothèse non vérifiée :** que le besoin existe au-delà de son auteur.
Aucun utilisateur tiers n'a encore utilisé le système sur une durée
significative. *Test de réfutation : un compte tiers atteint 10 preuves sans
assistance de l'auteur.*

## 4. La proposition de valeur, en une ligne

> Savoir **ce que tu sais réellement faire**, avec le degré de certitude qui
> va avec — et savoir quoi travailler ensuite, pour une raison qu'on peut te
> montrer.

Les trois membres de cette phrase sont d'inégale maturité :

| Promesse | État réel au 27/07 |
|---|---|
| « ce que tu sais réellement faire » | ✅ Tenue. Le moteur est complet et testé. |
| « avec le degré de certitude » | ✅ Tenue. Niveau / confiance / robustesse sont distincts et affichés. |
| « quoi travailler ensuite » | ⚠️ **Partiellement tenue.** Le moteur classe correctement, mais l'application n'a plus de quoi faire travailler après 3 exercices. |

## 5. La réalité mesurée au 27/07/2026

Chiffres relevés **en base de production**, pas dans le journal local figé
(`app/data/store/*.json`, qui n'est plus représentatif — voir
`ARCHITECTURE_DECISIONS.md` ADR-002).

```
Score global      10/100        (12/43 compétences évaluées)
Niveau moyen      0,9/5         là où une mesure existe
Confiance         faible        plafonnée par la couverture
Preuves           15
Robustesse moy.   0,40
XP                100 — Niveau 1 « Observateur »

Corpus d'exercices     11, tous des diagnostics de démarrage
Exercices consommés     8
Exercices restants      3
Exercices créés (tuteur ou manuel)   0
Compétences sans aucun exercice     31 / 43
```

**Lecture.** L'appareil de mesure fonctionne. Le stock de travail est presque
épuisé. C'est le seul fait qui doit orienter les prochaines semaines.

## 6. Horizon

### Ce qui est décidé

✅ **Le contenu vient du tuteur, pas de fichiers écrits à la main.**
Décidé le 27/07. Écrire des exercices en TypeScript ne passe pas à l'échelle
et rend toute généralisation impossible (un référentiel de droit n'aura jamais
de *seeds*).

✅ **La solution de tuteur doit être gratuite.**
Décidé le 27/07. Contrainte structurante : elle exclut l'API Anthropic payante
comme dépendance obligatoire du chemin nominal.

✅ **Construire et utiliser en parallèle est le mode de travail retenu.**
Décidé le 27/07 par l'auteur, qui dispose du temps nécessaire et considère
l'évolution de l'outil comme une part de la pratique. Les données lui donnent
raison : l'usage n'a pas été interrompu par le développement.

### Ce qui reste ouvert

❓ Quel moteur gratuit alimente le tuteur (voir ADR-007).
❓ Si et quand le référentiel cesse d'être codé en dur (voir ADR-009).
❓ Comment la mesure d'autonomie tient compte de l'aide externe (voir ADR-008).

Ces trois questions décident, ensemble, de ce que l'application devient. Aucune
n'est tranchée aujourd'hui.

## 7. Critère d'arrêt

Une fonctionnalité n'entre pas dans ce produit parce qu'elle est
intéressante, mais parce qu'elle sert la phrase du §4. Le cadre d'évaluation
est dans `FEATURE_EVALUATION_FRAMEWORK.md` et s'applique **à toute proposition,
y compris celles venant d'une session Claude.**

---

## Annexe — ce qui a été envisagé puis écarté

🗑️ **« Geler le développement trois semaines pour n'utiliser que l'app. »**
Proposé le 27/07 dans une analyse produit, écarté le jour même par l'auteur :
le temps disponible permet les deux, et voir l'outil évoluer fait partie de la
motivation. Les données confirment qu'il n'y a pas eu d'éviction de l'usage par
le développement. **Ne pas reproposer sans fait nouveau.**

🗑️ **« Écrire 30 exercices seed supplémentaires à la main. »**
Écarté le 27/07 : coût récurrent, non transférable à un autre référentiel,
et incompatible avec la généralisation visée.
