# @core/parser

Convierte los CSV del dataset (`data/platillos.csv`, `data/variantes_platillo.csv`)
en el shape `Catalogo` que usa el resto del sistema.

**Quién lo usa:** `scripts/seed-supabase.ts`. El front/producción no lo usa —
en runtime el catálogo se lee de Supabase vía `@core/data`.

**Dependencias:** `@core/types`, `csv-parse` (runtime), `node:fs/promises`
(carga de archivos).

---

## API pública

```typescript
import {
  parsearCatalogo,
  cargarCatalogoDesdeArchivos,
  parsearPlatillos,
  parsearVariantes,
} from "@core/parser";
```

### `cargarCatalogoDesdeArchivos(rutaPlatillos, rutaVariantes)`

Helper: lee ambos archivos y devuelve `Promise<Catalogo>`.

```typescript
const cat = await cargarCatalogoDesdeArchivos("data/platillos.csv", "data/variantes_platillo.csv");
// cat.platillos.length === 214
// cat.variantes.length === 190
```

### `parsearCatalogo(csvPlatillos, csvVariantes)`

Misma idea pero recibe strings en lugar de rutas. Útil para tests.

### `parsearPlatillos(csv) / parsearVariantes(csv)`

Parsean una sola tabla. Usar cuando solo se necesita una.

---

## Qué valida

Cada columna se valida contra enums controlados (`categoria`, `nivel`,
`tipo_estructura`) y tipos (booleanos `true`/`false`, arrays JSON bien
formados). Los errores **se acumulan** y se lanzan en un solo `CoreError`
con `code: "PARSER"`, indicando fila y campo:

```
Fila 17: categoria='snack' inválida (esperaba: platillo fuerte, antojito, ...)
Fila 23: activo='maybe' no es booleano (true|false)
(2) errores en total
```

Esto permite corregir el CSV de una pasada en lugar de ir error por error.

---

## Tests

```bash
npm test -- --project @core/parser
```

60 tests: valores primitivos, filas, agregación de errores, y un test de
integración que carga los CSV reales y verifica conteos (214 / 190) y
consistencia referencial (toda `Variante.idPlatillo` existe en `platillos`).
