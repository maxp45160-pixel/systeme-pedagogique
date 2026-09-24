import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ appel: vi.fn() }));
vi.mock("./qwen-appel", () => ({ appelerQwen: m.appel }));
import { lireOcrQwen, restituerQwen } from "./depot-qwen";

function petitPdf() {
  const objets = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> /Contents 4 0 R >>", "<< /Length 0 >>\nstream\n\nendstream"];
  let texte = "%PDF-1.4\n"; const offsets = [0];
  objets.forEach((objet, i) => { offsets.push(Buffer.byteLength(texte)); texte += `${i+1} 0 obj\n${objet}\nendobj\n`; });
  const xref = Buffer.byteLength(texte);
  texte += `xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10,"0")} 00000 n \n`).join("")}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Uint8Array(Buffer.from(texte));
}
const config = { fournisseur: "qwen" as const, cle: "sk-test-factice" };
const tranche = { pieceId: "p", nom: "test.pdf", pages: [1], totalPages: 1 };
it("refuse un catalogue trop volumineux avant tout appel Qwen",async()=>{
  await expect(restituerQwen("x\n".repeat(3000),[],config)).rejects.toThrow("trop denses");
  expect(m.appel).not.toHaveBeenCalled();
});
it("refuse une citation ajoutée au passage sélectionné sans réessai",async()=>{
  m.appel.mockResolvedValue({choices:[{message:{content:JSON.stringify({elements:[{sources:[{passageId:"passage-0",citation:"Note"}]}]})}}]});
  await expect(restituerQwen("Note",[],config)).rejects.toThrow("uniquement passageId");
  expect(m.appel).toHaveBeenCalledTimes(1);
});
it.each([undefined,{domaines:[{id:"maths",nom:"Mathématiques",description:"Calcul"}],competences:[]}])("traduit les identifiants de la réponse Qwen en repères persistables", async (referentiel) => {
  m.appel.mockImplementation(async (_config, corps) => {
    const entree=JSON.parse(corps.messages[1].content);
    const sources=[{passageId:entree.sources[1].passages[0].passageId}];
    return {choices:[{message:{content:JSON.stringify({elements:[{nature:"sujet",texte:"Équations",sources}],...(referentiel?{organisation:{titreSuggere:"Équations",typeSuggere:"cours",justification:"Calcul demandé",sources,domaine:{mode:"existant",id:"maths",justification:"Calcul demandé",sources},competences:[{ancrage:{nature:"consigne",passageId:sources[0].passageId,attendu:"Résoudre une équation pour trouver sa solution."},mode:"nouvelle",verbeAction:"résoudre",objet:"une équation",precision:null,palier:"fondamentaux",importance:0.5,domaine:{mode:"existant",id:"maths"},justification:"Résolution demandée",sources}]}}:{})})}}]};
  });
  const resultat=await restituerQwen("Note",[{pieceId:"ats",page:7,texte:"Fiche 6 : Résoudre une équation",incertain:false}],config,referentiel);
  const sources=[{pieceId:"ats",page:7,citation:"Fiche 6 : Résoudre une équation"}];
  expect(resultat).toMatchObject({elements:[{sources}],...(referentiel?{organisation:{sources,domaine:{id:"maths",sources},competences:[{sources}]}}:{})});
  expect(JSON.stringify(resultat)).not.toContain("passageId");
  expect(JSON.stringify(resultat)).not.toContain('"ancrage"');
  expect(m.appel).toHaveBeenCalledTimes(1);
});
beforeEach(() => { vi.resetAllMocks(); m.appel.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ texte: "Texte simulé par le test" }) } }] }); });
it("rend une vraie page PDF en image avant Qwen et conserve son numéro", async () => {
  const pages = await lireOcrQwen(tranche, { octets: petitPdf(), mimeType: "application/pdf" }, config);
  const corps = m.appel.mock.calls[0][1];
  expect(corps.messages[1].content[0].image_url.url).toMatch(/^data:image\/png;base64,/);
  expect(pages[0]).toMatchObject({ pieceId: "p", page: 1, incertain: true });
});
it("une transcription absente échoue sans fabriquer de texte", async () => {
  m.appel.mockResolvedValue({ choices: [{ message: { content: '{"texte":""}' } }] });
  await expect(lireOcrQwen(tranche, { octets: new Uint8Array([1]), mimeType: "image/png" }, config)).rejects.toThrow("vide");
});
it("un arrêt empêche l'envoi de la page suivante", async () => {
  const controle = new AbortController();
  const conserver = vi.fn().mockResolvedValue(undefined);
  m.appel.mockImplementationOnce(async () => { controle.abort(); return { choices: [{ message: { content: '{"texte":"page"}' } }] }; });
  await expect(lireOcrQwen({ ...tranche, pages: [1,2] }, { octets: new Uint8Array([1]), mimeType: "image/png" }, config, controle.signal, conserver)).rejects.toThrow();
  expect(m.appel).toHaveBeenCalledTimes(1);
  expect(conserver).toHaveBeenCalledWith([expect.objectContaining({ page: 1, texte: "page" })]);
});
it.each([undefined,{domaines:[],competences:[]}])("aligne la restitution Qwen et sa réservation sur la limite du corps", async (referentiel) => {
  const contenu={elements:[],...(referentiel ? {organisation:{titreSuggere:"Note",typeSuggere:"cours",domaine:null,competences:[],justification:"Sujet déclaré",sources:[{passageId:"passage-0"}]}} : {})};
  m.appel.mockResolvedValue({choices:[{message:{content:JSON.stringify(contenu)}}]});
  await expect(restituerQwen("Note",[],config,referentiel)).resolves.toMatchObject({elements:[],...(referentiel ? {organisation:{competences:[]}} : {})});
  const [,corps,,sortieMax]=m.appel.mock.calls[0];
  expect(corps.max_tokens).toBe(referentiel ? 8192 : 2500);
  expect(corps.response_format).toEqual({type:"json_object"});
  expect(sortieMax).toBe(corps.max_tokens);
  expect(m.appel).toHaveBeenCalledTimes(1);
});
