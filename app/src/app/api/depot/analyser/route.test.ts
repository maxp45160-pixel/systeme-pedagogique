import {beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({analyse:vi.fn(),preparer:vi.fn()}));
vi.mock("@/lib/store/depot-analyse",()=>({analyserDepot:mocks.analyse,preparerAnalyseDepot:mocks.preparer}));
import {POST,GET} from "./route";
beforeEach(()=>vi.clearAllMocks());
const request=(body:unknown,origin="https://twiny.test")=>new Request("https://twiny.test/api/depot/analyser",{method:"POST",headers:{origin,"Content-Type":"application/json"},body:JSON.stringify(body)});
describe("consentement documentaire",()=>{
  it("refuse origine externe et absence de consentement",async()=>{
    expect((await POST(request({consentement:true},"https://autre.test"))).status).toBe(403);
    expect((await POST(request({documentId:"doc"}))).status).toBe(400);
    expect(mocks.analyse).not.toHaveBeenCalled();
  });
  it("une consultation prépare seulement et ne lance pas l'IA",async()=>{
    mocks.preparer.mockResolvedValue({disponible:true});
    expect((await GET(new Request("https://twiny.test/api/depot/analyser?documentId=doc"))).status).toBe(200);
    expect(mocks.analyse).not.toHaveBeenCalled();
  });
  it("transmet le consentement explicite, l'empreinte et la reprise au serveur",async()=>{
    mocks.analyse.mockResolvedValue({id:"doc"});
    const r=await POST(request({documentId:"doc",empreinte:"a".repeat(64),consentement:true,maximum:5,reprise:true}));
    expect(r.status).toBe(200);expect(mocks.analyse.mock.calls[0].slice(0,4)).toEqual(["doc","a".repeat(64),5,true]);
  });
});
