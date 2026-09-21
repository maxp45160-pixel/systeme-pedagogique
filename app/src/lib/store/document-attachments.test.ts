import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ compte:vi.fn(), signe:vi.fn(), liste:vi.fn(), insere:vi.fn() }));
vi.mock("./db", () => ({ dorsaleCompte:m.compte }));
vi.mock("./supabase-backend", () => ({ verifier:(_message:string, erreur:unknown) => { if (erreur) throw erreur; } }));
vi.mock("next/cache", () => ({ revalidatePath:vi.fn() }));
import { preparerTeleversementPiece, enregistrerPieceJointe } from "./document-attachments";
const nomObjet = "12345678-1234-1234-1234-123456789abc.epub";
const chemin = `compte/doc/${nomObjet}`;
beforeEach(() => {
  vi.resetAllMocks();
  m.signe.mockResolvedValue({data:{token:"token"},error:null});
  m.liste.mockResolvedValue({data:[{name:nomObjet,metadata:{mimetype:"application/epub+zip",size:123}}],error:null});
  m.insere.mockImplementation((valeur) => ({select:() => ({single:async() => ({data:{id:"piece",created_at:"2026-09-19",...valeur},error:null})})}));
  const note = { select:() => ({eq:() => ({eq:() => ({maybeSingle:async() => ({data:{frontmatter:{role:"support"}},error:null})})})}) };
  m.compte.mockResolvedValue({userId:"compte",supabase:{from:(table:string) => table === "documents" ? note : {insert:m.insere},storage:{from:() => ({createSignedUploadUrl:m.signe,list:m.liste})}}});
});
describe("pièce jointe EPUB privée", () => {
  it("prépare un chemin .epub du compte puis conserve le type exact", async () => {
    const preparation = await preparerTeleversementPiece("doc","Livre.epub","application/epub+zip");
    expect(preparation.chemin).toMatch(/^compte\/doc\/[0-9a-f-]+\.epub$/);
    const piece = await enregistrerPieceJointe("doc",chemin,"Livre.epub",123,"application/epub+zip");
    expect(piece).toMatchObject({mimeType:"application/epub+zip",nom:"Livre.epub",tailleOctets:123});
    expect(m.insere).toHaveBeenCalledWith(expect.objectContaining({user_id:"compte",document_id:"doc",storage_path:chemin}));
  });
  it("refuse un chemin d'autre compte et un MIME réel divergent avant inscription", async () => {
    await expect(enregistrerPieceJointe("doc",`autre/doc/${nomObjet}`,"Livre.epub",123,"application/epub+zip")).rejects.toThrow(/Chemin/);
    m.liste.mockResolvedValue({data:[{name:nomObjet,metadata:{mimetype:"application/pdf",size:123}}],error:null});
    await expect(enregistrerPieceJointe("doc",chemin,"Livre.epub",123,"application/epub+zip")).rejects.toThrow(/type déclaré/);
    expect(m.insere).not.toHaveBeenCalled();
  });
  it("refuse une extension incohérente avant préparer le transfert", async () => {
    await expect(preparerTeleversementPiece("doc","Livre.pdf","application/epub+zip")).rejects.toThrow(/extension/i);
    expect(m.signe).not.toHaveBeenCalled();
  });
});
