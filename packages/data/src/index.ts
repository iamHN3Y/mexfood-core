export { crearClienteSupabase, crearDataClient } from "./cliente.js";
export type { ConfigDataClient, DataClient } from "./cliente.js";

export { fetchCatalogo } from "./catalogo.js";
export {
  fetchCatalogoConCache,
  CLAVE_CACHE,
  TTL_DIAS_DEFAULT,
} from "./cache.js";
export type { OpcionesCache, StorageAdapter } from "./cache.js";

export { registrarFeedback } from "./feedback.js";

export { fetchMenuCache, guardarMenuCache } from "./menu-cache.js";
export type { EntradaMenuCache } from "./menu-cache.js";

export { filaAPlatillo, filaAVariante } from "./mapeo.js";
export type { FilaPlatillo, FilaVariante } from "./mapeo.js";
