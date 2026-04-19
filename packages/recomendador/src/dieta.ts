import type { Dieta, Variante } from "@core/types";

export type DietaEfectiva = "vegano" | "pescetariano" | "vegetariano" | "omnivoro";

export function dietaEfectiva(dieta: Dieta): DietaEfectiva {
  if (dieta.vegano) return "vegano";
  if (dieta.pescetariano) return "pescetariano";
  if (dieta.vegetariano) return "vegetariano";
  return "omnivoro";
}

export type ResultadoDieta = { ok: true } | { ok: false; razon: string };

export function cumpleDieta(dieta: Dieta, v: Variante): ResultadoDieta {
  switch (dietaEfectiva(dieta)) {
    case "vegano":
      return v.aptoVegano ? { ok: true } : { ok: false, razon: "No es apto para dieta vegana" };

    case "pescetariano":
      if (v.aptoVegetariano) return { ok: true };
      if (v.contieneCerdo)
        return { ok: false, razon: "Contiene cerdo (no apto para pescetariano)" };
      if (v.contieneMariscos) return { ok: true };
      return {
        ok: false,
        razon: "Contiene carne que no es pescado ni marisco",
      };

    case "vegetariano":
      return v.aptoVegetariano
        ? { ok: true }
        : { ok: false, razon: "No es apto para dieta vegetariana" };

    case "omnivoro":
      return { ok: true };
  }
}
