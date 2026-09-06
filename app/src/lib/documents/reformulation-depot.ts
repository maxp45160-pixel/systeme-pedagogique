import { objetDepot } from "./depot-validation";

/** Markdown éditable ailleurs : le formulaire refuse une copie cachée devenue obsolète. */
export function corpsReformulationDepot(compris: string, flou: string): string {
  const json = Buffer.from(JSON.stringify({compris,flou}),"utf8").toString("base64");
  return `# Reformulation\n\n## Ce que j'ai compris\n\n${compris}\n\n## Ce qui reste flou\n\n${flou}\n\n<!-- twiny-reformulation:${json} -->\n`;
}

export function relireCorpsReformulationDepot(markdown: string): {compris:string;flou:string} {
  const corps = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").replace(/\r\n/g,"\n");
  const json = corps.match(/<!-- twiny-reformulation:([A-Za-z0-9+/=]+) -->\n?$/);
  const erreur = "La production a été modifiée ailleurs ; consultez-la dans Mes cours avant de la remplacer.";
  if (!json) throw new Error(erreur);
  const contenu = objetDepot(JSON.parse(Buffer.from(json[1],"base64").toString("utf8")));
  if (typeof contenu.compris!=="string" || typeof contenu.flou!=="string") throw new Error(erreur);
  if (corps!==corpsReformulationDepot(contenu.compris,contenu.flou).replace(/\r\n/g,"\n")) throw new Error(erreur);
  return {compris:contenu.compris,flou:contenu.flou};
}
