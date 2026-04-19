import { describe, expect, it } from "vitest";
import { aplicarHardFilters } from "../src/hard-filters.js";
import {
  perfilBase,
  varianteBase,
  variantePescado,
  varianteVegana,
  varianteVegetariana,
} from "./fixtures.js";

describe("aplicarHardFilters — sin restricciones", () => {
  it("perfil limpio + variante común → apto", () => {
    expect(aplicarHardFilters(perfilBase(), varianteBase())).toEqual({ apto: true });
  });
});

describe("aplicarHardFilters — alergias", () => {
  it("alergia a cacahuate bloquea variante con cacahuate", () => {
    const res = aplicarHardFilters(
      perfilBase({ alergias: ["cacahuate"] }),
      varianteBase({ alergenos: ["cacahuate"] }),
    );
    expect(res.apto).toBe(false);
    expect(res.razonBloqueo).toMatch(/cacahuate/i);
  });

  it("alergia no relacionada no bloquea", () => {
    const res = aplicarHardFilters(
      perfilBase({ alergias: ["nuez"] }),
      varianteBase({ alergenos: ["gluten"] }),
    );
    expect(res.apto).toBe(true);
  });

  it("match de alergeno es case-insensitive", () => {
    const res = aplicarHardFilters(
      perfilBase({ alergias: ["CACAHUATE"] }),
      varianteBase({ alergenos: ["cacahuate"] }),
    );
    expect(res.apto).toBe(false);
  });

  it("match normaliza acentos (lácteos ↔ lacteos)", () => {
    const res = aplicarHardFilters(
      perfilBase({ alergias: ["lacteos"] }),
      varianteBase({ alergenos: ["lácteos"] }),
    );
    expect(res.apto).toBe(false);
  });

  it("match ignora espacios sobrantes", () => {
    const res = aplicarHardFilters(
      perfilBase({ alergias: ["  soya  "] }),
      varianteBase({ alergenos: ["soya"] }),
    );
    expect(res.apto).toBe(false);
  });

  it("alergia vacía en el arreglo se ignora", () => {
    const res = aplicarHardFilters(
      perfilBase({ alergias: ["", "  "] }),
      varianteBase({ alergenos: ["cacahuate"] }),
    );
    expect(res.apto).toBe(true);
  });

  it("múltiples alergias: basta con una coincidencia", () => {
    const res = aplicarHardFilters(
      perfilBase({ alergias: ["nuez", "cacahuate", "soya"] }),
      varianteBase({ alergenos: ["cacahuate"] }),
    );
    expect(res.apto).toBe(false);
    expect(res.razonBloqueo).toMatch(/cacahuate/);
  });

  it("alergia match por inclusión parcial (soya ⊂ salsa de soya)", () => {
    const res = aplicarHardFilters(
      perfilBase({ alergias: ["soya"] }),
      varianteBase({ alergenos: ["salsa de soya"] }),
    );
    expect(res.apto).toBe(false);
  });
});

describe("aplicarHardFilters — dieta (precedencia)", () => {
  it("vegano bloquea variante vegetariana pero no vegana", () => {
    const p = perfilBase({ dieta: { vegano: true, vegetariano: false, pescetariano: false } });
    expect(aplicarHardFilters(p, varianteVegetariana()).apto).toBe(false);
    expect(aplicarHardFilters(p, varianteVegana()).apto).toBe(true);
  });

  it("vegetariano permite vegana, bloquea carne", () => {
    const p = perfilBase({ dieta: { vegano: false, vegetariano: true, pescetariano: false } });
    expect(aplicarHardFilters(p, varianteVegana()).apto).toBe(true);
    expect(aplicarHardFilters(p, varianteBase()).apto).toBe(false);
  });

  it("pescetariano permite pescado pero bloquea cerdo", () => {
    const p = perfilBase({ dieta: { vegano: false, vegetariano: false, pescetariano: true } });
    expect(aplicarHardFilters(p, variantePescado()).apto).toBe(true);
    expect(aplicarHardFilters(p, varianteBase()).apto).toBe(false);
  });

  it("vegano+pescetariano: gana vegano (el más estricto)", () => {
    const p = perfilBase({ dieta: { vegano: true, vegetariano: false, pescetariano: true } });
    expect(aplicarHardFilters(p, variantePescado()).apto).toBe(false);
    expect(aplicarHardFilters(p, varianteVegana()).apto).toBe(true);
  });

  it("pescetariano+vegetariano: gana pescetariano (permite pescado)", () => {
    const p = perfilBase({ dieta: { vegano: false, vegetariano: true, pescetariano: true } });
    expect(aplicarHardFilters(p, variantePescado()).apto).toBe(true);
  });
});

