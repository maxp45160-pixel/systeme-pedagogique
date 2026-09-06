import {beforeEach,describe,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({quota:vi.fn(),configuration:vi.fn(),reserver:vi.fn()}));
vi.mock("@/lib/store/quota-tuteur",()=>({consommerQuotaTuteur:m.quota}));
vi.mock("@/lib/store/depot-budget",()=>({configurationDepotDisponible:m.configuration,reserverCoutDepot:m.reserver}));
import {envTuteur} from "./env-requete";
const operation={operation:"analyse:tentative:ocr",pages:20,entreeOctets:0,sortieMax:0};
beforeEach(()=>{vi.resetAllMocks();m.configuration.mockReturnValue(true);});
describe("admission documentaire dédiée",()=>{
  it("réserve avant de donner l'environnement sans consommer le quota historique",async()=>{
    let autoriser!:()=>void;
    m.reserver.mockReturnValue(new Promise<void>(resolve=>{autoriser=resolve;}));
    let rendu=false;
    const admission=envTuteur(undefined,operation).then(r=>{rendu=true;return r;});
    await vi.waitFor(()=>expect(m.reserver).toHaveBeenCalledWith(operation.operation,20,0,0));
    expect(rendu).toBe(false);autoriser();expect((await admission).ok).toBe(true);
    expect(m.quota).not.toHaveBeenCalled();
  });
  it("refuse le budget insuffisant avant tout environnement fournisseur",async()=>{
    m.reserver.mockRejectedValue(new Error("Budget documentaire épuisé"));
    const r=await envTuteur(undefined,operation);expect(r.ok).toBe(false);
    if(!r.ok)expect(r.reponse.status).toBe(402);
    expect(m.quota).not.toHaveBeenCalled();
  });
  it("ne réserve rien sans configuration et n'accepte pas de clé cliente pour contourner le budget",async()=>{
    m.configuration.mockReturnValue(false);
    expect((await envTuteur(undefined,operation)).ok).toBe(false);
    expect((await envTuteur({fournisseur:"mistral",cle:"test"},operation)).ok).toBe(false);
    expect(m.reserver).not.toHaveBeenCalled();
  });
});
