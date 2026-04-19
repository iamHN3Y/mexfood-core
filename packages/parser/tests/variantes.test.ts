import { CoreError } from "@core/types";
import { describe, expect, it } from "vitest";
import { parsearVariantes } from "../src/variantes.js";

const HEADER =
  "id_variante,id_platillo,nombre_variante_es,tipo_variante,ingredientes_es,alergenos,contiene_cerdo,contiene_mariscos,contiene_lacteos,contiene_gluten,contiene_alcohol,apto_vegetariano,apto_vegano,nivel_picante,riesgo_digestivo,observaciones_es";

const FILA_VALIDA =
  'VAR001,PL001,quesadilla de queso,relleno_queso,"[""tortilla de maíz"", ""queso Oaxaca""]","[""lácteos""]",false,false,true,false,false,true,false,bajo,medio,Una observación';

describe("parsearVariantes", () => {
  it("parsea ingredientes y alergenos como arrays reales", () => {
    const [v] = parsearVariantes(`${HEADER}\n${FILA_VALIDA}`);
    expect(v?.ingredientes).toEqual(["tortilla de maíz", "queso Oaxaca"]);
    expect(v?.alergenos).toEqual(["lácteos"]);
  });

  it("produce el shape completo de Variante", () => {
    const [v] = parsearVariantes(`${HEADER}\n${FILA_VALIDA}`);
    expect(v).toEqual({
      id: "VAR001",
      idPlatillo: "PL001",
      nombre: "quesadilla de queso",
      tipoVariante: "relleno_queso",
      ingredientes: ["tortilla de maíz", "queso Oaxaca"],
      alergenos: ["lácteos"],
      contieneCerdo: false,
      contieneMariscos: false,
      contieneLacteos: true,
      contieneGluten: false,
      contieneAlcohol: false,
      aptoVegetariano: true,
      aptoVegano: false,
      nivelPicante: "bajo",
      riesgoDigestivo: "medio",
      observaciones: "Una observación",
    });
  });

  it("acepta observaciones vacías", () => {
    const fila = FILA_VALIDA.replace(",Una observación", ",");
    const [v] = parsearVariantes(`${HEADER}\n${fila}`);
    expect(v?.observaciones).toBe("");
  });

  it("acepta arrays JSON vacíos en alergenos", () => {
    const fila = FILA_VALIDA.replace('"[""lácteos""]"', '"[]"');
    const [v] = parsearVariantes(`${HEADER}\n${fila}`);
    expect(v?.alergenos).toEqual([]);
  });

  it("lanza CoreError si ingredientes_es no es JSON válido", () => {
    const fila = FILA_VALIDA.replace('"[""tortilla de maíz"", ""queso Oaxaca""]"', "no-json");
    expect(() => parsearVariantes(`${HEADER}\n${fila}`)).toThrow(CoreError);
  });

  it("lanza si un flag booleano no es true/false", () => {
    const fila = FILA_VALIDA.replace(",true,false,bajo", ",maybe,false,bajo");
    expect(() => parsearVariantes(`${HEADER}\n${fila}`)).toThrow(/apto_vegetariano/);
  });

  it("lanza si nivel_picante no es uno de los permitidos", () => {
    const fila = FILA_VALIDA.replace(",bajo,medio,", ",extremo,medio,");
    expect(() => parsearVariantes(`${HEADER}\n${fila}`)).toThrow(/bajo\|medio\|alto/);
  });
});
