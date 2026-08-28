# Design QA — tableau de bord orchestration

Date : 28/08/2026

## Référence

- Cible : `docs/design/assets/tableau-de-bord-orchestration-cible.png`
- Composition : `app/src/components/dashboard/tableau-bord-orchestration.tsx`
- Route : `/app` (navigation existante conservée)

## Captures

- `dashboard-1440x1024.png` — état représentatif clair, 1440 × 1024
- `dashboard-mobile.png` — état représentatif clair, viewport mobile
- `dashboard-dark.png` — état représentatif sombre, 1440 × 1024
- `dashboard-no-deadline.png` — état clair sans échéance, avec le geste de
  déclaration fonctionnel

Les captures isolées utilisent les vrais tokens CSS chargés par l'application,
un état avec échéance, preuves et deux séances acceptées, puis un état mobile
empilé. La chronologie reste lisible, le bandeau des jours défile
horizontalement, les actions gardent des cibles tactiles d'au moins 44 px et le
réordonnancement repose sur des boutons clavier.

Le thème sombre a également été rendu et inspecté ; les mêmes tokens portent le
contraste sans ajouter de couleur locale.

## Comparaison

Après inspection de la cible et du rendu :

- hiérarchie : « Votre journée » domine la carte d'échéance ;
- proportions : composition principale calée sur la largeur relative de la
  référence, avec la semaine et le bandeau des jours en dessous ;
- densité : espacements, titres serif, bordures et boutons existants réutilisés ;
- états honnêtes : invitation courte sans séance acceptée, « Non estimable »
  sans preuve, aucune valeur en pourcentage.

Les écarts de chargement CSS et de débordement mobile de la première capture
ont été corrigés avant ces captures finales.

## Limite d'intégration

La capture de la route authentifiée n'a pas pu être réalisée dans cet
environnement : `/app` redirige vers `/login` sans session Supabase de test.
La comparaison intégrée reste donc bloquée jusqu'à une session de test
autorisée.

**Final result: blocked** — aucune anomalie P0/P1/P2 restante dans la capture
isolée ; la validation finale sur le rendu authentifié est la prochaine étape.
