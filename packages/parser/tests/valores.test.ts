import { describe, expect, it } from "vitest";
import {
  CATEGORIAS,
  NIVELES,
  TIPOS_ESTRUCTURA,
  parsearBoolean,
  parsearCadena,
  parsearCadenaOpcional,
  parsearCategoria,
  parsearEnum,
  parsearJsonArray,
  parsearNivel,
  parsearTipoEstructura,
} from "../src/valores.js";

describe("parsearBoolean", () => {
  it('convierte "true" a true', () => {
    expect(parsearBoolean("true", "x")).toBe(true);
  });

  it('convierte "false" a false', () => {
    expect(parsearBoolean("false", "x")).toBe(false);
  });

  it("es case-insensitive y tolera espacios", () => {
    expect(parsearBoolean("TRUE", "x")).toBe(true);
    expect(parsearBoolean(" False ", "x")).toBe(false);
  });

  it("lanza si el valor no es booleano válido", () => {
    expect(() => parsearBoolean("yes", "activo")).toThrow(/"activo"/);
    expect(() => parsearBoolean("1", "activo")).toThrow();
    expect(() => parsearBoolean("", "activo")).toThrow();
  });

  it("lanza si el valor es undefined", () => {
    expect(() => parsearBoolean(undefined, "activo")).toThrow(/"activo" faltante/);
  });
});

describe("parsearJsonArray", () => {
  it("parsea un array JSON de strings", () => {
    expect(parsearJsonArray('["a","b","c"]', "x")).toEqual(["a", "b", "c"]);
  });

  it("trata string vacío o whitespace como array vacío", () => {
    expect(parsearJsonArray("", "x")).toEqual([]);
    expect(parsearJsonArray("   ", "x")).toEqual([]);
    expect(parsearJsonArray(undefined, "x")).toEqual([]);
  });

  it("parsea arrays con acentos y caracteres especiales", () => {
    expect(parsearJsonArray('["flor de calabaza", "epazote"]', "x")).toEqual([
      "flor de calabaza",
      "epazote",
    ]);
  });

  it("lanza si no es JSON válido", () => {
    expect(() => parsearJsonArray("not json", "ingredientes")).toThrow(/"ingredientes"/);
  });

  it("lanza si el JSON no es un array", () => {
    expect(() => parsearJsonArray('{"a":1}', "x")).toThrow(/array/);
  });

  it("lanza si el array tiene elementos no-string", () => {
    expect(() => parsearJsonArray("[1, 2, 3]", "x")).toThrow(/strings/);
    expect(() => parsearJsonArray('["a", 2]', "x")).toThrow(/strings/);
  });
});

describe("parsearEnum", () => {
  const colores = ["rojo", "verde", "azul"] as const;

  it("devuelve el valor si está en los permitidos", () => {
    expect(parsearEnum("rojo", colores, "x")).toBe("rojo");
  });

  it("hace trim antes de comparar", () => {
    expect(parsearEnum("  verde  ", colores, "x")).toBe("verde");
  });

  it("lanza si el valor no está permitido, listando las opciones", () => {
    expect(() => parsearEnum("morado", colores, "color")).toThrow(/rojo\|verde\|azul/);
  });

  it("lanza si el valor es undefined o vacío", () => {
    expect(() => parsearEnum(undefined, colores, "color")).toThrow(/faltante/);
    expect(() => parsearEnum("", colores, "color")).toThrow(/faltante/);
  });
});

describe("parsearNivel", () => {
  it.each(NIVELES)("acepta %s", (nivel) => {
    expect(parsearNivel(nivel, "x")).toBe(nivel);
  });

  it("rechaza niveles fuera del enum", () => {
    expect(() => parsearNivel("extremo", "picante")).toThrow(/bajo\|medio\|alto/);
  });
});

describe("parsearCategoria", () => {
  it.each(CATEGORIAS)("acepta %s", (cat) => {
    expect(parsearCategoria(cat, "x")).toBe(cat);
  });

  it("rechaza categorías desconocidas", () => {
    expect(() => parsearCategoria("snack", "categoria")).toThrow();
  });
});

describe("parsearTipoEstructura", () => {
  it.each(TIPOS_ESTRUCTURA)("acepta %s", (tipo) => {
    expect(parsearTipoEstructura(tipo, "x")).toBe(tipo);
  });

  it("rechaza tipos desconocidos", () => {
    expect(() => parsearTipoEstructura("sandwich", "x")).toThrow();
  });
});

describe("parsearCadena", () => {
  it("devuelve la cadena si existe", () => {
    expect(parsearCadena("quesadilla", "nombre")).toBe("quesadilla");
  });

  it("permite cadena vacía (algunos campos lo aceptan)", () => {
    expect(parsearCadena("", "nombre")).toBe("");
  });

  it("lanza si es undefined", () => {
    expect(() => parsearCadena(undefined, "nombre")).toThrow(/"nombre" faltante/);
  });
});

describe("parsearCadenaOpcional", () => {
  it("devuelve cadena vacía si es undefined", () => {
    expect(parsearCadenaOpcional(undefined)).toBe("");
  });

  it("devuelve el valor si existe", () => {
    expect(parsearCadenaOpcional("obs")).toBe("obs");
  });
});
