// Récupération temporaire : inverse une corruption cp1252 retour UTF-8 (double-encodage).
const fs = require("fs");

const p = "app/src/lib/ui/formule.test.ts";

// Table cp1252 (fragment différent du latin1), pour ramener chaque caractère
// du texte corrompu vers l'octet d'origine.
const tb = new Uint16Array(256);
for (let i = 0; i < 256; i++) tb[i] = i;
const diff = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026,
  0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160,
  0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019,
  0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153,
  0x9e: 0x017e, 0x9f: 0x0178,
};
for (const [k, v] of Object.entries(diff)) tb[Number(k)] = v;

const rev = new Map();
for (let b = 0; b < 256; b++) rev.set(tb[b], b);

let s = fs.readFileSync(p, "utf8");
if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);

const octets = [];
for (const ch of s) {
  const cp = ch.codePointAt(0);
  if (!rev.has(cp)) {
    console.error("caractère sans octet d'origine : U+" + cp.toString(16));
    process.exit(1);
  }
  octets.push(rev.get(cp));
}

// En-têtes de ligne : normaliser CRLF → LF comme le fichier d'origine.
const latin = Buffer.from(octets).toString("latin1").replace(/\r\n/g, "\n");
fs.writeFileSync(p, Buffer.from(latin, "latin1"));
console.log("récupération OK : " + latin.length + " octets");