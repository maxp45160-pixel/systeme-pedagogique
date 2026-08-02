tconst fs = require('fs');
const chemin = 'app/src/components/dev/profil-flottant.tsx';
let c = fs.readFileSync(chemin, 'utf8');

// 1. Add basculerProfilage after vider
const viderBlock = `  const vider = async () => {
    viderMesuresClient();
    try {
      await fetch("/api/profiling", { method: "DELETE" });
    } catch {
      // ignore
    }
    void charger();
  };`;

const viderNouveau = viderBlock + `

  /**
   * Bascule le profilage serveur ET client en même temps.
   *
   * Les deux sont liés : on profile pour comparer les temps serveur et client,
   * en avoir un sans l'autre ne sert rien. Le bouton reflète l'etat combine :
   * « Demarrer » si l'un des deux est inactif, « Arreter » si les deux sont actifs.
   */
  const basculerProfilage = useCallback(async () => {
    setBasculeEnCours(true);
    const actif = serveur?.actif === true && clientActif;
    try {
      if (actif) {
        desactiverProfilageClient();
        await fetch("/api/profiling", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "stop" }),
        });
      } else {
        activerProfilageClient();
        await fetch("/api/profiling", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "start" }),
        });
      }
      await charger();
    } catch {
      setErreur("Bascule du profilage impossible.");
    } finally {
      setBasculeEnCours(false);
    }
  }, [serveur?.actif, clientActif, charger]);`;

if (!c.includes(viderBlock)) { console.error('VIDER BLOCK NOT FOUND'); process.exit(1); }
c = c.replace(viderBlock, viderNouveau);

// 2. Add profilageActif computed var before return
const oldReturn = '  const rendus = rendusActuels();\n  const interactions = interactionsActuelles();\n\n  return (';
const newReturn = '  const rendus = rendusActuels();\n  const interactions = interactionsActuelles();\n\n  const profilageActif = serveur?.actif === true && clientActif;\n\n  return (';
if (!c.includes(oldReturn)) { console.error('RETURN BLOCK NOT FOUND'); process.exit(1); }
c = c.replace(oldReturn, newReturn);

// 3. Update the status dot in header
const oldDot = `              <span
                className={cx(
                  "size-2 rounded-full",
                  clientActif ? "bg-succes" : "bg-texte-discret",
                )}
                title={clientActif ? "Profilage client actif" : "Profilage client inactif"}
                aria-hidden
              />`;
const newDot = `              <span
                className={cx(
                  "size-2 rounded-full",
                  profilageActif ? "bg-succes" : "bg-texte-discret",
                )}
                title={profilageActif ? "Profilage actif" : "Profilage inactif"}
                aria-hidden
              />`;
if (!c.includes(oldDot)) { console.error('DOT NOT FOUND'); process.exit(1); }
c = c.replace(oldDot, newDot);

// 4. Add Start/Stop button before Vider button
const oldViderBtn = `              <button
                onClick={vider}
                className="rounded-md border border-danger/30 bg-danger-faible px-2 py-1 text-[0.6875rem] font-medium text-danger transition-colors hover:bg-danger/10"
              >
                Vider
              </button>`;

const newBtns = `              {/* --- Bouton Demarrer / Arreter --- */}
              <button
                onClick={basculerProfilage}
                disabled={basculeEnCours}
                className={cx(
                  "rounded-md px-2 py-1 text-[0.6875rem] font-medium transition-colors disabled:opacity-50",
                  profilageActif
                    ? "border border-danger/30 bg-danger-faible text-danger hover:bg-danger/10"
                    : "border border-succes/30 bg-succes-faible text-succes hover:bg-succes/10",
                )}
                title={
                  profilageActif
                    ? "Arrete le profilage serveur et client"
                    : "Demarre le profilage serveur et client"
                }
              >
                {basculeEnCours ? "..." : profilageActif ? "Arreter" : "Demarrer"}
              </button>
              <button
                onClick={vider}
                className="rounded-md border border-danger/30 bg-danger-faible px-2 py-1 text-[0.6875rem] font-medium text-danger transition-colors hover:bg-danger/10"
              >
                Vider
              </button>`;

if (!c.includes(oldViderBtn)) { console.error('VIDER BTN NOT FOUND'); process.exit(1); }
c = c.replace(oldViderBtn, newBtns);

fs.writeFileSync(chemin, c);
console.log('done');
