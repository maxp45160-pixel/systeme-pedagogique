# Plan d'implémentation UI/UX — persona parent d'élève (Karim)

**Version 1.0 — 22/08/2026. Proposition, aucune décision validée.**

> Marquage : **[S]** sans nouvelle entité ni décision · **[D]** décision humaine
> requise. Ici, les deux chantiers structurants sont [D] : ce plan sert surtout
> à cadrer l'arbitrage, pas à ouvrir un chantier.

## Vue d'ensemble

| Chantier | Couvre | Type | Effort |
|---|---|---|---|
| P1. Lecture longitudinale par domaine | S5 | [S] | faible |
| P2. Formats de pièces jointes (photo) | S2 | [D] | moyen |
| P3. Pilote ≠ apprenant (profil bénéficiaire) | S0/S6 | [D] | lourd |

## P1 — Lecture longitudinale par domaine [S]

**Constat corrigé.** La restitution existe déjà : `/progression` porte le profil
de carrière (ADR-098) avec `top-competences`, `faits-marquants`,
`comparaison-domaines`, `bilan-croissance`. Ce qui manque est l'entrée par
domaine depuis le regard « où en est Nathan en maths ».

**UI.**
- Sur `/progression`, filtre par domaine persistant dans l'URL
  (`/progression?domaine=maths`) — aucune donnée nouvelle, lecture du même état dérivé.
- Carte d'en-tête par domaine : compétences mesurées / en veille (P2 : jamais zéro),
  dernière observation sourcée, tendance dérivée. Tout nombre affiché vient des
  observations (aucun chiffre issu du temps passé).
- Depuis la carte des domaines de l'Atelier (`atelier/vues/carte-domaines.tsx`),
  lien direct vers cette vue filtrée.
- Mobile : le filtre devient une liste déroulante sous l'en-tête
  (`nav-mobile` inchangé).

**Données.** Aucune nouvelle ; tout est recalculé depuis le journal.

## P2 — Photo de cahier [D]

Ce que l'arbitrage doit trancher avant toute maquette :

1. **Acceptation passive** : stocker une image comme pièce jointe documentaire,
   sans analyse — le PDF reste le seul format « nourrissant ». Coût : extension
   du bucket et du téléversement (`televersement-pdf.ts` → générique), contrôle
   type MIME + taille. L'app n'affirme rien sur l'image.
2. **Acceptation avec lecture tuteur** : le tuteur lit l'image pour proposer des
   branches/exercices. Touche ADR-004/ADR-037 (le tuteur écrit du contenu, pas
   des mesures) — défendable mais nouveau moteur.
3. **Refus assumé** : message explicite au dépôt (« PDF uniquement »), cohérent
   avec la position produit.

UI commune aux options 1–2 : zone de dépôt unique, vignette après upload,
suppression réversible avant validation.

## P3 — Pilote ≠ apprenant [D]

Le plus lourd : touche `auth.users`, RLS, et le modèle de compte. Options :

| Option | Forme | Implication |
|---|---|---|
| Refus assumé | Rien ; éventuellement une phrase d'aide à l'amorçage (« pour qui travailles-tu ? » dans la phrase d'intention) | nulle |
| Comptes multiples conseillés | Guide dans `/compte` : créer un compte par enfant, changer via la connexion | nulle côté données |
| Profil bénéficiaire | Nouvelle entité liée au compte, cloisonnement RLS par profil | migration + RLS + toutes les surfaces gagnent un sélecteur |

Même en option 3, l'invariant tient : chaque donnée pédagogique reste isolée par
compte (et désormais par profil). Toute clé navigateur resterait isolée par
compte **et** profil (garde-fou stockage).

Recommandation de séquence si arbitrage favorable : option « comptes multiples
conseillés » d'abord (zéro code), observer, puis seulement envisager l'entité.
Le test de réfutation PRODUCT.md §4 s'applique tel quel.

## Vérification

- P1 : relecture scanner UX — `/progression?domaine=` doit être atteignable
  depuis Atelier (distance ≤ 3) ; tests sur la fonction partagée de calcul de
  tendance existante.
