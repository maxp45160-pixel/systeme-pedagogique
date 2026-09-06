import { erreurFichierPiece, mimeDepuisNomFichier } from "./pieces-jointes";
import { MAX_FICHIERS_DEPOT, MAX_OCTETS_DEPOT } from "./depot";

export interface FichierImport { fichier: File; relatif: string }
export const identiteImport = (f: FichierImport) => `${f.relatif}:${f.fichier.size}:${f.fichier.lastModified}`;

/** Ajouts cumulatifs ; un refus ne retire jamais une sélection précédente. */
export function fusionnerImports(existants: FichierImport[], ajouts: FichierImport[], nombreRecu = 0, octetsRecus = 0) {
  const fichiers = [...existants];
  const connus = new Set(existants.map(identiteImport));
  const refuses: string[] = [];
  let taille = octetsRecus + fichiers.reduce((s, f) => s + f.fichier.size, 0);
  for (const entree of ajouts) {
    if (connus.has(identiteImport(entree))) continue;
    const refus = !mimeDepuisNomFichier(entree.fichier.name) ? "format non pris en charge" : erreurFichierPiece(entree.fichier);
    if (refus) { refuses.push(`${entree.relatif} : ${refus}`); continue; }
    if (fichiers.length + nombreRecu >= MAX_FICHIERS_DEPOT || taille + entree.fichier.size > MAX_OCTETS_DEPOT) {
      refuses.push(`${entree.relatif} : limite de 100 fichiers ou 100 Mio par dépôt`); continue;
    }
    fichiers.push(entree); connus.add(identiteImport(entree)); taille += entree.fichier.size;
  }
  return { fichiers, refuses };
}

/** Le chemin devient un libellé plat, sans créer de classement dans Twiny. */
export function nomImport(entree: FichierImport): string {
  const nom = entree.relatif.replaceAll("/", " · ");
  return nom.length <= 160 ? nom : `…${nom.slice(-159)}`;
}

export function depuisSelection(files: FileList | File[]): FichierImport[] {
  return Array.from(files).map(fichier => ({ fichier, relatif: fichier.webkitRelativePath || fichier.name }));
}

/** Capture les entrées pendant drop, puis lit toutes les pages de chaque dossier. */
export async function depuisDepotGlisse(data: DataTransfer): Promise<FichierImport[]> {
  const entrees = Array.from(data.items).filter(i => i.kind === "file").map(i => ({ entree: i.webkitGetAsEntry?.(), fichier: i.getAsFile() }));
  if (!entrees.some(i => i.entree)) return depuisSelection(data.files);
  const resultat: FichierImport[] = [];
  let visites = 0;
  async function parcourir(entree: FileSystemEntry, prefixe = ""): Promise<void> {
    if (++visites > 5000) throw new Error("Ce dossier contient trop d'éléments. Choisissez un sous-dossier.");
    const relatif = `${prefixe}${entree.name}`;
    if (entree.isFile) {
      const fichier = await new Promise<File>((resolve, reject) => (entree as FileSystemFileEntry).file(resolve, reject));
      resultat.push({ fichier, relatif });
    } else if (entree.isDirectory) {
      const lecteur = (entree as FileSystemDirectoryEntry).createReader();
      while (true) {
        const lot = await new Promise<FileSystemEntry[]>((resolve, reject) => lecteur.readEntries(resolve, reject));
        if (!lot.length) break;
        for (const enfant of lot) await parcourir(enfant, `${relatif}/`);
      }
    }
  }
  for (const { entree, fichier } of entrees) {
    if (entree) await parcourir(entree);
    else if (fichier) resultat.push({ fichier, relatif: fichier.name });
  }
  return resultat;
}
