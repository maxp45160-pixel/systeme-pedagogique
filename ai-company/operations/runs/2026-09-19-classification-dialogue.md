# Classification et dialogue — 19/09/2026

## Mandat humain

Dans le CODIR, Maxime demande le traitement des PDF, EPUB, images, notes manuscrites et formulations libres : sujet précis, domaine, compétences mentionnées, rattachement et classement hiérarchique du nouveau domaine. Les prérequis sont facultatifs. Le dialogue doit clarifier le contenu puis son rôle dans la vie et le travail de la personne.

À la proposition de compter séparément moins de 5 % de compétences incorrectes/injustifiées et moins de 5 % de compétences attendues oubliées, Maxime répond : « oui, si tout est clair vous pouvez commencer à implémenter tout ça ! ».

Cet accord autorise réalisation et tests. Il ne prouve aucune qualité déjà atteinte. Aucun appel fournisseur payant, dépendance nouvelle, publication ou déploiement n'est exécuté sans son accord applicable.

## Base et plan

Base master 536340d ; diff préexistant P01-0010 et archives P01-0009 préservés. Coordinateur : tâche 01a0b679-7255-7cc0-b202-cebf024db4e6. CTO : formats ; QA : évaluateur offline ; Product : contrat et dialogue ; coordinateur : intégration, interface et documentation. Aucun statut humain promu.

1. Raccorder les formats et leurs limites au dépôt, devis, extraction et sources.
2. Étendre les propositions de classement et le dialogue ciblé avec des déclarations sourcées, sans corpus permanent.
3. Brancher le dialogue à la fenêtre de ressources et conserver le contexte sans nouvel objet métier.
4. Tester erreurs, reprise, isolation et évaluation ; mesurer séparément la qualité réelle lorsque références humaines et essai autorisé seront disponibles.

## État

Implémentation locale, sans déploiement ni appel fournisseur payant. Maxime a ensuite répondu « Oui, ajouter les deux bibliothèques » : `fflate@0.8.3` et `fast-xml-parser@5.11.1` installés sans scripts d'installation.

### Réalisation

- EPUB textuel : container/OPF/spine, texte XHTML et références de sections, original conservé, cache lié aux octets, aucune facturation OCR EPUB. Archives tronquées, chemins sortants, entrées dupliquées, chiffrement, entités XML et volumes excessifs refusés. Images/MathML/médias non analysés explicitement signalés. Les vues documentaires proposent l'original sans traiter l'EPUB comme une image.
- Sujet et compétences sourcés ; parent proposé exclusivement parmi les domaines actifs, soumis à contrôle. Un parent écarté par la personne ne revient pas au changement d'analyse.
- Dialogue « En discuter » : extraits préparés et relus avant envoi ; fils distincts par compte et ressource. Contexte et intention sont des déclarations exactes et datées, avec contrôle de version/reprise, sans mesure ni plan stocké. La création de compétences passe par le classement canonique. Le dépôt en cours bloque la bascule de discussion pour préserver son reçu.
- « Organiser ce texte » ouvre explicitement le consentement documentaire, sans transformer toute conversation en ressource. Il fonctionne indépendamment de la clé du chat.
- Lecture suivante explicite : devis, fournisseur et unités précis ; revue du classement courant avant poursuite, historique conservé. Les compétences confirmées s'accumulent jusqu'à 1 000 liens ; la sortie d'une analyse reste bornée à 30 propositions.
- Évaluateur offline : erreurs et omissions séparées, formats/fonctions séparés, verdict UNKNOWN si référence humaine, couverture ou jugement manquent. `node app/scripts/evaluer-classification.mjs --exemple | node app/scripts/evaluer-classification.mjs -` montre un gabarit sans validation artificielle.

### Vérifications et portée

Tests ciblés : sécurité et orchestration EPUB, cache, coûts Mistral/Qwen, 22 sections sur plusieurs lectures, hiérarchie corrigée, dialogue/reprise/version, évaluateur et continuation. Revue indépendante QA : course dépôt vers autre fil identifiée puis corrigée par verrou parent synchrone. La revue EPUB indépendante a aussi reproduit le blocage de texte après vingt sections sans texte et la fusion de mots autour d'un séparateur XHTML : corrigés, avec sections non analysées explicitement visibles, jamais assimilées à des pages lues. Les résultats finaux TypeScript/lint/tests/build et leurs empreintes figurent dans la fiche P01-0011.

Navigateur local : composant ChatInput réel dans un harnais temporaire, retiré après contrôle. Bascule message → ressource → message, consentement fournisseur/coût visible, saisie conservée ; dépôt accessible même sans clé chat. Aucun envoi ni écriture utilisateur. Le parcours authentifié complet avec fournisseur n'a pas été exercé.

### Limites et activation

Le jalon qualité n'est PAS déclaré atteint : aucun corpus réel annoté ni taux fournisseur mesuré. La couverture technique d'une tranche ne démontre pas l'exhaustivité des compétences ; plus de 30 compétences dans une tranche peuvent nécessiter une évolution de pagination sémantique. L'historique des analyses n'est pas une synthèse cumulative exhaustive. Les prérequis restent facultatifs.

EPUB UTF-8/XHTML uniquement ; original 10 Mio, 2 000 entrées, XML 1 Mo/entrée et 8 Mo au total, texte 50 000 octets/section et tranche, 20 unités/analyse. Les images et les formules non textuelles de l'EPUB restent à relire dans l'original. Les PDF/images/manuscrits utilisent le pipeline OCR existant, sans nouvelle preuve de qualité manuscrite.

Supabase réel relu : contrainte `document_attachments_mime_type_check` et bucket privé `document-support` limités aux quatre anciens formats et 10 Mio. Migration `20260918221339_autoriser_epub_documentaire.sql` préparée, NON APPLIQUÉE ; elle ajoute uniquement `application/epub+zip` aux deux listes MIME, sans modifier RLS, partage ou taille. Une activation distante et un déploiement restent distincts de cette livraison locale.
