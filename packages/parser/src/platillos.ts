import { parse } from "csv-parse/sync";
import { CoreError, type Platillo } from "@core/types";
import {
  parsearBoolean,
  parsearCadena,
  parsearCategoria,
  parsearNivel,
  parsearTipoEstructura,
} from "./valores.js";

type FilaCSV = Record<string, string>;

export function parsearPlatillos(csvText: string): Platillo[] {
  const filas = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as FilaCSV[];

  const platillos: Platillo[] = [];
  const errores: string[] = [];

  filas.forEach((fila, i) => {
    const numFila = i + 2;
    try {
      platillos.push({
        id: parsearCadena(fila["id_platillo"], "id_platillo"),
        nombre: parsearCadena(fila["nombre_es"], "nombre_es"),
        categoria: parsearCategoria(fila["categoria"], "categoria"),
        subcategoria: parsearCadena(fila["subcategoria"], "subcategoria"),
        estadoTipico: parsearCadena(fila["estado_tipico"], "estado_tipico"),
        regionTipica: parsearCadena(fila["region_tipica"], "region_tipica"),
        descripcion: parsearCadena(fila["descripcion_es"], "descripcion_es"),
        tipoEstructura: parsearTipoEstructura(fila["tipo_estructura"], "tipo_estructura"),
        personalizable: parsearBoolean(fila["personalizable"], "personalizable"),
        nivelPicanteBase: parsearNivel(fila["nivel_picante_base"], "nivel_picante_base"),
        riesgoDigestivoBase: parsearNivel(fila["riesgo_digestivo_base"], "riesgo_digestivo_base"),
        notaCultural: parsearCadena(fila["nota_cultural_es"], "nota_cultural_es"),
        recomendacionTurista: parsearCadena(
          fila["recomendacion_turista_es"],
          "recomendacion_turista_es",
        ),
        activo: parsearBoolean(fila["activo"], "activo"),
      });
    } catch (e) {
      errores.push(`Fila ${numFila}: ${(e as Error).message}`);
    }
  });

  if (errores.length > 0) {
    throw new CoreError(
      "PARSER",
      `Errores parseando platillos.csv (${errores.length}):\n${errores.join("\n")}`,
    );
  }

  return platillos;
}
