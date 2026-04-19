import { CoreError } from "@core/types";
import { describe, expect, it } from "vitest";
import { parsearPlatillos } from "../src/platillos.js";

const HEADER =
  "id_platillo,nombre_es,categoria,subcategoria,estado_tipico,region_tipica,descripcion_es,tipo_estructura,personalizable,nivel_picante_base,riesgo_digestivo_base,nota_cultural_es,recomendacion_turista_es,activo";

const FILA_VALIDA =
  "PL001,quesadilla,antojito,quesadilla,Ciudad de México,Centro,Descripción,tortilla_rellena,true,bajo,medio,Nota,Reco,true";

describe("parsearPlatillos", () => {
  it("parsea una fila válida al shape esperado", () => {
    const csv = `${HEADER}\n${FILA_VALIDA}`;
    const [p] = parsearPlatillos(csv);

    expect(p).toEqual({
      id: "PL001",
      nombre: "quesadilla",
      categoria: "antojito",
      subcategoria: "quesadilla",
      estadoTipico: "Ciudad de México",
      regionTipica: "Centro",
      descripcion: "Descripción",
      tipoEstructura: "tortilla_rellena",
      personalizable: true,
      nivelPicanteBase: "bajo",
      riesgoDigestivoBase: "medio",
      notaCultural: "Nota",
      recomendacionTurista: "Reco",
      activo: true,
    });
  });

  it("soporta comas dentro de campos con comillas", () => {
    const fila =
      'PL002,torta,antojito,torta,CDMX,Centro,"Pan, relleno, vegetales",pan_relleno,true,bajo,medio,Nota,Reco,true';
    const [p] = parsearPlatillos(`${HEADER}\n${fila}`);
    expect(p?.descripcion).toBe("Pan, relleno, vegetales");
  });

  it("parsea múltiples filas", () => {
    const otraFila = FILA_VALIDA.replace("PL001", "PL002").replace("quesadilla", "taco");
    const csv = `${HEADER}\n${FILA_VALIDA}\n${otraFila}`;
    expect(parsearPlatillos(csv)).toHaveLength(2);
  });

  it("lanza CoreError con código PARSER si una fila tiene categoría inválida", () => {
    const fila = FILA_VALIDA.replace(",antojito,", ",snack,");
    expect(() => parsearPlatillos(`${HEADER}\n${fila}`)).toThrow(CoreError);

    try {
      parsearPlatillos(`${HEADER}\n${fila}`);
    } catch (e) {
      expect((e as CoreError).code).toBe("PARSER");
    }
  });

  it("incluye el número de fila en el mensaje de error", () => {
    const filaMala = FILA_VALIDA.replace(",true,bajo", ",maybe,bajo");
    const csv = `${HEADER}\n${FILA_VALIDA}\n${filaMala}`;
    expect(() => parsearPlatillos(csv)).toThrow(/Fila 3/);
  });

  it("agrega todos los errores en un solo CoreError", () => {
    const mala1 = FILA_VALIDA.replace(",antojito,", ",snack,");
    const mala2 = FILA_VALIDA.replace(",true,bajo", ",maybe,bajo");
    const csv = `${HEADER}\n${mala1}\n${mala2}`;

    try {
      parsearPlatillos(csv);
      expect.fail("debió lanzar");
    } catch (e) {
      const msg = (e as CoreError).message;
      expect(msg).toContain("Fila 2");
      expect(msg).toContain("Fila 3");
      expect(msg).toContain("(2)");
    }
  });
});
