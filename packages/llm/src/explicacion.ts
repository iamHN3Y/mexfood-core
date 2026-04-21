import type { Explicacion, Perfil, Platillo, Recomendacion, Variante } from "@core/types";
import type { LlmClient } from "./cliente.js";
import { plantillaExplicacion } from "./plantillas.js";

export async function generarExplicacion(
  cliente: LlmClient,
  perfil: Perfil,
  recomendacion: Recomendacion,
  platillo: Platillo,
  variante: Variante,
): Promise<Explicacion> {
  const res = await cliente.invocar({
    accion: "explicar",
    datos: { perfil, recomendacion, platillo, variante },
  });

  if (!res.ok) {
    return plantillaExplicacion(recomendacion, platillo, variante);
  }

  const explicacion = parsearExplicacion(res.datos);
  if (!explicacion) {
    return plantillaExplicacion(recomendacion, platillo, variante);
  }
  return explicacion;
}

function parsearExplicacion(datos: unknown): Explicacion | null {
  if (typeof datos !== "object" || datos === null) return null;
  const obj = datos as Record<string, unknown>;
  if (typeof obj.texto !== "string" || obj.texto.trim() === "") return null;

  const explicacion: Explicacion = {
    texto: obj.texto,
    fuente: "llm",
  };
  if (typeof obj.tipCultural === "string" && obj.tipCultural.trim() !== "") {
    explicacion.tipCultural = obj.tipCultural;
  }
  if (typeof obj.advertencia === "string" && obj.advertencia.trim() !== "") {
    explicacion.advertencia = obj.advertencia;
  }
  return explicacion;
}
