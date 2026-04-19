import { readFile } from "node:fs/promises";
import type { Catalogo } from "@core/types";
import { parsearPlatillos } from "./platillos.js";
import { parsearVariantes } from "./variantes.js";

export function parsearCatalogo(platillosCsv: string, variantesCsv: string): Catalogo {
  return {
    platillos: parsearPlatillos(platillosCsv),
    variantes: parsearVariantes(variantesCsv),
  };
}

export async function cargarCatalogoDesdeArchivos(
  rutaPlatillos: string,
  rutaVariantes: string,
): Promise<Catalogo> {
  const [platillosCsv, variantesCsv] = await Promise.all([
    readFile(rutaPlatillos, "utf-8"),
    readFile(rutaVariantes, "utf-8"),
  ]);
  return parsearCatalogo(platillosCsv, variantesCsv);
}
