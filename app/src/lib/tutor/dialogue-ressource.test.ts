import { expect, it } from "vitest";
import { comprendreRessource, outilDialogueRessource, validerChoixRessource, OUTIL_RESSOURCE } from "./dialogue-ressource";
import { validerAppelOutil } from "./outils";
import type { MoteurTuteur } from "./moteurs/types";
const contexte = { titre: "Fiche", type: "cours", codes: [], domaines: [], competences: [{ code: "MAT-01", intitule: "Calculer" }], propositions: [{ index: "0", intitule: "Expliquer", domaine: "Maths" }] };
const reponse = { action: "repondre", reponse: "Quel domaine ?", champ: "", valeur: "", codes: [], propositions: [], usage: "", annee: "", citationUsage: "" };
it("l'outil est confiné à son chemin et ses codes viennent du contexte serveur", () => {
  expect(validerAppelOutil(OUTIL_RESSOURCE, reponse, [])).toBeNull();
  const outil = outilDialogueRessource(contexte);
  expect(outil.schema.properties?.codes.items?.enum).toEqual(["MAT-01"]);
  expect(validerAppelOutil(OUTIL_RESSOURCE, reponse, [outil])).toMatchObject({ genre: "ressource" });
});
it("une clarification ne peut transporter en secret des créations", () => {
  expect(validerChoixRessource({ ...reponse, propositions: ["0"] })).toBeNull();
  expect(validerChoixRessource({ ...reponse, action: "creer", propositions: ["faux"] })).toBeNull();
});
it("un flux ambigu ou interrompu n'est pas une commande exploitable", async () => {
  const moteur = { repondre: async ({ envoyer }: Parameters<MoteurTuteur["repondre"]>[0]) => { envoyer("proposition", { genre: "ressource", ressource: reponse }); envoyer("erreur", {}); } } as MoteurTuteur;
  await expect(comprendreRessource(moteur, [{ role: "user", content: "Une question" }], contexte, new AbortController().signal)).rejects.toThrow("vérifiée");
});

it("une déclaration ne transporte aucun effet de classement ou de création", () => {
  const declaration = { ...reponse, action: "declarer", champ: "contexte", valeur: "Ce cours prépare mon examen." };
  expect(validerChoixRessource(declaration)).toEqual(declaration);
  for (const extras of [{ codes: ["MAT-01"] }, { propositions: ["0"] }, { usage: "module" }, { champ: "titre" }, { valeur: " " }]) {
    expect(validerChoixRessource({ ...declaration, ...extras })).toBeNull();
  }
  expect(outilDialogueRessource(contexte).schema.properties?.action.enum).not.toContain("creer");
});

it("le dialogue reçoit les seules déclarations et messages explicitement fournis", async () => {
  let requete: Parameters<MoteurTuteur["repondre"]>[0] | undefined;
  const moteur = { repondre: async (args: Parameters<MoteurTuteur["repondre"]>[0]) => { requete = args; args.envoyer("proposition", { genre: "ressource", ressource: reponse }); } } as MoteurTuteur;
  const messages = [{ role: "user" as const, content: "Voici l’extrait que je souhaite partager." }];
  const personnel = { contexte: { texte: "Cours personnel", declareLe: "2026-09-19T00:00:00.000Z" } };
  await comprendreRessource(moteur, messages, { ...contexte, personnel }, new AbortController().signal);
  expect(requete?.messages).toEqual(messages);
  expect(JSON.parse(requete!.systemeProfil!)).toEqual({ ...contexte, personnel });
  expect(requete?.systemeStable).toContain("après relecture");
  expect(requete?.systemeStable).toContain("Ne redemande pas");
});
