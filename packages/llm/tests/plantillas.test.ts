import { describe, expect, it } from "vitest";
import { plantillaExplicacion, plantillaFrases } from "../src/plantillas.js";
import {
  perfilBase,
  platilloBase,
  recomendacionApta,
  recomendacionBloqueada,
  varianteBase,
} from "./fixtures.js";

describe("plantillaExplicacion", () => {
  it("explica una recomendación apta con razón positiva", () => {
    const r = plantillaExplicacion(recomendacionApta(), platilloBase(), varianteBase());
    expect(r.fuente).toBe("plantilla");
    expect(r.texto).toContain("Taco al pastor");
    expect(r.texto.toLowerCase()).toContain("ciudad de méxico");
    expect(r.tipCultural).toBe("Clásico de CDMX, ideal al atardecer.");
    expect(r.advertencia).toBeUndefined();
  });

  it("incluye advertencia si hay razones negativas", () => {
    const r = plantillaExplicacion(
      recomendacionApta({
        score: 65,
        color: "amarillo",
        etiqueta: "Compatible con precauciones",
        razonesNegativas: ["Riesgo digestivo alto y tu estómago es sensible"],
      }),
      platilloBase(),
      varianteBase(),
    );
    expect(r.advertencia).toContain("digestivo");
  });

  it("devuelve texto de bloqueo cuando apto es false", () => {
    const r = plantillaExplicacion(recomendacionBloqueada(), platilloBase(), varianteBase());
    expect(r.texto.toLowerCase()).toContain("evita");
    expect(r.texto.toLowerCase()).toContain("cerdo");
    expect(r.fuente).toBe("plantilla");
  });

  it("usa color para determinar el tono del intro", () => {
    const verde = plantillaExplicacion(
      recomendacionApta({ color: "verde" }),
      platilloBase(),
      varianteBase(),
    );
    const naranja = plantillaExplicacion(
      recomendacionApta({ color: "naranja" }),
      platilloBase(),
      varianteBase(),
    );
    expect(verde.texto).toContain("excelente");
    expect(naranja.texto).toContain("reservas");
  });

  it("omite tipCultural si platillo.notaCultural está vacío", () => {
    const r = plantillaExplicacion(
      recomendacionApta(),
      platilloBase({ notaCultural: "" }),
      varianteBase(),
    );
    expect(r.tipCultural).toBeUndefined();
  });
});

describe("plantillaFrases", () => {
  it("siempre devuelve al menos 3 frases con campos completos", () => {
    const frases = plantillaFrases(platilloBase(), perfilBase());
    expect(frases.length).toBeGreaterThanOrEqual(3);
    for (const f of frases) {
      expect(f.fraseEs).toBeTruthy();
      expect(f.traduccion).toBeTruthy();
      expect(f.pronunciacionFonetica).toBeTruthy();
    }
  });

  it("añade frase de 'sin picante' si tolerancia es baja", () => {
    const frases = plantillaFrases(platilloBase(), perfilBase({ toleranciaPicante: "bajo" }));
    expect(frases.some((f) => f.fraseEs.toLowerCase().includes("picante"))).toBe(true);
  });

  it("añade frase de alergia si el perfil tiene alergias", () => {
    const frases = plantillaFrases(platilloBase(), perfilBase({ alergias: ["cacahuate"] }));
    expect(frases.some((f) => f.fraseEs.toLowerCase().includes("alérgico"))).toBe(true);
  });

  it("usa el nombre del platillo en la primera frase", () => {
    const frases = plantillaFrases(platilloBase({ nombre: "Pozole rojo" }), perfilBase());
    expect(frases[0]?.fraseEs).toContain("Pozole rojo");
  });
});
