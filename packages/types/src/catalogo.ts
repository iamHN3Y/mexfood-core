import type { Nivel } from "./perfil.js";

export type TipoEstructura =
  | "cerrado_con_relleno"
  | "abierto_con_toppings"
  | "caldo"
  | "guiso"
  | "pan_relleno"
  | "tortilla_rellena"
  | "antojito_frito"
  | "bebida"
  | "postre";

export type Categoria =
  | "platillo fuerte"
  | "antojito"
  | "sopa/caldo"
  | "botana"
  | "bebida"
  | "postre"
  | "desayuno"
  | "pan/antojito dulce";

export interface Platillo {
  id: string;
  nombre: string;
  categoria: Categoria;
  subcategoria: string;
  estadoTipico: string;
  regionTipica: string;
  descripcion: string;
  tipoEstructura: TipoEstructura;
  personalizable: boolean;
  nivelPicanteBase: Nivel;
  riesgoDigestivoBase: Nivel;
  notaCultural: string;
  recomendacionTurista: string;
  activo: boolean;
}

export interface Variante {
  id: string;
  idPlatillo: string;
  nombre: string;
  tipoVariante: string;
  ingredientes: string[];
  alergenos: string[];
  contieneCerdo: boolean;
  contieneMariscos: boolean;
  contieneLacteos: boolean;
  contieneGluten: boolean;
  contieneAlcohol: boolean;
  aptoVegetariano: boolean;
  aptoVegano: boolean;
  nivelPicante: Nivel;
  riesgoDigestivo: Nivel;
  observaciones: string;
}

export interface Catalogo {
  platillos: Platillo[];
  variantes: Variante[];
}
