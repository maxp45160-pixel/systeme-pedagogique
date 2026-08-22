import { describe, expect, it } from "vitest";
import { OUTIL_CARTE, outilsRattachementCarte, validerAppelOutil } from "./outils";
import { construirePromptRattachementCarte } from "./rattachement-carte";
import { enumNoeudsCarte, RACINE_CARTE } from "@/lib/domain/carte-savoirs";

/*
 * Ce que ce fichier protège : le tuteur ne peut désigner qu'une région de
 * l'énumération fournie par le serveur. Ni un nœud invente, ni la racine, ni
 * un identifiant venu d'un autre référentiel.
 */

const OUTILS = [outilsRattachementCarte(enumNoeudsCarte())];

const valider = (entree: unknown) => validerAppelOutil(OUTIL_CARTE, entree, OUTILS);

describe("garde-fou de l'outil carte", () => {
  it("accepte une région de l'énumération, avec sa justification", () => {
    const recue = valider({
      noeud: "mathematiques",
      justification: "Les compétences portent sur des démonstrations et des équations.",
    });

    expect(recue).toEqual({
      genre: "carte",
      carte: {
        noeud: "mathematiques",
        justification: "Les compétences portent sur des démonstrations et des équations.",
      },
    });
  });

  it("rejette un nœud absent de la carte, même bien formé", () => {
    expect(
      valider({ noeud: "sciences-occultes", justification: "Ça me semble juste." }),
    ).toBeNull();
  });

  it("rejette la racine : rattacher à « Savoirs humains » ne situe nulle part", () => {
    expect(valider({ noeud: RACINE_CARTE, justification: "C'est un savoir humain." })).toBeNull();
  });

  it("rejette une proposition sans justification — elle ne s'arbitre pas", () => {
    expect(valider({ noeud: "mathematiques" })).toBeNull();
    expect(valider({ noeud: "mathematiques", justification: "   " })).toBeNull();
  });

  it("n'arme jamais la racine dans le schéma envoyé au fournisseur", () => {
    const enumeration = OUTILS[0].schema.properties?.noeud?.enum ?? [];
    expect(enumeration).not.toContain(RACINE_CARTE);
    expect(enumeration).toContain("mathematiques");
  });
});

describe("prompt de rattachement", () => {
  const prompt = construirePromptRattachementCarte({
    domaineId: "logistique",
    nom: "Logistique industrielle",
    description: "Flux, stocks et transport",
    intitules: ["Dimensionner un stock de sécurité"],
  });

  it("énumère la carte avec des chemins lisibles", () => {
    expect(prompt).toContain("mathematiques — Savoirs humains › Créations humaines › Mathématiques");
  });

  it("dit au tuteur qu'il n'applique rien", () => {
    expect(prompt).toContain("TU N'APPLIQUES RIEN.");
  });

  it("ne transmet aucune observation, aucun niveau, aucune date", () => {
    /*
     * Le tuteur situe un sujet ; il n'a pas à lire un parcours. Ce test tient
     * lieu de garde : un ajout de contexte devra le casser pour passer.
     */
    expect(prompt).not.toMatch(/niveau|observation|palier|confiance/i);
  });
});
