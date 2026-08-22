import { describe, expect, it } from "vitest";

import {
  MAX_PIECE_OCTETS,
  erreurFichierPiece,
  estMimePieceJointe,
  extensionPourMime,
  mimeDepuisNomFichier,
} from "./pieces-jointes";

describe("pièces jointes documentaires", () => {
  it("n'accepte que les types MIME du contrat", () => {
    expect(estMimePieceJointe("application/pdf")).toBe(true);
    expect(estMimePieceJointe("image/jpeg")).toBe(true);
    expect(estMimePieceJointe("image/png")).toBe(true);
    expect(estMimePieceJointe("image/webp")).toBe(true);
    expect(estMimePieceJointe("image/gif")).toBe(false);
    expect(estMimePieceJointe("application/zip")).toBe(false);
    expect(estMimePieceJointe(undefined)).toBe(false);
  });

  it("déduit le MIME d'un fichier depuis son extension", () => {
    expect(mimeDepuisNomFichier("cahier.JPG")).toBe("image/jpeg");
    expect(mimeDepuisNomFichier("scan.jpeg")).toBe("image/jpeg");
    expect(mimeDepuisNomFichier("photo.png")).toBe("image/png");
    expect(mimeDepuisNomFichier("dessin.webp")).toBe("image/webp");
    expect(mimeDepuisNomFichier("cours.pdf")).toBe("application/pdf");
    expect(mimeDepuisNomFichier("archive.zip")).toBeNull();
    expect(mimeDepuisNomFichier("sans-extension")).toBeNull();
  });

  it("donne une extension canonique par type accepté", () => {
    expect(extensionPourMime("application/pdf")).toBe(".pdf");
    expect(extensionPourMime("image/jpeg")).toBe(".jpg");
    expect(extensionPourMime("image/png")).toBe(".png");
    expect(extensionPourMime("image/webp")).toBe(".webp");
  });

  it("accepte un PDF ou une image dans la limite des 10 Mo", () => {
    expect(erreurFichierPiece({ name: "a.pdf", type: "application/pdf", size: 1024 })).toBeNull();
    expect(erreurFichierPiece({ name: "photo.jpg", type: "image/jpeg", size: 5_000_000 })).toBeNull();
    expect(
      erreurFichierPiece({ name: "cahier.webp", type: "", size: MAX_PIECE_OCTETS }),
    ).toBeNull();
  });

  it("refuse les formats hors contrat et les tailles impossibles", () => {
    expect(
      erreurFichierPiece({ name: "virus.exe", type: "application/x-msdownload", size: 100 }),
    ).toMatch(/PDF et les images/);
    expect(erreurFichierPiece({ name: "vide.png", type: "image/png", size: 0 })).toMatch(/1 octet et 10 Mo/);
    expect(
      erreurFichierPiece({ name: "lourd.pdf", type: "application/pdf", size: MAX_PIECE_OCTETS + 1 }),
    ).toMatch(/1 octet et 10 Mo/);
  });
});
