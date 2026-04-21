import { describe, expect, it } from "vitest";
import { encontrarMejorMatch, normalizar, similitud } from "../src/matcher.js";
import { platilloBase, varianteBase } from "./fixtures.js";
import type { Catalogo, Platillo, Variante } from "@core/types";

function catalogo(platillos: Platillo[], variantes: Variante[]): Catalogo {
  return { platillos, variantes };
}

describe("normalizar", () => {
  it("quita acentos y pasa a minúsculas", () => {
    expect(normalizar("Ñoño Jalapeño")).toBe("nono jalapeno");
    expect(normalizar("  MOLÉ   ")).toBe("mole");
  });
});

describe("similitud", () => {
  it("match exacto devuelve 1", () => {
    expect(similitud("taco al pastor", "taco al pastor")).toBe(1);
  });

  it("tolera plurales y mayúsculas", () => {
    expect(similitud("Taco al pastor", "Tacos al Pastor")).toBe(1);
  });

  it("tolera acentos faltantes", () => {
    expect(similitud("Pozole rojo", "pozole rojo")).toBe(1);
    expect(similitud("Mole poblano", "mole poblano")).toBe(1);
  });

  it("parcial cuando comparten solo un token significativo", () => {
    expect(similitud("taco al pastor", "taco de queso")).toBeCloseTo(0.5, 2);
  });

  it("0 cuando no hay tokens significativos comunes", () => {
    expect(similitud("taco al pastor", "chilaquiles verdes")).toBe(0);
  });

  it("stopwords no cuentan como match", () => {
    expect(similitud("mole de olla", "algo con de en la")).toBe(0);
  });

  it("strings vacíos", () => {
    expect(similitud("", "taco")).toBe(0);
    expect(similitud("taco", "")).toBe(0);
  });
});

describe("encontrarMejorMatch", () => {
  const pastor = platilloBase({ id: "P1", nombre: "Taco al pastor" });
  const varPastor = varianteBase({ id: "V1", idPlatillo: "P1", nombre: "Taco al pastor" });

  const mole = platilloBase({
    id: "P2",
    nombre: "Mole poblano",
    descripcion: "Salsa compleja",
  });
  const varMole = varianteBase({
    id: "V2",
    idPlatillo: "P2",
    nombre: "Mole poblano con pollo",
    contieneCerdo: false,
  });

  const cat = catalogo([pastor, mole], [varPastor, varMole]);

  it("encuentra match por nombre de platillo", () => {
    const m = encontrarMejorMatch("Tacos al pastor", cat);
    expect(m?.platillo.id).toBe("P1");
    expect(m?.variante?.id).toBe("V1");
  });

  it("encuentra match por nombre de variante más específico", () => {
    const m = encontrarMejorMatch("Mole poblano con pollo", cat);
    expect(m?.platillo.id).toBe("P2");
    expect(m?.variante?.id).toBe("V2");
    expect(m?.puntaje).toBe(1);
  });

  it("matchea platillos sin variantes (variante = null)", () => {
    const barbacoa = platilloBase({ id: "P3", nombre: "Barbacoa" });
    const m = encontrarMejorMatch("Barbacoa", catalogo([barbacoa], []));
    expect(m?.platillo.id).toBe("P3");
    expect(m?.variante).toBeNull();
    expect(m?.puntaje).toBe(1);
  });

  it("textos cortos matchean variantes largas que los contienen", () => {
    const m = encontrarMejorMatch("Al pastor", cat);
    expect(m?.platillo.id).toBe("P1");
    expect(m?.puntaje).toBeGreaterThanOrEqual(0.6);
  });

  it("retorna null si no pasa el umbral", () => {
    const m = encontrarMejorMatch("Chilaquiles verdes con queso", cat);
    expect(m).toBeNull();
  });

  it("pick el platillo con puntaje más alto cuando varios matchean", () => {
    const m = encontrarMejorMatch("Taco al pastor", cat);
    expect(m?.platillo.id).toBe("P1");
  });

  it("retorna null cuando el catálogo está vacío", () => {
    expect(encontrarMejorMatch("taco", catalogo([], []))).toBeNull();
  });

  it("ignora variantes huérfanas (sin platillo)", () => {
    const huerfana = varianteBase({ id: "V99", idPlatillo: "NO_EXISTE", nombre: "Taco al pastor" });
    const m = encontrarMejorMatch("Taco al pastor", catalogo([], [huerfana]));
    expect(m).toBeNull();
  });
});
