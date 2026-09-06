import { lireSourceDepot } from "@/lib/store/depot-documents";
import { texteDepot } from "@/lib/documents/depot-validation";
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const source = await lireSourceDepot(texteDepot(params.get("documentId"),120),texteDepot(params.get("pieceId"),100));
    return new Response(source.octets.slice().buffer as ArrayBuffer, { headers:{"Content-Type":source.mimeType,"Content-Disposition":"inline","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"} });
  } catch { return Response.json({message:"Fichier source inaccessible."},{status:404}); }
}
