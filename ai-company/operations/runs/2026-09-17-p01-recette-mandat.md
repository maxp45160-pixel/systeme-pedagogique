# P01-0004 — Recette sans nouvelle analyse payante

Source humaine : le 17/09, Maxime répond « vas-y fais les tests » à la proposition de vérifier les trois tranches ensemble : domaine existant/nouveau sujet, ambiguïtés, correction/retrait, fermeture/réouverture et recherche. La proposition précisait l'utilisation des analyses déjà enregistrées et l'absence de nouvelle dépense.

Mandat : recette navigateur locale sur les ressources conservées et, si nécessaire, documents de test explicitement identifiables créés sans IA. Préserver les originaux et les choix humains antérieurs ; aucun essai fournisseur, publication, changement de permissions ou reprise automatique d'analyse. Ne pas inventer une analyse réelle pour couvrir un cas indisponible. Aucun transfert de l'essai UX-0001.

Plan : lancer le serveur local, utiliser la session authentifiée existante, relire les analyses sans les lancer, vérifier listes/recherche/ouverture, exercer les changements réversibles sur un support de test si le parcours gratuit le permet, puis comparer l'état relu. Consigner exactement les cas passés, défauts et cas empêchés par l'absence d'analyse exploitable. Les tests synthétiques précédents ne seront pas présentés comme une recette sur corpus réel.

État initial : HEAD e9c6fc76c1866a4dee876e541bda8394abc0bd60 avec diff local P01-0003 conservé ; migration domaines_organisation_vides déjà appliquée, à ne pas rejouer. Le serveur restreint ne pouvait pas joindre Supabase (socket interdit) ; arrêt de ce processus, relance du seul serveur local avec accès réseau d'exécution. Aucune permission applicative changée. Session localhost retrouvée après relance.
