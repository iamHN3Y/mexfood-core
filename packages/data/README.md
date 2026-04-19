# @core/data

Cliente de Supabase para el runtime del cliente (app móvil). Expone tres
operaciones del contrato: leer catálogo, leer catálogo con cache, y registrar
feedback.

**Quién lo usa:** el front, al arrancar la app (para cargar catálogo) y después
del feedback del usuario. En dev también lo usan los tests unitarios del
paquete mismo.

**Dependencias:** `@core/types`, `@supabase/supabase-js`.

---

## API pública

### Camino normal: `crearDataClient`

Es el camino que usa el front. Una sola llamada entrega un objeto con todos los
métodos del contrato ya bindeados al cliente de Supabase.

```typescript
import { crearDataClient } from "@core/data";
import AsyncStorage from "@react-native-async-storage/async-storage";

const data = crearDataClient({
  url: process.env.SUPABASE_URL!,
  anonKey: process.env.SUPABASE_ANON_KEY!,
});

const catalogo = await data.fetchCatalogoConCache(AsyncStorage);
await data.registrarFeedback("VAR042", true);
```

El tipo `DataClient`:

```typescript
interface DataClient {
  fetchCatalogo(): Promise<Catalogo>;
  fetchCatalogoConCache(
    storage: StorageAdapter,
    opciones?: { ttlDias?: number; forzarRefetch?: boolean },
  ): Promise<Catalogo>;
  registrarFeedback(
    varianteId: string,
    util: boolean,
    perfilHash?: string,
  ): Promise<void>;
}
```

### Camino primitivo (para tests o casos avanzados)

Cada método se exporta también como función que acepta un `SupabaseClient`
explícito:

```typescript
import { fetchCatalogo, registrarFeedback } from "@core/data";
const catalogo = await fetchCatalogo(supabaseClient);
```

Los tests del paquete lo usan con un fake de Supabase para evitar red.

---

## `StorageAdapter` (inyección de AsyncStorage)

`@core/data` no conoce React Native. El front adapta su `AsyncStorage` al
shape mínimo que necesitamos:

```typescript
interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
```

`AsyncStorage` de `@react-native-async-storage/async-storage` ya cumple este
shape; se pasa directo.

---

## Comportamiento del cache

- **Clave:** `core.catalogo.v1` (si cambiamos el shape del catálogo, subimos a
  `v2` para invalidar).
- **TTL default:** 7 días. Override con `{ ttlDias: N }`.
- **Force refresh:** `{ forzarRefetch: true }` ignora cache fresco.
- **Fallback degradado:** si Supabase cae y hay cache (aunque esté expirada),
  se devuelve la cache. El front sigue funcionando offline con catálogo
  "viejo". Si no hay cache, se lanza `CoreError`.
- Si `forzarRefetch: true` y Supabase falla, **no** se usa el fallback
  (el front pidió explícitamente fresco).

---

## Errores

Todos los errores lanzados heredan de `CoreError` (de `@core/types`):

```typescript
class CoreError extends Error {
  code: "NETWORK" | "SUPABASE" | "LLM_TIMEOUT" | ...;
  recoverable: boolean;
}
```

- `fetchCatalogo`/`fetchCatalogoConCache`: lanzan `CoreError` si hay error
  (red o permisos RLS mal configurados).
- `registrarFeedback`: **nunca lanza**. Loggea `console.warn` y resuelve. No
  queremos tumbar la UX por un insert fallido.

---

## Mapeo de columnas

Supabase guarda `snake_case`; el contrato usa `camelCase`. La conversión vive
en `src/mapeo.ts`:

| Columna DB              | Campo TS           |
| ----------------------- | ------------------ |
| `id_platillo`           | `id`               |
| `nombre_es`             | `nombre`           |
| `estado_tipico`         | `estadoTipico`     |
| `tipo_estructura`       | `tipoEstructura`   |
| `ingredientes_es` (JSONB)| `ingredientes`    |
| `alergenos` (JSONB)     | `alergenos`        |
| `contiene_cerdo`        | `contieneCerdo`    |
| …                       | …                  |

Si agregamos columnas nuevas, hay que tocar: schema SQL (`supabase/migrations/`),
mapeo en `src/mapeo.ts`, y el seed (`scripts/seed-supabase.ts`).

---

## Tests

```bash
npm test -- --project @core/data
```

30 tests con fakes de Supabase y storage — **no tocan red ni disco**:

- `mapeo.test.ts`: snake_case → camelCase, validación de arrays JSONB.
- `catalogo.test.ts`: éxito, errores de Supabase, datos corruptos, `data: null`.
- `cache.test.ts`: hit fresco, miss, stale, TTL custom, `forzarRefetch`,
  cache corrupta, fallback degradado, errores de storage.
- `feedback.test.ts`: insert OK, con `perfil_hash`, errores silenciados.
