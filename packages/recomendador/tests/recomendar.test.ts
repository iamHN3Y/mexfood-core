import { describe, expect, it } from "vitest";
import type { Catalogo, Platillo, Variante } from "@core/types";
import { recomendarPlatillos } from "../src/recomendar.js";
import { perfilBase, platilloBase, varianteBase } from "./fixtures.js";

function catalogoCon(platillos: Platillo[], variantes: Variante[]): Catalogo {
  return { platillos, variantes };
}

describe("recomendarPlatillos", () => {
  it("devuelve topN=5 por defecto cuando hay más de 5 aptos", () => {
    const platillos = Array.from({ length: 8 }, (_, i) =>
      platilloBase({ id: `PL${i}`, nombre: `Platillo ${i}` }),
    );
    const variantes = platillos.map((p, i) => varianteBase({ id: `VAR${i}`, idPlatillo: p.id }));
    const r = recomendarPlatillos(perfilBase(), catalogoCon(platillos, variantes));
    expect(r.recomendados).toHaveLength(5);
    expect(r.totalEvaluados).toBe(8);
  });

  it("respeta opción topN personalizada", () => {
    const platillos = Array.from({ length: 6 }, (_, i) => platilloBase({ id: `PL${i}` }));
    const variantes = platillos.map((p, i) => varianteBase({ id: `VAR${i}`, idPlatillo: p.id }));
    const r = recomendarPlatillos(perfilBase(), catalogoCon(platillos, variantes), {
      topN: 3,
    });
    expect(r.recomendados).toHaveLength(3);
  });

  it("ordena recomendados por score descendente", () => {
    const platillos = [
      platilloBase({ id: "P_LOW", estadoTipico: "Yucatán" }),
      platilloBase({ id: "P_HIGH", estadoTipico: "Ciudad de México" }),
      platilloBase({ id: "P_MID", estadoTipico: "Oaxaca" }),
    ];
    const variantes = [
      varianteBase({ id: "V_LOW", idPlatillo: "P_LOW", nivelPicante: "alto" }),
      varianteBase({ id: "V_HIGH", idPlatillo: "P_HIGH" }),
      varianteBase({ id: "V_MID", idPlatillo: "P_MID" }),
    ];
    const perfil = perfilBase({
      toleranciaPicante: "bajo",
      estadoActual: "Ciudad de México",
    });
    const r = recomendarPlatillos(perfil, catalogoCon(platillos, variantes));
    const scores = r.recomendados.map((x) => x.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(r.recomendados[0]?.platilloId).toBe("P_HIGH");
  });

  it("diversifica: máximo 1 variante por platilloId en top N", () => {
    const platillos = [
      platilloBase({ id: "PL_A", nombre: "Tacos" }),
      platilloBase({ id: "PL_B", nombre: "Enchiladas" }),
    ];
    const variantes = [
      varianteBase({ id: "VA1", idPlatillo: "PL_A" }),
      varianteBase({ id: "VA2", idPlatillo: "PL_A" }),
      varianteBase({ id: "VA3", idPlatillo: "PL_A" }),
      varianteBase({ id: "VB1", idPlatillo: "PL_B" }),
    ];
    const r = recomendarPlatillos(perfilBase(), catalogoCon(platillos, variantes), {
      topN: 2,
    });
    const platillosUnicos = new Set(r.recomendados.map((x) => x.platilloId));
    expect(platillosUnicos.size).toBe(2);
    expect(r.recomendados).toHaveLength(2);
  });

  it("rellena top N con repetidos si no hay suficientes platillos únicos", () => {
    const platillos = [platilloBase({ id: "PL_A" })];
    const variantes = [
      varianteBase({ id: "VA1", idPlatillo: "PL_A" }),
      varianteBase({ id: "VA2", idPlatillo: "PL_A" }),
      varianteBase({ id: "VA3", idPlatillo: "PL_A" }),
    ];
    const r = recomendarPlatillos(perfilBase(), catalogoCon(platillos, variantes), {
      topN: 3,
    });
    expect(r.recomendados).toHaveLength(3);
    expect(r.recomendados.every((x) => x.platilloId === "PL_A")).toBe(true);
  });

  it("con diversificar:false permite múltiples variantes del mismo platillo", () => {
    const platillos = [platilloBase({ id: "PL_A" })];
    const variantes = [
      varianteBase({ id: "VA1", idPlatillo: "PL_A" }),
      varianteBase({ id: "VA2", idPlatillo: "PL_A" }),
      varianteBase({ id: "VA3", idPlatillo: "PL_A" }),
    ];
    const r = recomendarPlatillos(perfilBase(), catalogoCon(platillos, variantes), {
      topN: 3,
      diversificar: false,
    });
    expect(r.recomendados).toHaveLength(3);
  });

  it("incluye en evitar los platillos bloqueados por hard filters", () => {
    const platillos = [platilloBase({ id: "PL_OK" }), platilloBase({ id: "PL_BLOCK" })];
    const variantes = [
      varianteBase({ id: "VOK", idPlatillo: "PL_OK" }),
      varianteBase({
        id: "VBLOCK",
        idPlatillo: "PL_BLOCK",
        alergenos: ["lácteos"],
        contieneLacteos: true,
      }),
    ];
    const perfil = perfilBase({ alergias: ["lácteos"] });
    const r = recomendarPlatillos(perfil, catalogoCon(platillos, variantes));
    expect(r.recomendados).toHaveLength(1);
    expect(r.recomendados[0]?.varianteId).toBe("VOK");
    expect(r.evitar).toHaveLength(1);
    expect(r.evitar[0]?.varianteId).toBe("VBLOCK");
    expect(r.evitar[0]?.apto).toBe(false);
  });

  it("respeta incluirEvitar:false", () => {
    const platillos = [platilloBase({ id: "PL_BLOCK" })];
    const variantes = [
      varianteBase({
        id: "VBLOCK",
        idPlatillo: "PL_BLOCK",
        alergenos: ["lácteos"],
        contieneLacteos: true,
      }),
    ];
    const perfil = perfilBase({ alergias: ["lácteos"] });
    const r = recomendarPlatillos(perfil, catalogoCon(platillos, variantes), {
      incluirEvitar: false,
    });
    expect(r.evitar).toHaveLength(0);
  });

  it("respeta maxEvitar personalizado", () => {
    const platillos = Array.from({ length: 7 }, (_, i) => platilloBase({ id: `PL${i}` }));
    const variantes = platillos.map((p, i) =>
      varianteBase({
        id: `V${i}`,
        idPlatillo: p.id,
        alergenos: ["lácteos"],
        contieneLacteos: true,
      }),
    );
    const perfil = perfilBase({ alergias: ["lácteos"] });
    const r = recomendarPlatillos(perfil, catalogoCon(platillos, variantes), {
      maxEvitar: 2,
    });
    expect(r.evitar).toHaveLength(2);
    expect(r.totalEvaluados).toBe(7);
  });

  it("totalEvaluados cuenta aptos y no aptos", () => {
    const platillos = [
      platilloBase({ id: "PL1" }),
      platilloBase({ id: "PL2" }),
      platilloBase({ id: "PL3" }),
    ];
    const variantes = [
      varianteBase({ id: "V1", idPlatillo: "PL1" }),
      varianteBase({
        id: "V2",
        idPlatillo: "PL2",
        alergenos: ["lácteos"],
        contieneLacteos: true,
      }),
      varianteBase({ id: "V3", idPlatillo: "PL3" }),
    ];
    const perfil = perfilBase({ alergias: ["lácteos"] });
    const r = recomendarPlatillos(perfil, catalogoCon(platillos, variantes));
    expect(r.totalEvaluados).toBe(3);
    expect(r.recomendados).toHaveLength(2);
    expect(r.evitar).toHaveLength(1);
  });

  it("ignora variantes cuyo platilloId no existe en el catálogo", () => {
    const platillos = [platilloBase({ id: "PL_EXISTE" })];
    const variantes = [
      varianteBase({ id: "V1", idPlatillo: "PL_EXISTE" }),
      varianteBase({ id: "V_HUERFANO", idPlatillo: "PL_NO_EXISTE" }),
    ];
    const r = recomendarPlatillos(perfilBase(), catalogoCon(platillos, variantes));
    expect(r.totalEvaluados).toBe(1);
    expect(r.recomendados).toHaveLength(1);
    expect(r.recomendados[0]?.varianteId).toBe("V1");
  });

  it("devuelve listas vacías con catálogo vacío", () => {
    const r = recomendarPlatillos(perfilBase(), catalogoCon([], []));
    expect(r.recomendados).toHaveLength(0);
    expect(r.evitar).toHaveLength(0);
    expect(r.totalEvaluados).toBe(0);
  });

  it("cuando todos los platillos están bloqueados, recomendados está vacío", () => {
    const platillos = [platilloBase({ id: "PL1" }), platilloBase({ id: "PL2" })];
    const variantes = [
      varianteBase({
        id: "V1",
        idPlatillo: "PL1",
        alergenos: ["lácteos"],
        contieneLacteos: true,
      }),
      varianteBase({
        id: "V2",
        idPlatillo: "PL2",
        alergenos: ["lácteos"],
        contieneLacteos: true,
      }),
    ];
    const perfil = perfilBase({ alergias: ["lácteos"] });
    const r = recomendarPlatillos(perfil, catalogoCon(platillos, variantes));
    expect(r.recomendados).toHaveLength(0);
    expect(r.evitar).toHaveLength(2);
  });

  it("maxEvitar por defecto es 5", () => {
    const platillos = Array.from({ length: 10 }, (_, i) => platilloBase({ id: `PL${i}` }));
    const variantes = platillos.map((p, i) =>
      varianteBase({
        id: `V${i}`,
        idPlatillo: p.id,
        alergenos: ["lácteos"],
        contieneLacteos: true,
      }),
    );
    const perfil = perfilBase({ alergias: ["lácteos"] });
    const r = recomendarPlatillos(perfil, catalogoCon(platillos, variantes));
    expect(r.evitar).toHaveLength(5);
  });
});
