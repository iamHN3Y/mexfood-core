import type { ColorSemaforo } from "./recomendacion.js";
import type { Platillo } from "./catalogo.js";

export type FuenteExplicacion = "llm" | "plantilla";

export type ConfianzaOCR = "alta" | "media" | "baja";

export interface Explicacion {
  texto: string;
  tipCultural?: string;
  advertencia?: string;
  fuente: FuenteExplicacion;
}

export interface Frase {
  fraseEs: string;
  traduccion: string;
  pronunciacionFonetica: string;
}

export interface ItemMenuDetectado {
  textoOriginal: string;
  matchPlatillo?: Platillo;
  score?: number;
  color?: ColorSemaforo;
  motivo: string;
}

export interface AnalisisMenu {
  itemsDetectados: ItemMenuDetectado[];
  confianzaOCR: ConfianzaOCR;
}

export interface EntradaMenuCache {
  items: string[];
  confianzaOCR: ConfianzaOCR;
}
