import { parse } from "csv-parse/sync";
import { CoreError, type Variante } from "@core/types";
import {
  parsearBoolean,
  parsearCadena,
  parsearCadenaOpcional,
  parsearJsonArray,
  parsearNivel,
} from "./valores.js";

type FilaCSV = Record<string, string>;

export function parsearVariantes(csvText: string): Variante[] {
  const filas = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as FilaCSV[];

  const variantes: Variante[] = [];
  const errores: string[] = [];

  filas.forEach((fila, i) => {
    const numFila = i + 2;
    try {
      variantes.push({
        id: parsearCadena(fila["id_variante"], "id_variante"),
        idPlatillo: parsearCadena(fila["id_platillo"], "id_platillo"),
        nombre: parsearCadena(fila["nombre_variante_es"], "nombre_variante_es"),
        tipoVariante: parsearCadena(fila["tipo_variante"], "tipo_variante"),
        ingredientes: parsearJsonArray(fila["ingredientes_es"], "ingredientes_es"),
        alergenos: parsearJsonArray(fila["alergenos"], "alergenos"),
        contieneCerdo: parsearBoolean(fila["contiene_cerdo"], "contiene_cerdo"),
        contieneMariscos: parsearBoolean(fila["contiene_mariscos"], "contiene_mariscos"),
        contieneLacteos: parsearBoolean(fila["contiene_lacteos"], "contiene_lacteos"),
        contieneGluten: parsearBoolean(fila["contiene_gluten"], "contiene_gluten"),
        contieneAlcohol: parsearBoolean(fila["contiene_alcohol"], "contiene_alcohol"),
        aptoVegetariano: parsearBoolean(fila["apto_vegetariano"], "apto_vegetariano"),
        aptoVegano: parsearBoolean(fila["apto_vegano"], "apto_vegano"),
        nivelPicante: parsearNivel(fila["nivel_picante"], "nivel_picante"),
        riesgoDigestivo: parsearNivel(fila["riesgo_digestivo"], "riesgo_digestivo"),
        observaciones: parsearCadenaOpcional(fila["observaciones_es"]),
      });
    } catch (e) {
      errores.push(`Fila ${numFila}: ${(e as Error).message}`);
    }
  });

  if (errores.length > 0) {
    throw new CoreError(
      "PARSER",
      `Errores parseando variantes_platillo.csv (${errores.length}):\n${errores.join("\n")}`,
    );
  }

  return variantes;
}
