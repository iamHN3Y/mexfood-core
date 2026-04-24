import { describe, expect, it } from "vitest";
import { calcularMatchScore, etiquetaYColor, PESOS, UMBRALES } from "../src/score.js";
import { perfilBase, platilloBase, varianteBase, varianteVegana } from "./fixtures.js";

describe("etiquetaYColor", () => {
  it("score ≥ 80 → verde / Muy recomendable", () => {
    expect(etiquetaYColor(100)).toEqual({ etiqueta: "Muy recomendable", color: "verde" });
    expect(etiquetaYColor(80)).toEqual({ etiqueta: "Muy recomendable", color: "verde" });
  });

  it("score ∈ [60, 80) → amarillo / Compatible con precauciones", () => {
    expect(etiquetaYColor(79)).toEqual({
      etiqueta: "Compatible con precauciones",
      color: "amarillo",
    });
    expect(etiquetaYColor(60)).toEqual({
      etiqueta: "Compatible con precauciones",
      color: "amarillo",
    });
  });

  it("score ∈ [40, 60) → naranja / Con reservas", () => {
    expect(etiquetaYColor(59)).toEqual({ etiqueta: "Con reservas", color: "naranja" });
    expect(etiquetaYColor(40)).toEqual({ etiqueta: "Con reservas", color: "naranja" });
  });

  it("score < 40 → rojo / No recomendable", () => {
    expect(etiquetaYColor(39)).toEqual({ etiqueta: "No recomendable", color: "rojo" });
    expect(etiquetaYColor(0)).toEqual({ etiqueta: "No recomendable", color: "rojo" });
  });
});

describe("calcularMatchScore — hard filter bloqueado", () => {
  it("cuando hard filter bloquea: apto=false, score=0, color rojo, razonBloqueo presente", () => {
    const perfil = perfilBase({ evitaCerdo: true });
    const v = varianteBase({ contieneCerdo: true });
    const p = platilloBase();

    const r = calcularMatchScore(perfil, v, p);
    expect(r.apto).toBe(false);
    expect(r.score).toBe(0);
    expect(r.color).toBe("rojo");
    expect(r.etiqueta).toBe("No recomendable");
    expect(r.razonBloqueo).toMatch(/cerdo/i);
    expect(r.razonesPositivas).toEqual([]);
    expect(r.razonesNegativas).toEqual([]);
  });

  it("Recomendacion tiene varianteId y platilloId del input", () => {
    const r = calcularMatchScore(
      perfilBase(),
      varianteBase({ id: "VAR999", idPlatillo: "PL999" }),
      platilloBase({ id: "PL999" }),
    );
    expect(r.varianteId).toBe("VAR999");
    expect(r.platilloId).toBe("PL999");
  });
});

describe("calcularMatchScore — match perfecto", () => {
  it("perfil sin restricciones + variante neutra → score 100", () => {
    const perfil = perfilBase({ toleranciaPicante: "alto" });
    const v = varianteVegana({ nivelPicante: "bajo", riesgoDigestivo: "bajo" });
    const p = platilloBase({ estadoTipico: "Oaxaca" });
    perfil.estadoActual = "Nuevo León"; // fuera de Oaxaca

    const r = calcularMatchScore(perfil, v, p);
    expect(r.score).toBe(100);
    expect(r.color).toBe("verde");
    expect(r.apto).toBe(true);
  });
});

describe("calcularMatchScore — penalización por picante", () => {
  it("tolerancia bajo vs picante alto → -30", () => {
    const perfil = perfilBase({ toleranciaPicante: "bajo" });
    const v = varianteVegana({ nivelPicante: "alto", riesgoDigestivo: "bajo" });
    const r = calcularMatchScore(perfil, v, platilloBase({ estadoTipico: "ZZZ" }));
    expect(r.score).toBe(100 + PESOS.picante.bajoVsAlto);
    expect(r.razonesNegativas).toContainEqual(expect.stringMatching(/picante alto/i));
  });

  it("tolerancia bajo vs picante medio → -15", () => {
    const perfil = perfilBase({ toleranciaPicante: "bajo" });
    const v = varianteVegana({ nivelPicante: "medio", riesgoDigestivo: "bajo" });
    const r = calcularMatchScore(perfil, v, platilloBase({ estadoTipico: "ZZZ" }));
    expect(r.score).toBe(100 + PESOS.picante.bajoVsMedio);
  });

  it("tolerancia medio vs picante alto → -15", () => {
    const perfil = perfilBase({ toleranciaPicante: "medio" });
    const v = varianteVegana({ nivelPicante: "alto", riesgoDigestivo: "bajo" });
    const r = calcularMatchScore(perfil, v, platilloBase({ estadoTipico: "ZZZ" }));
    expect(r.score).toBe(100 + PESOS.picante.medioVsAlto);
  });

  it("tolerancia alto NUNCA penaliza", () => {
    const perfil = perfilBase({ toleranciaPicante: "alto" });
    const v = varianteVegana({ nivelPicante: "alto", riesgoDigestivo: "bajo" });
    const r = calcularMatchScore(perfil, v, platilloBase({ estadoTipico: "ZZZ" }));
    expect(r.score).toBe(100);
  });

  it("tolerancia medio vs picante bajo/medio NO penaliza", () => {
    const perfil = perfilBase({ toleranciaPicante: "medio" });
    const vBajo = varianteVegana({ nivelPicante: "bajo", riesgoDigestivo: "bajo" });
    const vMedio = varianteVegana({ nivelPicante: "medio", riesgoDigestivo: "bajo" });
    const p = platilloBase({ estadoTipico: "ZZZ" });
    expect(calcularMatchScore(perfil, vBajo, p).score).toBe(100);
    expect(calcularMatchScore(perfil, vMedio, p).score).toBe(100);
  });
});

