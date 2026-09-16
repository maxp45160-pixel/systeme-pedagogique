import type { ConfigTuteurClient } from "@/lib/tutor/cle-client";
import { analyserDepot, preparerAnalyseDepot } from "@/lib/store/depot-analyse";
import { objetDepot, texteDepot, entierDepot } from "@/lib/documents/depot-validation";

export const maxDuration = 300;
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    return Response.json(await preparerAnalyseDepot(texteDepot(query.get("documentId"),120),entierDepot(Number(query.get("maximum") ?? 20)),query.get("fournisseur")==="qwen",query.has("syntheseDe") ? texteDepot(query.get("syntheseDe"),120) : undefined), { headers:{"Cache-Control":"no-store"} });
  } catch (e) { return Response.json({message:e instanceof Error ? e.message : "Préparation indisponible."},{status:400}); }
}
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({message:"Origine de la demande invalide."},{status:403});
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Demande absente.");
    const morceaux: Uint8Array[] = [];
    let taille = 0;
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      taille += value.byteLength;
      if (taille>16000) { await reader.cancel(); throw new Error("Demande trop volumineuse."); }
      morceaux.push(value);
    }
    const body = objetDepot(JSON.parse(Buffer.concat(morceaux).toString("utf8")));
    if (body.consentement !== true) return Response.json({message:"L'analyse externe doit être demandée explicitement."},{status:400});
    if (body.organiser === true) return Response.json({message:"Le classement demande maintenant une confirmation après l'analyse. Actualisez l'assistant."},{status:400});
    const depot = await analyserDepot(texteDepot(body.documentId,120),texteDepot(body.empreinte,64),entierDepot(body.maximum ?? 20),body.reprise===true,request.signal,body.config as ConfigTuteurClient | undefined,body.syntheseDe !== undefined ? texteDepot(body.syntheseDe,120) : undefined);
    return Response.json(depot,{headers:{"Cache-Control":"no-store"}});
  } catch (e) { return Response.json({message:e instanceof Error ? e.message : "Analyse indisponible."},{status:400}); }
}
