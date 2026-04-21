export { crearLlmClient } from "./cliente.js";
export type {
  AccionLlm,
  ConfiguracionLlmClient,
  LlmClient,
  PayloadLlm,
  RespuestaLlm,
  RespuestaLlmError,
  RespuestaLlmOk,
} from "./cliente.js";

export { plantillaExplicacion, plantillaFrases } from "./plantillas.js";

export { generarExplicacion } from "./explicacion.js";
export { generarFrasesParaPedir } from "./frases.js";

export { analizarMenu, plantillaAnalisisMenu } from "./analizar-menu.js";
export type { OpcionesAnalizarMenu } from "./analizar-menu.js";

export { similitud, normalizar, encontrarMejorMatch } from "./matcher.js";
export type { MejorMatch } from "./matcher.js";
