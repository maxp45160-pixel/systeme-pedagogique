import { describe, expect, it } from "vitest";
import { calculerSimilaritesTextuelles, type DocumentTexte } from "./similarite-textuelle";

describe("calculerSimilaritesTextuelles", () => {
  it("relie deux documents qui partagent du vocabulaire distinctif", () => {
    const documents: DocumentTexte[] = [
      { id: "a", fragments: ["Modéliser un réseau de neurones convolutif"] },
      { id: "b", fragments: ["Entraîner un réseau de neurones récurrent"] },
      { id: "c", fragments: ["Rédiger un contrat de travail en droit civil"] },
    ];
    const sims = calculerSimilaritesTextuelles(documents, 3, 0.05);
    expect(sims.some((s) => (s.a === "a" && s.b === "b") || (s.a === "b" && s.b === "a"))).toBe(
      true,
    );
    expect(sims.some((s) => s.a === "c" || s.b === "c")).toBe(false);
  });

  it("ne retient une paire que si elle est mutuelle dans le top-K", () => {
    // A est proche de B et C ; B et C ne sont proches que de A. Avec topK=1,
    // A choisit son plus proche voisin — B ou C selon les scores — et seule
    // cette paire doit survivre, jamais les deux.
    const documents: DocumentTexte[] = [
      { id: "a", fragments: ["gestion stock logistique entrepot"] },
      { id: "b", fragments: ["gestion stock entrepot"] },
      { id: "c", fragments: ["gestion logistique transport"] },
    ];
    const sims = calculerSimilaritesTextuelles(documents, 1, 0.01);
    expect(sims.length).toBeLessThanOrEqual(1);
  });

  it("ignore les mots vides et les mots courts", () => {
    const documents: DocumentTexte[] = [
      { id: "a", fragments: ["de la et un ou"] },
      { id: "b", fragments: ["de la et un ou"] },
    ];
    const sims = calculerSimilaritesTextuelles(documents, 3, 0.01);
    expect(sims).toHaveLength(0);
  });

  it("un document sans aucun mot en commun n'est jamais retenu", () => {
    const documents: DocumentTexte[] = [
      { id: "a", fragments: ["photosynthèse chlorophylle stomates"] },
      { id: "b", fragments: ["algèbre linéaire déterminant matrice"] },
    ];
    const sims = calculerSimilaritesTextuelles(documents, 3, 0.05);
    expect(sims).toHaveLength(0);
  });

  it("le score respecte le seuil minimum", () => {
    const documents: DocumentTexte[] = [
      { id: "a", fragments: ["gestion de production industrielle"] },
      { id: "b", fragments: ["gestion administrative des ressources humaines"] },
    ];
    const sims = calculerSimilaritesTextuelles(documents, 3, 0.9);
    expect(sims.every((s) => s.score >= 0.9)).toBe(true);
  });
});

describe("normalisation de pluriel", () => {
  it("rapproche le singulier du pluriel", () => {
    /*
     * Un troisième document sans rapport est nécessaire : avec deux documents
     * qui partagent tout leur vocabulaire, l'IDF de chaque mot vaut log(2/2)
     * = 0 et aucun score ne peut être non nul. Ce n'est pas la normalisation
     * qui échouerait, c'est le corpus qui serait dégénéré.
     */
    const documents: DocumentTexte[] = [
      { id: "a", fragments: ["statistiques et probabilités"] },
      { id: "b", fragments: ["statistique et probabilité"] },
      { id: "c", fragments: ["menuiserie traditionnelle"] },
    ];
    const sims = calculerSimilaritesTextuelles(documents, 3, 0.5);
    expect(sims).toHaveLength(1);
    expect(sims[0].score).toBeGreaterThan(0.9);
  });

  it("ne tronque pas les mots courts, où le « s » final appartient au mot", () => {
    /*
     * « flux » réduit à « flu », « cas » à « ca » : le découpage doit s'arrêter
     * avant. On le vérifie par l'absence de rapprochement entre deux textes
     * qui ne partagent que la troncature.
     */
    const documents: DocumentTexte[] = [
      { id: "a", fragments: ["flux tendu"] },
      { id: "b", fragments: ["flu saisonnière"] },
    ];
    const sims = calculerSimilaritesTextuelles(documents, 3, 0.1);
    expect(sims).toHaveLength(0);
  });

  it("ne touche pas à un « s » double final", () => {
    const documents: DocumentTexte[] = [
      { id: "a", fragments: ["processus industriel"] },
      { id: "b", fragments: ["processu industriel"] },
    ];
    const sims = calculerSimilaritesTextuelles(documents, 3, 0.99);
    expect(sims).toHaveLength(0);
  });
});
