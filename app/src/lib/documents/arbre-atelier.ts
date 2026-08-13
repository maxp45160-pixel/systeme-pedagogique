export interface ElementClasseAtelier {
  id: string;
  titre: string;
  type: string;
  dossier: string;
  dossiersSecondaires?: string[];
}

export interface NoeudDossier<T extends ElementClasseAtelier = ElementClasseAtelier> {
  nom: string;
  chemin: string;
  enfants: NoeudDossier<T>[];
  elements: T[];
}

export function compterElements(noeud: NoeudDossier): number {
  const ids = new Set(noeud.elements.map(({ id }) => id));
  for (const enfant of noeud.enfants) {
    for (const id of idsElements(enfant)) ids.add(id);
  }
  return ids.size;
}

function idsElements(noeud: NoeudDossier): Set<string> {
  const ids = new Set(noeud.elements.map(({ id }) => id));
  for (const enfant of noeud.enfants) for (const id of idsElements(enfant)) ids.add(id);
  return ids;
}

export function trouverNoeudDossier<T extends ElementClasseAtelier>(
  racines: NoeudDossier<T>[],
  chemin: string,
): NoeudDossier<T> | null {
  for (const noeud of racines) {
    if (noeud.chemin === chemin) return noeud;
    const enfant = trouverNoeudDossier(noeud.enfants, chemin);
    if (enfant) return enfant;
  }
  return null;
}

export function construireArbreDossiers<T extends ElementClasseAtelier>(elements: T[]): NoeudDossier<T>[] {
  const racines: NoeudDossier<T>[] = [];
  const index = new Map<string, NoeudDossier<T>>();
  for (const element of elements) {
    for (const dossier of new Set([element.dossier, ...(element.dossiersSecondaires ?? [])])) {
      const parties = dossier.split("/").map((partie) => partie.trim()).filter(Boolean);
      const cheminParties = parties.length ? parties : ["Documents"];
      let chemin = "";
      let niveau = racines;
      for (const [position, partie] of cheminParties.entries()) {
        chemin = chemin ? `${chemin}/${partie}` : partie;
        let noeud = index.get(chemin);
        if (!noeud) {
          noeud = { nom: partie, chemin, enfants: [], elements: [] };
          index.set(chemin, noeud);
          niveau.push(noeud);
        }
        if (position === cheminParties.length - 1 && !noeud.elements.some(({ id }) => id === element.id)) noeud.elements.push(element);
        niveau = noeud.enfants;
      }
    }
  }
  const ordreRacines = new Map([["Domaines", 0], ["Transversal", 1]]);
  function trier(noeud: NoeudDossier<T>) {
    noeud.elements.sort((a, b) => a.type === "domaine" ? -1 : b.type === "domaine" ? 1 : a.titre.localeCompare(b.titre, "fr"));
    noeud.enfants.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    noeud.enfants.forEach(trier);
  }
  racines.forEach(trier);
  return racines
    .filter((noeud) => compterElements(noeud) > 0)
    .sort((a, b) => (ordreRacines.get(a.nom) ?? 10) - (ordreRacines.get(b.nom) ?? 10) || a.nom.localeCompare(b.nom, "fr"));
}