describe("calcularMatchScore — penalización digestiva", () => {
  it("estómago sensible + riesgo alto → -25", () => {
    const perfil = perfilBase({ estomagoSensible: true, toleranciaPicante: "alto" });
    const v = varianteVegana({ nivelPicante: "bajo", riesgoDigestivo: "alto" });
    const r = calcularMatchScore(perfil, v, platilloBase({ estadoTipico: "ZZZ" }));
    expect(r.score).toBe(100 + PESOS.digestivo.sensibleVsAlto);
  });

  it("estómago sensible + riesgo medio → -10", () => {
    const perfil = perfilBase({ estomagoSensible: true, toleranciaPicante: "alto" });
    const v = varianteVegana({ nivelPicante: "bajo", riesgoDigestivo: "medio" });
    const r = calcularMatchScore(perfil, v, platilloBase({ estadoTipico: "ZZZ" }));
    expect(r.score).toBe(100 + PESOS.digestivo.sensibleVsMedio);
  });

  it("estómago NO sensible no penaliza aunque riesgo sea alto", () => {
    const perfil = perfilBase({ estomagoSensible: false, toleranciaPicante: "alto" });
    const v = varianteVegana({ nivelPicante: "bajo", riesgoDigestivo: "alto" });
    const r = calcularMatchScore(perfil, v, platilloBase({ estadoTipico: "ZZZ" }));
    expect(r.score).toBe(100);
  });
});

describe("calcularMatchScore — ingredientes a evitar", () => {
  it("un ingrediente coincidente → -10", () => {
    const perfil = perfilBase({
      toleranciaPicante: "alto",
      ingredientesEvitar: ["cilantro"],
    });
    const v = varianteVegana({
      nivelPicante: "bajo",
      riesgoDigestivo: "bajo",
      ingredientes: ["nopal", "cilantro"],
    });
    const r = calcularMatchScore(perfil, v, platilloBase({ estadoTipico: "ZZZ" }));
    expect(r.score).toBe(100 + PESOS.ingredientesEvitar.porCoincidencia);
    expect(r.razonesNegativas).toContainEqual(expect.stringMatching(/cilantro/));
  });

  it("tope de -30 aunque coincidan 5 ingredientes", () => {
    const perfil = perfilBase({
      toleranciaPicante: "alto",
      ingredientesEvitar: ["a", "b", "c", "d", "e"],
    });
    const v = varianteVegana({
      nivelPicante: "bajo",
      riesgoDigestivo: "bajo",
      ingredientes: ["a", "b", "c", "d", "e"],
    });
    const r = calcularMatchScore(perfil, v, platilloBase({ estadoTipico: "ZZZ" }));
    expect(r.score).toBe(100 + PESOS.ingredientesEvitar.tope);
    expect(r.razonesNegativas).toHaveLength(5);
  });

  it("match normaliza case/acentos", () => {
    const perfil = perfilBase({
      toleranciaPicante: "alto",
      ingredientesEvitar: ["CILANTRO"],
    });
    const v = varianteVegana({
      nivelPicante: "bajo",
      riesgoDigestivo: "bajo",
      ingredientes: ["cilantro"],
    });
    const r = calcularMatchScore(perfil, v, platilloBase({ estadoTipico: "ZZZ" }));
    expect(r.score).toBeLessThan(100);
  });
});

