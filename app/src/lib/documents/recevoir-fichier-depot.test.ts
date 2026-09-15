import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ creer: vi.fn(), preparer: vi.fn(), enregistrer: vi.fn(), client: vi.fn(), upload: vi.fn() }));
vi.mock("@/lib/store/depot-actions", () => ({ creerRessourceDepotAction: m.creer }));
vi.mock("@/lib/store/document-actions", () => ({ preparerTeleversementPieceAction: m.preparer, enregistrerPieceJointeAction: m.enregistrer }));
vi.mock("@/lib/supabase/client", () => ({ createNavigateurClient: m.client }));
import { recevoirFichierDepot, type ReceptionFichierDepot } from "./recevoir-fichier-depot";
const entree = (): ReceptionFichierDepot => ({ fichier: new File(["test"], "cours.pdf", { type: "application/pdf" }), relatif: "Semestre/cours.pdf", etat: "attente" });

describe("réception V2 commune au dépôt et à la conversation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.creer.mockResolvedValue("doc-1"); m.preparer.mockResolvedValue({ chemin: "compte/doc-1/pdf", token: "test" });
    m.client.mockReturnValue({ storage: { from: () => ({ uploadToSignedUrl: m.upload }) } });
    m.upload.mockResolvedValue({ error: null }); m.enregistrer.mockResolvedValue(undefined);
  });
  it("ne déclare conservé qu'après transfert et rattachement", async () => {
    const f = entree();
    expect(await recevoirFichierDepot(f)).toBe("doc-1");
    expect(f.etat).toBe("recu");
    expect(m.creer.mock.invocationCallOrder[0]).toBeLessThan(m.upload.mock.invocationCallOrder[0]);
    expect(m.upload.mock.invocationCallOrder[0]).toBeLessThan(m.enregistrer.mock.invocationCallOrder[0]);
    expect(m.enregistrer).toHaveBeenCalledWith("doc-1", "compte/doc-1/pdf", "Semestre · cours.pdf", 4, "application/pdf");
  });
  it("reprend le rattachement sans recréer ni retransférer l'original", async () => {
    const f = entree(); m.enregistrer.mockRejectedValueOnce(new Error("réseau"));
    await expect(recevoirFichierDepot(f)).rejects.toThrow("réseau");
    expect(f.etat).not.toBe("recu"); expect(f.envoye).toBe(true);
    await recevoirFichierDepot(f);
    expect(m.creer).toHaveBeenCalledTimes(1); expect(m.upload).toHaveBeenCalledTimes(1); expect(m.enregistrer).toHaveBeenCalledTimes(2);
  });
  it("préserve l'identité après un transfert échoué", async () => {
    const f = entree(); m.upload.mockResolvedValueOnce({ error: new Error("réseau") });
    await expect(recevoirFichierDepot(f)).rejects.toThrow("transfert");
    const cle = f.cle;
    expect(m.enregistrer).not.toHaveBeenCalled();
    await recevoirFichierDepot(f);
    expect(f.cle).toBe(cle); expect(m.creer).toHaveBeenCalledTimes(1);
  });
  it("ne rejoue aucune étape d'un fichier reçu", async () => {
    const f = entree(); await recevoirFichierDepot(f); await recevoirFichierDepot(f);
    expect(m.enregistrer).toHaveBeenCalledTimes(1);
  });
  it("refuse les formats invalides et le stockage indisponible avant création", async () => {
    await expect(recevoirFichierDepot({ ...entree(), fichier: new File(["x"], "code.exe") })).rejects.toThrow("Format");
    m.client.mockReturnValue(null);
    await expect(recevoirFichierDepot(entree())).rejects.toThrow("stockage");
    expect(m.creer).not.toHaveBeenCalled();
  });
});
