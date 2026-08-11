# archive/ — documents datés, conservés pour l'historique

Ces documents décrivent le système **tel qu'il était à leur date**. Ils ne font
plus autorité et ne doivent pas servir de base à une décision.

**Ne jamais y lire un chiffre d'usage.** L'usage réel se lit dans Supabase
(serveur MCP configuré dans `.mcp.json`). C'est précisément l'erreur commise le
27/07/2026 : une analyse fondée sur le journal local figé annonçait 11 preuves
alors que la production en comptait 15.

| Document | Date | Pourquoi il est ici |
|---|---|---|
| `SETUP_COMPTES_SUPABASE.md` | 28/07/2026 | Procédure d'exploitation, encore utile — pas une analyse |
| `synthese_profil_competences_2026-07-25.md` | 25/07/2026 | Source des préférences pédagogiques et des 4 compétences ajoutées le 25/07. C'est une **donnée déclarée**, non dérivable : elle ne se recalcule pas |

## Supprimé le 11/08/2026

Cinq documents ont été retirés : leur contenu est intégralement couvert par les
documents qui font autorité, et les garder revenait à entretenir deux versions
d'un même fait. Récupérables dans l'historique git.

| Document supprimé | Ce qui le couvre |
|---|---|
| `ETAT_DES_LIEUX_2026-07-27.md` | Chiffres d'usage déjà déclarés faux ; analyse absorbée par le chantier du 28/07 |
| `AUDIT_SYSTEME_2026-07-25.md` | Instantané antérieur à l'ouverture des comptes |
| `MESURE_MOTEUR_TUTEUR_2026-07-27.md` | ADR-007 |
| `SPEC_CHANTIER1_BOUCLE_PREUVES_2026-07-25_FAIT.md` | Chantier terminé, décisions en ADR |
| `SPEC_MAJ_PROFIL_2026-07-25_FAIT.md` | Chantier terminé, décisions en ADR |

Les documents qui font autorité sont à la racine : `CLAUDE.md`, `PRODUCT.md`,
`PRODUCT_SPECIFICATION_MAP.md`, `ARCHITECTURE_DECISIONS.md`.