describe("calcularMatchScore — ingredientes favoritos", () => {
  it("un favorito coincidente → +5", () => {
    const perfil = perfilBase({
      toleranciaPicante: "alto",
      ingredientesFavoritos: ["queso"],
    });
    const v = varianteVegana({
      nivelPicante: "alto",
      riesgoDigestivo: "alto", // no importa: estómago no sensible
      ingredientes: ["tortilla", "queso Oaxaca"],
    });
    const r = calcularMatchScore(perfil, v, platilloBase({ estadoTipico: "ZZZ" }));
    // Ya estaba en 100, no puede subir más
    expect(r.score).toBe(100);
    expect(r.razonesPositivas).toContainEqual(expect.stringMatching(/queso/));
  });

  it("favoritos compensan penalización: -30 + 15 = -15", () => {
    const perfil = perfilBase({
      toleranciaPicante: "bajo",
      ingredientesFavoritos: ["queso", "frijoles", "nopal"],
    });
    const v = varianteVegana({
      nivelPicante: "alto", // -30
      riesgoDigestivo: "bajo",
      ingredientes: ["tortilla", "queso", "frijoles", "nopal"],
    });
    const r = calcularMatchScore(perfil, v, platilloBase({ estadoTipico: "ZZZ" }));
    expect(r.score).toBe(100 - 30 + PESOS.ingredientesFavoritos.tope);
  });

  it("tope +15 aunque coincidan 5 favoritos", () => {
    const perfil = perfilBase({
      toleranciaPicante: "bajo",
      ingredientesFavoritos: ["a", "b", "c", "d", "e"],
    });
    const v = varianteVegana({
      nivelPicante: "alto",
      riesgoDigestivo: "bajo",
      ingredientes: ["a", "b", "c", "d", "e"],
    });
    const r = calcularMatchScore(perfil, v, platilloBase({ estadoTipico: "ZZZ" }));
    expect(r.score).toBe(100 - 30 + PESOS.ingredientesFavoritos.tope);
  });
});

describe("calcularMatchScore — bonus regional", () => {
  it("estadoActual coincide con estadoTipico del platillo → +10 (clamp a 100)", () => {
    const perfil = perfilBase({ toleranciaPicante: "alto", estadoActual: "Oaxaca" });
    const v = varianteVegana({ nivelPicante: "bajo", riesgoDigestivo: "bajo" });
    const p = platilloBase({ estadoTipico: "Oaxaca" });
    const r = calcularMatchScore(perfil, v, p);
    expect(r.score).toBe(100); // clamped
    expect(r.razonesPositivas).toContainEqual(expect.stringMatching(/Oaxaca/));
  });

  it("no coincide estado → sin bonus", () => {
    const perfil = perfilBase({ toleranciaPicante: "bajo", estadoActual: "Jalisco" });
    const v = varianteVegana({ nivelPicante: "alto", riesgoDigestivo: "bajo" });
    const p = platilloBase({ estadoTipico: "Oaxaca" });
    const r = calcularMatchScore(perfil, v, p);
    expect(r.score).toBe(100 - 30); // no bonus regional
  });
});

describe("calcularMatchScore — clamp 0..100", () => {
  it("no baja de 0 aunque sumen las penalizaciones", () => {
    const perfil = perfilBase({
      toleranciaPicante: "bajo", // -30
      estomagoSensible: true, // -25 si riesgo alto
      ingredientesEvitar: ["a", "b", "c"], // -30 tope
    });
    const v = varianteVegana({
      nivelPicante: "alto",
      riesgoDigestivo: "alto",
      ingredientes: ["a", "b", "c"],
    });
    const r = calcularMatchScore(perfil, v, platilloBase({ estadoTipico: "ZZZ" }));
    expect(r.score).toBe(100 - 30 - 25 - 30); // 15
    expect(r.score).toBeGreaterThanOrEqual(0);
  });

  it("no sube de 100", () => {
    const perfil = perfilBase({
      toleranciaPicante: "alto",
      estadoActual: "Oaxaca",
      ingredientesFavoritos: ["a", "b", "c"],
    });
    const v = varianteVegana({
      nivelPicante: "bajo",
      riesgoDigestivo: "bajo",
      ingredientes: ["a", "b", "c"],
    });
    const p = platilloBase({ estadoTipico: "Oaxaca" });
    const r = calcularMatchScore(perfil, v, p);
    expect(r.score).toBe(100);
  });
});

