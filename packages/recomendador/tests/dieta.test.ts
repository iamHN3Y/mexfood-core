import { describe, expect, it } from "vitest";
import { cumpleDieta, dietaEfectiva } from "../src/dieta.js";
import { varianteBase, variantePescado, varianteVegana, varianteVegetariana } from "./fixtures.js";

describe("dietaEfectiva (precedencia)", () => {
  it("vegano gana sobre todos", () => {
    expect(dietaEfectiva({ vegano: true, pescetariano: true, vegetariano: true, keto: false })).toBe("vegano");
  });

  it("pescetariano gana sobre vegetariano cuando ambos son true (contrato §1.2)", () => {
    expect(dietaEfectiva({ vegano: false, pescetariano: true, vegetariano: true, keto: false })).toBe(
      "pescetariano",
    );
  });

  it("vegetariano solo si no hay vegano ni pescetariano", () => {
    expect(dietaEfectiva({ vegano: false, pescetariano: false, vegetariano: true, keto: false })).toBe(
      "vegetariano",
    );
  });

  it("omnivoro cuando todo está en false", () => {
    expect(dietaEfectiva({ vegano: false, pescetariano: false, vegetariano: false, keto: false })).toBe(
      "omnivoro",
    );
  });
});

describe("cumpleDieta", () => {
  const dVegano = { vegano: true, pescetariano: false, vegetariano: false, keto: false };
  const dVege = { vegano: false, pescetariano: false, vegetariano: true, keto: false };
  const dPesc = { vegano: false, pescetariano: true, vegetariano: false, keto: false };
  const dOmni = { vegano: false, pescetariano: false, vegetariano: false, keto: false };

  describe("vegano", () => {
    it("permite variante apta vegano", () => {
      expect(cumpleDieta(dVegano, varianteVegana())).toEqual({ ok: true });
    });

    it("bloquea variante vegetariana con lácteos (no vegana)", () => {
      const res = cumpleDieta(dVegano, varianteVegetariana());
      expect(res).toMatchObject({ ok: false });
      if (!res.ok) expect(res.razon).toMatch(/vegana/i);
    });

    it("bloquea variante con carne", () => {
      expect(cumpleDieta(dVegano, varianteBase()).ok).toBe(false);
    });
  });

  describe("vegetariano", () => {
    it("permite variante apta vegetariana", () => {
      expect(cumpleDieta(dVege, varianteVegetariana())).toEqual({ ok: true });
    });

    it("permite variante vegana (superset)", () => {
      expect(cumpleDieta(dVege, varianteVegana())).toEqual({ ok: true });
    });

    it("bloquea variante con carne", () => {
      expect(cumpleDieta(dVege, varianteBase()).ok).toBe(false);
    });

    it("bloquea variante con mariscos aunque sin carne", () => {
      expect(cumpleDieta(dVege, variantePescado()).ok).toBe(false);
    });
  });

  describe("pescetariano", () => {
    it("permite variante apta vegetariana", () => {
      expect(cumpleDieta(dPesc, varianteVegetariana())).toEqual({ ok: true });
    });

    it("permite variante con mariscos sin cerdo", () => {
      expect(cumpleDieta(dPesc, variantePescado())).toEqual({ ok: true });
    });

    it("bloquea variante con cerdo incluso si también hay mariscos", () => {
      const v = variantePescado({ contieneCerdo: true });
      const res = cumpleDieta(dPesc, v);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.razon).toMatch(/cerdo/i);
    });

    it("bloquea carne no-pescado (no vegetariano, no mariscos)", () => {
      const v = varianteBase({
        contieneCerdo: false,
        aptoVegetariano: false,
        contieneMariscos: false,
      });
      const res = cumpleDieta(dPesc, v);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.razon).toMatch(/carne/i);
    });
  });

  describe("omnivoro", () => {
    it("permite cualquier variante", () => {
      expect(cumpleDieta(dOmni, varianteBase()).ok).toBe(true);
      expect(cumpleDieta(dOmni, variantePescado()).ok).toBe(true);
      expect(cumpleDieta(dOmni, varianteVegana()).ok).toBe(true);
    });
  });
});