describe("aplicarHardFilters — restricciones médicas", () => {
  it("sinGluten bloquea variante con gluten", () => {
    const res = aplicarHardFilters(
      perfilBase({ restricciones: { sinGluten: true, sinLacteos: false } }),
      varianteBase({ contieneGluten: true, contieneCerdo: false }),
    );
    expect(res.apto).toBe(false);
    expect(res.razonBloqueo).toMatch(/gluten/i);
  });

  it("sinLacteos bloquea variante con lácteos", () => {
    const res = aplicarHardFilters(
      perfilBase({ restricciones: { sinGluten: false, sinLacteos: true } }),
      varianteVegetariana(),
    );
    expect(res.apto).toBe(false);
    expect(res.razonBloqueo).toMatch(/lácteos|lacteos/i);
  });

  it("sinGluten y sinLacteos combinados bloquean variante con lácteos", () => {
    const res = aplicarHardFilters(
      perfilBase({ restricciones: { sinGluten: true, sinLacteos: true } }),
      varianteVegetariana(),
    );
    expect(res.apto).toBe(false);
  });
});

describe("aplicarHardFilters — preferencias de evitación", () => {
  it("evitaCerdo bloquea variante con cerdo", () => {
    const res = aplicarHardFilters(
      perfilBase({ evitaCerdo: true }),
      varianteBase({ contieneCerdo: true }),
    );
    expect(res.apto).toBe(false);
    expect(res.razonBloqueo).toMatch(/cerdo/i);
  });

  it("evitaMariscos bloquea variante con mariscos", () => {
    const res = aplicarHardFilters(perfilBase({ evitaMariscos: true }), variantePescado());
    expect(res.apto).toBe(false);
    expect(res.razonBloqueo).toMatch(/marisco/i);
  });

  it("evitaAlcohol bloquea variante con alcohol", () => {
    const res = aplicarHardFilters(
      perfilBase({ evitaAlcohol: true }),
      varianteBase({ contieneAlcohol: true }),
    );
    expect(res.apto).toBe(false);
    expect(res.razonBloqueo).toMatch(/alcohol/i);
  });
});

describe("aplicarHardFilters — prioridad de reporte", () => {
  it("alergias se reportan antes que dieta si ambas bloquean", () => {
    const res = aplicarHardFilters(
      perfilBase({
        alergias: ["cacahuate"],
        dieta: { vegano: true, vegetariano: false, pescetariano: false },
      }),
      varianteBase({ alergenos: ["cacahuate"] }),
    );
    expect(res.apto).toBe(false);
    expect(res.razonBloqueo).toMatch(/cacahuate/i);
  });

  it("dieta se reporta antes que restricciones si ambas bloquean", () => {
    const res = aplicarHardFilters(
      perfilBase({
        dieta: { vegano: true, vegetariano: false, pescetariano: false },
        restricciones: { sinGluten: true, sinLacteos: false },
      }),
      varianteBase({ contieneGluten: true }),
    );
    expect(res.apto).toBe(false);
    expect(res.razonBloqueo).toMatch(/vegana/i);
  });

  it("restricciones se reportan antes que evitaCerdo si ambas bloquean", () => {
    const res = aplicarHardFilters(
      perfilBase({
        restricciones: { sinGluten: false, sinLacteos: true },
        evitaCerdo: true,
      }),
      varianteBase({ contieneCerdo: true, contieneLacteos: true }),
    );
    expect(res.apto).toBe(false);
    expect(res.razonBloqueo).toMatch(/lácteos|lacteos/i);
  });
});

describe("aplicarHardFilters — casos complejos realistas", () => {
  it("turista vegana con alergia a cacahuate + platillo de nopales sin cacahuate → apto", () => {
    const p = perfilBase({
      alergias: ["cacahuate"],
      dieta: { vegano: true, vegetariano: false, pescetariano: false },
    });
    expect(aplicarHardFilters(p, varianteVegana()).apto).toBe(true);
  });

  it("musulmán estricto (evita cerdo + alcohol) en taco al pastor → bloquea por cerdo", () => {
    const p = perfilBase({ evitaCerdo: true, evitaAlcohol: true });
    const res = aplicarHardFilters(p, varianteBase());
    expect(res.apto).toBe(false);
    expect(res.razonBloqueo).toMatch(/cerdo/i);
  });

  it("celíaco pescetariano en tacos de camarón sin gluten → apto", () => {
    const p = perfilBase({
      dieta: { vegano: false, vegetariano: false, pescetariano: true },
      restricciones: { sinGluten: true, sinLacteos: false },
    });
    const v = variantePescado({ contieneGluten: false });
    expect(aplicarHardFilters(p, v).apto).toBe(true);
  });

  it("intolerante a lactosa en quesadilla → bloquea", () => {
    const p = perfilBase({ restricciones: { sinGluten: false, sinLacteos: true } });
    expect(aplicarHardFilters(p, varianteVegetariana()).apto).toBe(false);
  });
});
