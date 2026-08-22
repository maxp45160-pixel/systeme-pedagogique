# Personas de simulation

Simulations d'évaluation du produit à travers des profils d'usage. **Aucune de
ces simulations ne tranche rien** : chaque verdict est un constat de code, chaque
écart une hypothèse à arbitrer par une personne (PRODUCT.md §7). Aucun agent ne
fait monter un statut.

Méthode commune, héritée de la première simulation (académique) :

1. persona et scénario formalisé en gestes ;
2. relecture du code pour chaque geste, avec références — la relecture
   d'origine (v1.1 du persona académique, 22/08/2026) sert de base vérifiée
   commune ; les gestes qui dépendent d'une sortie du tuteur (proposition de
   branches, choix du genre d'intention) sont marqués comme **hypothèses non
   réfutées**, pas comme des faits observés ;
3. lecture mécanique par les scanners de workflow — graphe UX atomique régénéré
   le 22/08/2026 après le commit `4cd3323` : 138 nœuds / 436 arêtes, toutes
   atteignables depuis `/` ;
4. scorecard et écarts classés.

Verdicts : ✅ fluide · 🟡 faisable avec friction · ❌ bloqué.
Un ❌ désigne une capacité manquante ou invisible, rarement un défaut de
navigation (les distances depuis le tableau de bord sont courtes).

## Contenu

| Fichier | Persona | Angle testé |
|---|---|---|
| `SIMULATION_PERSONA_ACADEMIQUE.md` | Léa, étudiante L2, trois cours | Multi-classes, engagements datés |
| `PERSONA_PARENT_SOUTIEN.md` | Karim, parent d'un collégien | Usage pour autrui, compte unique |
| `PERSONA_RECONVERSION_AUTODIDACTE.md` | Sofia, reconversion data, 6 mois | Longue durée sans échéance externe |
| `PERSONA_CONCOURS_DATE.md` | Thomas, concours dans 4 mois | Échéance datée au centre de l'usage |
| `PERSONA_LOISIR_ADULTE.md` | Claire, théorie musicale en loisir | Hors cadre scolaire, motivation interne |

## Plans d'implémentation UI/UX

Un plan par persona (`PLAN_UI_*.md`). Les arbitrages [D] ont été rendus le
22/08/2026 par Maxime — tous favorables, dans les limites documentées aux
ADR-109 à ADR-113 — et les chantiers [S] correspondants sont implémentés sur
la branche `chantier-personas` (non fusionnée à la date d'écriture). Chaque
chantier y est marqué :

- **[S]** — implémentable sur les surfaces existantes, sans nouvelle entité ni
  donnée stockée supplémentaire ;
- **[D]** — exige une décision humaine préalable (nouvelle entité, fait daté,
  modèle de compte) : rien ne se code avant arbitrage.

| Plan | Priorité [S] | Arbitrages [D] |
|---|---|---|
| `PLAN_PERSONA_ACADEMIQUE.md` | B amorçage pluriel + corpus groupé · D1 rattachement proposé — implémentés 22/08/2026 | fait daté (A) — ADR-109 · lecture du PDF par le tuteur (C) — ADR-113, implémentés 22/08/2026 |
| `PLAN_UI_PARENT_SOUTIEN.md` | P1 lecture longitudinale filtrée — implémenté 22/08/2026 | photo (P2) — ADR-111 · profil bénéficiaire (P3) — traité par « comptes multiples conseillés », implémenté 22/08/2026 |
| `PLAN_UI_RECONVERSION.md` | R1 désambiguïsation intention · R3 fils de corpus — implémentés 22/08/2026 | ressource-lien (R2) — ADR-112, implémentée 22/08/2026 |
| `PLAN_UI_CONCOURS_DATE.md` | C0 refus explicite de la date — remplacé le 22/08/2026 par le chemin assisté du fait daté (ADR-109) · C1 mode épreuve — implémenté 22/08/2026 (ADR-110) | fait daté (C2) — ADR-109, implémenté 22/08/2026 |
| `PLAN_UI_LOISIR.md` | L1 protocole de test tuteur (pas du code) — À EXÉCUTER par usage : aucune simulation lancée, aucun résultat inventé | ancrage répertoire (L3) · ressource-lien (R2, partagé avec la reconversion) — ADR-112, implémentée 22/08/2026 |

Le plan académique (`PLAN_PERSONA_ACADEMIQUE.md`, v0.2) est le plus détaillé :
il porte les arbitrages du **fait daté** partagés avec
`PLAN_UI_CONCOURS_DATE.md` — un seul arbitrage, deux documents qui s'y
renvoient. La **ressource-lien** (R2 = reconversion + loisir) est le second
arbitrage partagé. Les deux ont été tranchés favorablement le 22/08/2026
(ADR-109 et ADR-112).

Historique : le persona académique a été déplacé ici depuis `docs/design/`
et son plan d'origine `docs/design/PLAN_PERSONA_ACADEMIQUE.md` rejoint dans
le même mouvement ; les chiffres du graphe cités ont été régénérés après le
commit `4cd3323` du 22/08/2026.

## Constats transversaux (hypothèses, pas des décisions)

Les cinq personas convergent sur trois points :

1. **La boucle apprendre fonctionne** : compositeur → bilan → recommandation,
   partout le geste le mieux huilé.
2. **Le produit ne retenait aucun fait daté** (ADR-096) : fatal pour le persona
   concours, gênant pour l'académique, indifférent pour le loisir. Question
   d'arbitrage : le produit doit-il retenir un fait daté, et sous quelle forme ?
   Arbitré OUI le 22/08/2026 : l'engagement déclaré existe désormais
   (ADR-109), sans objectif ni parcours planifié.
3. **Le compte est mono-utilisateur** : tout usage « pour quelqu'un d'autre »
   (parent, formateur) n'a nulle part où se poser sans brouiller les données.
   Traité le 22/08/2026 par l'option « comptes multiples conseillés » : zéro
   entité nouvelle, zéro politique RLS ; un guide sobre dans `/compte`
   (un compte par apprenant, bascule par connexion). Les données restent
   isolées par compte et ne se partagent jamais sans consentement explicite.

## Faits nouveaux du 22/08, postérieurs aux simulations

Inscrits au registre après l'écriture de ces dossiers ; aucun verdict n'en
change, mais ils touchent la lecture de l'Atelier citée à plusieurs endroits :

- **ADR-105** (❓ proposition) : une carte des savoirs en dépôt, rattachement
  écrit par une seule personne — rouvre ADR-099 ;
- **ADR-106** (🔄 réfutée le 22/08, module retiré du code le 23/08) : le
  découpage lexical des intitulés n'est pas le modèle retenu ;
- **ADR-107** (❓ proposition, construite le 23/08) : les domaines forment une
  hiérarchie déclarée et une compétence porte plusieurs tags de domaine ; une
  compétence sans tag reste « À classer ».

À relire lors de la prochaine régénération des simulations : la friction
« corpus plat » (S4 académique, R3 reconversion) n'est plus traitée par un
regroupement dérivé mais par un geste — créer un sous-domaine, y taguer —
assisté d'une proposition du tuteur. C'est un coût d'usage à observer, pas une
friction supprimée.
