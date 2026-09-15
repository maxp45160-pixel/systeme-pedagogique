import { budgetQwen } from "@/lib/store/qwen-budget";
export async function GET() {
  try { return Response.json(await budgetQwen(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ message: "Budget Qwen indisponible sur ce compte." }, { status: 403 }); }
}
