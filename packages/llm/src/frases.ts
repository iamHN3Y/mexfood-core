import type { Frase, Perfil, Platillo } from "@core/types";
import type { LlmClient } from "./cliente.js";
import { plantillaFrases } from "./plantillas.js";

export async function generarFrasesParaPedir(
  cliente: LlmClient,
  platillo: Platillo,
  perfil: Perfil,
): Promise<Frase[]> {
  const res = await cliente.invocar({
    accion: "frases",
    datos: { perfil, platillo },
  });

  if (!res.ok) {
    return plantillaFrases(platillo, perfil);
  }

  const frases = parsearFrases(res.datos);
  if (!frases || frases.length === 0) {
    return plantillaFrases(platillo, perfil);
  }
  return frases;
}

function parsearFrases(datos: unknown): Frase[] | null {
  if (typeof datos !== "object" || datos === null) return null;
  const obj = datos as Record<string, unknown>;
  if (!Array.isArray(obj.frases)) return null;

  const frases: Frase[] = [];
  for (const item of obj.frases) {
    if (typeof item !== "object" || item === null) return null;
    const f = item as Record<string, unknown>;
    if (
      typeof f.fraseEs !== "string" ||
      typeof f.traduccion !== "string" ||
      typeof f.pronunciacionFonetica !== "string"
    ) {
      return null;
    }
    frases.push({
      fraseEs: f.fraseEs,
      traduccion: f.traduccion,
      pronunciacionFonetica: f.pronunciacionFonetica,
    });
  }
  return frases;
}
