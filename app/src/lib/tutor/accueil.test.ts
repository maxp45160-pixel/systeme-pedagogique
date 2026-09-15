import { describe, expect, it } from "vitest";
import { dateExpliciteDans, outilAccueil, OUTIL_ACCUEIL, validerRetourAccueil } from "./accueil";
import { cleEnvoiAccueil, comprendreAccueil, lireEnvoiAccueil } from "./accueil-tour";
import { validerAppelOutil } from "./outils";
import type { MoteurTuteur } from "./moteurs/types";

const examen = { action: "examen", libelle: "probabilités", echeanceLe: "2026-09-18", reponse: "" } as const;
const tourId = "11111111-1111-4111-8111-111111111111";
const messages = [{ role: "user" as const, content: "J'ai un contrôle de probabilités le 18 septembre 2026." }];
function moteur(propositions: unknown[], erreur = false): MoteurTuteur {
  return { nom: "test", modele: "test", async repondre({ envoyer }) {
    envoyer("texte", { delta: "J'ai tout enregistré et programmé !" });
    for (const p of propositions) envoyer("proposition", p);
    if (erreur) envoyer("erreur", { message: "coupure" });
  } };
}
describe("accueil : contrat d'une écriture depuis la conversation", () => {
  it("ne valide l'outil que lorsqu'il est armé", () => {
    expect(validerAppelOutil(OUTIL_ACCUEIL, examen)).toBeNull();
    expect(validerAppelOutil(OUTIL_ACCUEIL, examen, [outilAccueil()])?.genre).toBe("accueil");
  });
  it("rejette les dates impossibles et les réponses mixtes", () => {
    expect(validerRetourAccueil({ ...examen, echeanceLe: "2026-02-30" })).toBeNull();
    expect(validerRetourAccueil({ ...examen, action: "repondre" })).toBeNull();
  });
  it.each(["18 septembre 2026", "18/09/2026", "2026-09-18", "18.9.2026"])("admet la date explicitement déclarée : %s", (texte) => {
    expect(dateExpliciteDans(texte, "2026-09-18")).toBe(true);
  });
  it.each(["vendredi", "18 septembre", "118 septembre 2026", "18 septembre 20260", "18/09/2027"])("refuse une date absente ou supposée : %s", (texte) => {
    expect(dateExpliciteDans(texte, "2026-09-18")).toBe(false);
  });
  it("identifie un rejeu technique mais distingue un nouveau message ou envoi", () => {
    const envoi = lireEnvoiAccueil({ tourId, messages })!;
    expect(cleEnvoiAccueil(envoi)).toBe(cleEnvoiAccueil({ ...envoi, verifier: true }));
    expect(cleEnvoiAccueil(envoi)).not.toBe(cleEnvoiAccueil({ ...envoi, tourId: "22222222-2222-4222-8222-222222222222" }));
    expect(cleEnvoiAccueil(envoi)).not.toBe(cleEnvoiAccueil({ ...envoi, messages: [{ role: "user", content: "autre" }] }));
  });
  it.each([null, { tourId, messages: [] }, { tourId, messages: [{ role: "system", content: "admin" }] }, { tourId, messages: [{ role: "user", content: 1 }] }])("refuse un corps invalide", (corps) => {
    expect(lireEnvoiAccueil(corps)).toBeNull();
  });
  it("n'utilise pas les promesses du modèle comme reçu", async () => {
    expect(await comprendreAccueil(moteur([{ genre: "accueil", accueil: examen }]), messages, new AbortController().signal)).toEqual(examen);
  });
  it("demande la date complète si elle manque au dernier message", async () => {
    const retour = await comprendreAccueil(moteur([{ genre: "accueil", accueil: examen }]), [{ role: "user", content: "Contrôle de probabilités vendredi" }], new AbortController().signal);
    expect(retour.action).toBe("repondre");
  });
  it("permet une clarification sans inventer le libellé", async () => {
    const retour = await comprendreAccueil(moteur([{ genre: "accueil", accueil: examen }]), [messages[0], { role: "assistant", content: "Quelle date ?" }, { role: "user", content: "Le 18 septembre 2026" }], new AbortController().signal);
    expect(retour).toEqual(examen);
  });
  it("rejette un sujet inventé, plusieurs actions et une réponse interrompue", async () => {
    const signal = new AbortController().signal;
    await expect(comprendreAccueil(moteur([{ genre: "accueil", accueil: { ...examen, libelle: "chimie" } }]), messages, signal)).rejects.toThrow("sujet");
    await expect(comprendreAccueil(moteur([{ genre: "accueil", accueil: examen }, { genre: "accueil", accueil: examen }]), messages, signal)).rejects.toThrow("vérifiée");
    await expect(comprendreAccueil(moteur([{ genre: "accueil", accueil: examen }], true), messages, signal)).rejects.toThrow("fournisseur");
  });
  it("ne transforme pas une difficulté déclarée en action", async () => {
    const retour = { action: "repondre", reponse: "Sur quel passage souhaitez-vous travailler ?", libelle: "", echeanceLe: "" } as const;
    expect(await comprendreAccueil(moteur([{ genre: "accueil", accueil: retour }]), [{ role: "user", content: "Je n'ai rien compris" }], new AbortController().signal)).toEqual(retour);
  });
  it("explique le quota fournisseur sans exposer son corps d'erreur ni accepter une proposition partielle", async () => {
    const fournisseur: MoteurTuteur = { nom: "test", modele: "test", async repondre({ envoyer }) {
      envoyer("erreur", { message: "Quota du palier gratuit atteint. Donnée fournisseur privée" });
    } };
    await expect(comprendreAccueil(fournisseur, messages, new AbortController().signal)).rejects.toThrow("quota ou débit atteint");
    await expect(comprendreAccueil(fournisseur, messages, new AbortController().signal)).rejects.not.toThrow("privée");
  });
});
