import type { Perfil, Variante } from "@core/types";
import { cumpleDieta } from "./dieta.js";

export interface ResultadoHardFilter {
  apto: boolean;
  razonBloqueo?: string;
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function alergenosEnConflicto(perfil: Perfil, v: Variante): string[] {
  if (perfil.alergias.length === 0 || v.alergenos.length === 0) return [];
  const alergenosNorm = v.alergenos.map(normalizar);
  const conflictos: string[] = [];
  for (const alergia of perfil.alergias) {
    const norm = normalizar(alergia);
    if (norm === "") continue;
    if (alergenosNorm.some((a) => a === norm || a.includes(norm) || norm.includes(a))) {
      conflictos.push(alergia);
    }
  }
  return conflictos;
}

export function aplicarHardFilters(perfil: Perfil, v: Variante): ResultadoHardFilter {
  const conflictos = alergenosEnConflicto(perfil, v);
  if (conflictos.length > 0) {
    return {
      apto: false,
      razonBloqueo: `Contiene alergeno: ${conflictos.join(", ")}`,
    };
  }

  const dietaResult = cumpleDieta(perfil.dieta, v);
  if (!dietaResult.ok) {
    return { apto: false, razonBloqueo: dietaResult.razon };
  }

  if (perfil.restricciones.sinGluten && v.contieneGluten) {
    return { apto: false, razonBloqueo: "Contiene gluten" };
  }
  if (perfil.restricciones.sinLacteos && v.contieneLacteos) {
    return { apto: false, razonBloqueo: "Contiene lácteos" };
  }

  if (perfil.evitaCerdo && v.contieneCerdo) {
    return { apto: false, razonBloqueo: "Contiene cerdo" };
  }
  if (perfil.evitaMariscos && v.contieneMariscos) {
    return { apto: false, razonBloqueo: "Contiene mariscos" };
  }
  if (perfil.evitaAlcohol && v.contieneAlcohol) {
    return { apto: false, razonBloqueo: "Contiene alcohol" };
  }

  return { apto: true };
}
