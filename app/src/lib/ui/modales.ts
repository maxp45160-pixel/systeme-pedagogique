/** Dernière surcouche visible : seule elle traite le clavier. */
export function modaleSuperieure(): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>('[data-modale-active="true"]')].at(-1);
}

export function ciblesTabulation(panneau: HTMLElement): HTMLElement[] {
  return [...panneau.querySelectorAll<HTMLElement>(
    'a[href],button,input,select,textarea,summary,[contenteditable="true"],[contenteditable=""],[tabindex]',
  )].filter((el) =>
    !el.matches(':disabled') && !el.closest('[inert]') &&
    (el.tabIndex >= 0 || (el.isContentEditable && !el.hasAttribute('tabindex'))) &&
    el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden',
  );
}

// Plusieurs portails peuvent se fermer dans n'importe quel ordre.
const verrous = new Set<symbol>();
let styleInitial: { overflow: string; paddingRight: string } | undefined;
export function bloquerDefilement(): () => void {
  const verrou = Symbol();
  if (verrous.size === 0) {
    const { overflow, paddingRight } = document.body.style;
    styleInitial = { overflow, paddingRight };
    const compensation = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (compensation > 0) document.body.style.paddingRight = `${compensation}px`;
  }
  verrous.add(verrou);
  return () => {
    if (!verrous.delete(verrou)) return;
    if (verrous.size === 0 && styleInitial) {
      Object.assign(document.body.style, styleInitial);
      styleInitial = undefined;
    }
  };
}
