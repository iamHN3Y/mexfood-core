import type { Categoria, Nivel, TipoEstructura } from "@core/types";

export const NIVELES: readonly Nivel[] = ["bajo", "medio", "alto"] as const;

export const CATEGORIAS: readonly Categoria[] = [
  "platillo fuerte",
  "antojito",
  "sopa/caldo",
  "botana",
  "bebida",
  "postre",
  "desayuno",
  "pan/antojito dulce",
] as const;

export const TIPOS_ESTRUCTURA: readonly TipoEstructura[] = [
  "cerrado_con_relleno",
  "abierto_con_toppings",
  "caldo",
  "guiso",
  "pan_relleno",
  "tortilla_rellena",
  "antojito_frito",
  "bebida",
  "postre",
] as const;

export function parsearBoolean(valor: string | undefined, campo: string): boolean {
  if (valor === undefined) throw new Error(`Campo "${campo}" faltante`);
  const v = valor.trim().toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  throw new Error(`Campo "${campo}" debe ser "true" o "false", recibí "${valor}"`);
}

export function parsearJsonArray(valor: string | undefined, campo: string): string[] {
  if (valor === undefined || valor.trim() === "") return [];
  let parseado: unknown;
  try {
    parseado = JSON.parse(valor);
  } catch (e) {
    throw new Error(`Campo "${campo}" no es JSON válido: ${(e as Error).message}`);
  }
  if (!Array.isArray(parseado)) {
    throw new Error(`Campo "${campo}" no es un array JSON`);
  }
  if (!parseado.every((x): x is string => typeof x === "string")) {
    throw new Error(`Campo "${campo}" contiene elementos que no son strings`);
  }
  return parseado;
}

export function parsearEnum<T extends string>(
  valor: string | undefined,
  permitidos: readonly T[],
  campo: string,
): T {
  if (valor === undefined || valor.trim() === "") {
    throw new Error(`Campo "${campo}" faltante`);
  }
  const v = valor.trim();
  if (!permitidos.includes(v as T)) {
    throw new Error(`Campo "${campo}" debe ser uno de [${permitidos.join("|")}], recibí "${v}"`);
  }
  return v as T;
}

export function parsearNivel(valor: string | undefined, campo: string): Nivel {
  return parsearEnum(valor, NIVELES, campo);
}

export function parsearCategoria(valor: string | undefined, campo: string): Categoria {
  return parsearEnum(valor, CATEGORIAS, campo);
}

export function parsearTipoEstructura(valor: string | undefined, campo: string): TipoEstructura {
  return parsearEnum(valor, TIPOS_ESTRUCTURA, campo);
}

export function parsearCadena(valor: string | undefined, campo: string): string {
  if (valor === undefined) throw new Error(`Campo "${campo}" faltante`);
  return valor;
}

export function parsearCadenaOpcional(valor: string | undefined): string {
  return valor ?? "";
}
