import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { cargarCatalogoDesdeArchivos } from "../src/catalogo.js";

const DATA_DIR = resolve(import.meta.dirname, "../../../data");
const RUTA_PLATILLOS = resolve(DATA_DIR, "platillos.csv");
const RUTA_VARIANTES = resolve(DATA_DIR, "variantes_platillo.csv");

describe("integración: dataset real", () => {
  it("carga platillos.csv sin errores y con el conteo esperado", async () => {
    const cat = await cargarCatalogoDesdeArchivos(RUTA_PLATILLOS, RUTA_VARIANTES);
    expect(cat.platillos).toHaveLength(220);
    expect(cat.variantes).toHaveLength(190);
  });

  it("toda variante tiene idPlatillo presente en el catálogo", async () => {
    const cat = await cargarCatalogoDesdeArchivos(RUTA_PLATILLOS, RUTA_VARIANTES);
    const idsPlatillo = new Set(cat.platillos.map((p) => p.id));
    const huerfanas = cat.variantes.filter((v) => !idsPlatillo.has(v.idPlatillo));
    expect(huerfanas).toEqual([]);
  });

  it("ingredientes están parseados como arrays de strings no vacíos", async () => {
    const cat = await cargarCatalogoDesdeArchivos(RUTA_PLATILLOS, RUTA_VARIANTES);
    for (const v of cat.variantes) {
      expect(Array.isArray(v.ingredientes)).toBe(true);
      expect(v.ingredientes.length).toBeGreaterThan(0);
      v.ingredientes.forEach((ing) => expect(typeof ing).toBe("string"));
    }
  });

  it("primer platillo y primera variante tienen los campos conocidos del dataset", async () => {
    const cat = await cargarCatalogoDesdeArchivos(RUTA_PLATILLOS, RUTA_VARIANTES);
    const pl001 = cat.platillos.find((p) => p.id === "PL001");
    const var001 = cat.variantes.find((v) => v.id === "VAR001");

    expect(pl001?.nombre).toBe("quesadilla");
    expect(pl001?.categoria).toBe("antojito");
    expect(var001?.idPlatillo).toBe("PL001");
    expect(var001?.ingredientes).toContain("queso Oaxaca");
    expect(var001?.alergenos).toContain("lácteos");
  });
});
