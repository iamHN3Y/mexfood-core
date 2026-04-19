import { describe, expect, it } from "vitest";
import { filaAPlatillo, filaAVariante } from "../src/mapeo.js";
import { filaPlatilloValida, filaVarianteValida } from "./fixtures.js";

describe("filaAPlatillo", () => {
  it("mapea snake_case a camelCase con todos los campos", () => {
    expect(filaAPlatillo(filaPlatilloValida())).toEqual({
      id: "PL001",
      nombre: "Tlayuda",
      categoria: "antojito",
      subcategoria: "tlayuda",
      estadoTipico: "Oaxaca",
      regionTipica: "Sur",
      descripcion: "Tortilla grande con frijoles y quesillo.",
      tipoEstructura: "abierto_con_toppings",
      personalizable: true,
      nivelPicanteBase: "medio",
      riesgoDigestivoBase: "bajo",
      notaCultural: "Símbolo de Oaxaca.",
      recomendacionTurista: "Prueba con tasajo.",
      activo: true,
    });
  });

  it("preserva strings vacíos (el schema acepta '' en descripción/nota)", () => {
    const p = filaAPlatillo(filaPlatilloValida({ descripcion_es: "", nota_cultural_es: "" }));
    expect(p.descripcion).toBe("");
    expect(p.notaCultural).toBe("");
  });
});

describe("filaAVariante", () => {
  it("mapea arrays JSONB como string[] y booleanos como vienen", () => {
    const v = filaAVariante(filaVarianteValida());
    expect(v.ingredientes).toEqual(["tortilla", "frijoles", "quesillo", "tasajo"]);
    expect(v.alergenos).toEqual(["lacteos"]);
    expect(v.contieneLacteos).toBe(true);
    expect(v.contieneCerdo).toBe(false);
    expect(v.aptoVegano).toBe(false);
  });

  it("acepta arrays vacíos para ingredientes y alergenos", () => {
    const v = filaAVariante(filaVarianteValida({ ingredientes_es: [], alergenos: [] }));
    expect(v.ingredientes).toEqual([]);
    expect(v.alergenos).toEqual([]);
  });

  it("lanza si ingredientes_es no es array (datos corruptos en Supabase)", () => {
    expect(() => filaAVariante(filaVarianteValida({ ingredientes_es: "tortilla,frijoles" }))).toThrow(
      /ingredientes_es/,
    );
  });

  it("lanza si un elemento del array no es string", () => {
    expect(() => filaAVariante(filaVarianteValida({ alergenos: ["ok", 42 as unknown as string] }))).toThrow(
      /alergenos\[1\]/,
    );
  });
});
