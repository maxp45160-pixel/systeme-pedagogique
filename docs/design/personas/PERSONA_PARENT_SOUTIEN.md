# Simulation persona — parent d'élève en soutien scolaire

**Version 1.0 — 22/08/2026. Simulation d'évaluation, aucune décision validée.**

> Persona dérivé de la méthode du persona académique (v1.1, même jour). Les
> verdicts s'appuient sur la relecture de code commune ; les étapes qui
> dépendent d'une sortie du tuteur sont des hypothèses non réfutées.

## 1. Persona

Karim, 44 ans, père de Nathan, 13 ans, en quatrième. Nathan accumule des lacunes
en maths (fractions, équations) et décroche en anglais. Karim n'est pas en
mesure de l'aider lui-même : il cherche un outil qui produise des exercices à
la hauteur des trous de Nathan et lui permette de voir si ça progresse.
Disponibilité : deux créneaux de 20 minutes par semaine avec Nathan, le
mercredi et le dimanche.

## 2. Scénario en huit gestes

| # | Geste |
|---|---|
| S0 | Créer un compte **pour son fils** |
| S1 | Déclarer l'intention (« combler les lacunes de maths de 4e ») → référentiel proposé |
| S2 | Déposer les supports réels : photos du cahier, fiches du professeur |
| S3 | Lancer une séance courte calibrée sur 20 min |
| S4 | Faire travailler Nathan sans savoir lui-même si sa réponse est juste |
| S5 | Voir si ça progresse d'une semaine sur l'autre |
| S6 | Gérer deux enfants dans la même app |

Verdicts : ✅ fluide · 🟡 faisable avec friction · ❌ bloqué · 🔬 hypothèse non testable sans exécution du tuteur.

## 3. Walkthrough détaillé

### S0 — Compte pour autrui — ❌ structurel / 🟡 contournement

Le compte est mono-utilisateur (`auth.users` unique, aucune notion de profil ou
de bénéficiaire dans le schéma). Karim peut créer un compte au nom de Nathan,
mais alors c'est Nathan qui manipule l'app — ce qui ne correspond pas au
geste réel (le parent pilote). S'il crée un compte à son nom, toutes les
données de travail se rattachent à Karim : le journal confondra « qui a fait
quoi ». Contournement partiel : compte au nom de Nathan, piloté par Karim.
Aucune donnée ne distingue jamais le pilote de l'apprenant.

### S1 — Intention → référentiel — 🔬

Même mécanique que pour l'étudiante : `/demarrer` → phrase d'intention →
proposition de branches par le tuteur (`outilReferentielComplet`,
`lib/tutor/outils.ts:756`), codes attribués par l'application. Hypothèse non
réfutée : rien n'indique que le tuteur sait ancrer ses propositions sur le
programme officiel de 4e plutôt que sur la phrase du parent. La qualité du
référentiel dépend entièrement de cette sortie non vérifiée.

### S2 — Photos du cahier — ❌

Seul le PDF est accepté, ≤ 10 Mo, bucket `pieces-jointes`
(`televersement-pdf.ts`). Une photo de cahier ou de contrôle n'est ni convertie
ni acceptée : le geste réel du parent (photographier le cahier) n'a pas de
surface. Le dépôt PDF documente mais ne nourrit pas la boucle (déjà constaté
en S3 du persona académique).

### S3 — Séance de 20 minutes — ✅

Le compositeur capture le temps disponible comme contexte
(`etape-composition.tsx`, contexte instant déclaré). Le tableau de bord reprend
les travaux ouverts. Le geste court correspond au cœur du produit.

### S4 — Parent non sachant — ✅ / 🔬

La boucle génération → évaluation → adaptation ne suppose pas que l'accompagnant
connaisse la matière : exercices générés, correction outillée
(`outilCorrection` confiné au chemin prévu), bilan dérivant l'autonomie
observée (P8/ADR-057). Hypothèse : le ton et les consignes s'adressent-ils à un
adolescent accompagné ? Aucun réglage d'audience n'existe.

### S5 — Voir la progression hebdomadaire — 🟡

Les observations sont stockées (jamais recalculées) et le tableau de bord
arbitre quoi faire maintenant. Mais la lecture « où en est Nathan sur les
fractions après trois semaines » demande de reconstruire soi-même l'historique :
l'Atelier expose l'arbre par domaine et le Cahier liste les séances, sans vue
longitudinale par compétence. Absence de preuve ≠ zéro est respecté côté
stockage ; côté restitution, la tendance est invisible.

### S6 — Deux enfants — 🟡

Pas de profil : le proxy est un domaine par enfant (« maths de Nathan »,
« anglais de Lina »), ce qui mélange enfants et matières dans le même
référentiel. Deux comptes fonctionnent mais doublent la charge et séparent le
suivi. Aucune des deux options n'est portée par le produit.

## 4. Scorecard

| # | Geste | Verdict | Cause racine |
|---|---|---|---|
| S0 | Compte pour son fils | ❌ / 🟡 | mono-utilisateur ; pilote ≠ apprenant |
| S1 | Intention → référentiel | 🔬 | dépend de la sortie tuteur, non vérifiée |
| S2 | Photo du cahier | ❌ | PDF seul format accepté |
| S3 | Séance de 20 min | ✅ | cœur du produit |
| S4 | Accompagner sans savoir | ✅ / 🔬 | boucle outillée ; audience non réglée |
| S5 | Progression hebdomadaire | 🟡 | stockage OK, restitution longitudinale absente |
| S6 | Deux enfants | 🟡 | pas de profil ; proxy domaine bancal |

**Conclusion générale.** La boucle d'apprentissage convient à l'usage accompagné,
mais tout ce qui fait « usage pour autrui » (compte bénéficiaire, photo de
cahier, suivi longitudinal, plusieurs enfants) repose sur des contournements.
C'est le persona qui s'éloigne le plus des hypothèses implicites du produit.

## 5. Écarts classés — hypothèses à arbitrer, pas des chantiers ouverts

1. **Pilote ≠ apprenant (couvre S0/S6).** Toute réponse (profils, multi-comptes
   assumé, refus assumé du cas) touche le modèle de compte et la RLS. Ne rien
   construire avant arbitrage explicite. Test de réfutation PRODUCT.md §4
   applicable.
2. **Formats de pièces jointes (S2).** Accepter une image est un élargissement
   de périmètre produit (analyse d'image ?) — arbitrage lourd, pas un fix.
3. **Restitution longitudinale (S5).** Une vue « évolution par compétence » ne
   créerait aucune donnée (tout est déjà stocké) ; reste à arbitrer si elle a
   sa place hors du tableau de bord d'actions.