describe("calcularMatchScore — umbrales de etiqueta aplicados al score real", () => {
  it("score 80 = verde", () => {
    const perfil = perfilBase({
      toleranciaPicante: "bajo",
      estomagoSensible: true,
    });
    const v = varianteVegana({ nivelPicante: "medio", riesgoDigestivo: "bajo" });
    // 100 - 15 = 85 → verde
    const r = calcularMatchScore(perfil, v, platilloBase({ estadoTipico: "ZZZ" }));
    expect(r.score).toBeGreaterThanOrEqual(UMBRALES.verde);
    expect(r.color).toBe("verde");
  });

  it("score 40 (naranja) con penalizaciones agregadas", () => {
    const perfil = perfilBase({
      toleranciaPicante: "bajo", // -30
      estomagoSensible: true, // -25 con riesgo alto
      ingredientesEvitar: ["a"], // -10 (no llega al tope)
    });
    const v = varianteVegana({
      nivelPicante: "alto",
      riesgoDigestivo: "alto",
      ingredientes: ["a"],
    });
    const r = calcularMatchScore(perfil, v, platilloBase({ estadoTipico: "ZZZ" }));
    expect(r.score).toBe(35); // 100 - 30 - 25 - 10
    expect(r.color).toBe("rojo"); // <40
  });
});

describe("calcularMatchScore — keto (soft signal)", () => {
  const ketoOn = { vegetariano: false, vegano: false, pescetariano: false, keto: true };

  it("keto off: ingredientes con carbos no penalizan", () => {
    const perfil = perfilBase({
      toleranciaPicante: "alto",
      estadoActual: "Chiapas",
    });
    const v = varianteBase({
      ingredientes: ["tortilla", "cerdo"],
      nivelPicante: "bajo",
      riesgoDigestivo: "bajo",
    });
    const r = calcularMatchScore(perfil, v, platilloBase({ estadoTipico: "Nayarit" }));
    expect(r.score).toBe(100);
  });

  it("keto on + tortilla: penaliza heavy (-20)", () => {
    const perfil = perfilBase({
      dieta: ketoOn,
      toleranciaPicante: "alto",
      estadoActual: "Chiapas",
    });
    const v = varianteBase({
      ingredientes: ["tortilla", "cerdo"],
      nivelPicante: "bajo",
      riesgoDigestivo: "bajo",
    });
    const r = calcularMatchScore(perfil, v, platilloBase({ estadoTipico: "Nayarit" }));
    expect(r.score).toBe(80); // 100 - 20
    expect(r.razonesNegativas.some((x) => /keto/i.test(x))).toBe(true);
  });

  it("keto on + gluten flag: penaliza heavy aunque no haya nombres de carbo", () => {
    const perfil = perfilBase({
      dieta: ketoOn,
      toleranciaPicante: "alto",
      estadoActual: "Chiapas",
    });
    const v = varianteBase({
      ingredientes: ["salsa", "queso"],
      contieneGluten: true,
      nivelPicante: "bajo",
      riesgoDigestivo: "bajo",
    });
    const r = calcularMatchScore(perfil, v, platilloBase({ estadoTipico: "Nayarit" }));
    expect(r.score).toBe(80);
  });

  it("keto on + frijol (medium): penaliza menos (-10)", () => {
    const perfil = perfilBase({
      dieta: ketoOn,
      toleranciaPicante: "alto",
      estadoActual: "Chiapas",
    });
    const v = varianteBase({
      ingredientes: ["frijol", "queso"],
      nivelPicante: "bajo",
      riesgoDigestivo: "bajo",
    });
    const r = calcularMatchScore(perfil, v, platilloBase({ estadoTipico: "Nayarit" }));
    expect(r.score).toBe(90);
  });

  it("keto on + sin carbos (solo proteína/grasa): sin penalización", () => {
    const perfil = perfilBase({
      dieta: ketoOn,
      toleranciaPicante: "alto",
      estadoActual: "Chiapas",
    });
    const v = varianteBase({
      ingredientes: ["aguacate", "queso", "carne asada"],
      nivelPicante: "bajo",
      riesgoDigestivo: "bajo",
    });
    const r = calcularMatchScore(perfil, v, platilloBase({ estadoTipico: "Nayarit" }));
    expect(r.score).toBe(100);
  });

  it("keto heavy gana sobre medium cuando ambos presentes", () => {
    const perfil = perfilBase({
      dieta: ketoOn,
      toleranciaPicante: "alto",
      estadoActual: "Chiapas",
    });
    const v = varianteBase({
      ingredientes: ["tortilla", "frijol", "queso"],
      nivelPicante: "bajo",
      riesgoDigestivo: "bajo",
    });
    const r = calcularMatchScore(perfil, v, platilloBase({ estadoTipico: "Nayarit" }));
    // Solo se aplica el heavy, no doble penalización
    expect(r.score).toBe(80);
  });
});
