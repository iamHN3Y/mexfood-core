# @core/recomendador

Motor de reglas puro (sin I/O, sincrónico) que decide qué platillos son aptos
para un perfil, les asigna un score 0-100 y los ordena con un semáforo.

**Estado actual (Día 3):** hard filters + scoring + recomendación ordenada
con diversificación y listas de "evitar". Feature-complete para el MVP.

**Quién lo usa:** el front, cada vez que hay que mostrar recomendaciones o el
detalle de un platillo.

**Dependencias:** solo `@core/types`. Cero dependencias externas — a propósito.

---

## API pública

```typescript
import {
  aplicarHardFilters,
  calcularMatchScore,
  cumpleDieta,
  dietaEfectiva,
  etiquetaYColor,
  PESOS,
  recomendarPlatillos,
  UMBRALES,
} from "@core/recomendador";
```

### `recomendarPlatillos(perfil, catalogo, opciones?)`

El punto de entrada principal. Evalúa todas las variantes del catálogo contra
el perfil, las ordena por score y devuelve las mejores + una lista de
"evitar".

```typescript
const resultado = recomendarPlatillos(perfil, catalogo, {
  topN: 5, // default 5
  diversificar: true, // default true — máx 1 variante por platilloId
  incluirEvitar: true, // default true
  maxEvitar: 5, // default 5
});

// resultado: {
//   recomendados: Recomendacion[],   // aptos, ordenados score desc
//   evitar: Recomendacion[],          // bloqueados por hard filters
//   totalEvaluados: number,
// }
```

### `calcularMatchScore(perfil, variante, platillo)`

Devuelve una `Recomendacion` individual con score 0-100, etiqueta y color.
Corre hard filters primero; si bloquea, devuelve `apto: false` con score 0.

```typescript
const r = calcularMatchScore(perfil, variante, platillo);
// {
//   varianteId, platilloId,
//   score: 0-100,
//   apto: boolean,
//   etiqueta: "Muy recomendable" | "Compatible con precauciones" | "Con reservas" | "No recomendable",
//   color: "verde" | "amarillo" | "naranja" | "rojo",
//   razonesPositivas: string[],
//   razonesNegativas: string[],
//   advertencias: string[],
//   razonBloqueo?: string,           // solo si apto === false
// }
```

### `aplicarHardFilters(perfil, variante)`

Evalúa los bloqueos duros. Orden de evaluación (primera razón que bloquee es
la que se reporta):

1. **Alergias** (normaliza acentos y case).
2. **Dieta** (vegano / vegetariano / pescetariano — ver precedencia abajo).
3. **Restricciones médicas** (`sinGluten`, `sinLacteos`).
4. **Evitación** (`evitaCerdo`, `evitaMariscos`, `evitaAlcohol`).

### `dietaEfectiva(dieta)` y `cumpleDieta(dieta, variante)`

Resuelven la precedencia entre los tres flags de dieta:

| vegano | pescetariano | vegetariano  | Efectiva       |
| ------ | ------------ | ------------ | -------------- |
| ✅     | (cualquiera) | (cualquiera) | `vegano`       |
| ❌     | ✅           | (cualquiera) | `pescetariano` |
| ❌     | ❌           | ✅           | `vegetariano`  |
| ❌     | ❌           | ❌           | `omnivoro`     |

---

## Modelo de scoring

Score parte en **100** y se ajusta con penalizaciones y bonos. Clamp final
entre 0 y 100.

### Pesos (`PESOS`, exportados por si quieres tunearlos)

| Ajuste                                  | Delta          |
| --------------------------------------- | -------------- |
| Picante `bajo` vs `medio`               | −15            |
| Picante `bajo` vs `alto`                | −30            |
| Picante `medio` vs `alto`               | −15            |
| Estómago sensible + riesgo `medio`      | −10            |
| Estómago sensible + riesgo `alto`       | −25            |
| Ingrediente a evitar (por coincidencia) | −10 (tope −30) |
| Ingrediente favorito (por coincidencia) | +5 (tope +15)  |
| Platillo típico de tu estado actual     | +10            |

### Umbrales del semáforo (`UMBRALES`)

| Score  | Color    | Etiqueta                    |
| ------ | -------- | --------------------------- |
| 80-100 | verde    | Muy recomendable            |
| 60-79  | amarillo | Compatible con precauciones |
| 40-59  | naranja  | Con reservas                |
| 0-39   | rojo     | No recomendable             |

---

## Decisiones de diseño no obvias

### Diversificación

Por defecto limitamos a 1 variante por `platilloId` en el top N — evita que
un platillo con 4 variantes bien calificadas monopolice la pantalla. Si no
hay suficientes platillos únicos para llenar el topN, se rellena con las
variantes adicionales (sin quedarse corto).

### Pescetariano sin flag de "contiene carne roja"

El CSV solo tiene `contiene_cerdo` y `contiene_mariscos`, no un flag genérico
de carne. La aproximación:

- Si `aptoVegetariano === true` → apto.
- Si `contieneCerdo === true` → bloquea (cerdo es carne).
- Si `contieneMariscos === true` → apto.
- Resto → bloquea asumiendo "tiene carne no identificada".

### Match de alergenos e ingredientes

Normalizamos ambos lados (lowercase + strip acentos + trim) y hacemos match
bidireccional por substring. Así `"lácteos"` matchea `"lacteos"`, y `"soya"`
matchea `"salsa de soya"`. Strings vacíos en arrays del perfil se ignoran.

### Razones en español

Las `razonBloqueo`, `razonesPositivas` y `razonesNegativas` están
hardcodeadas en español. El front las muestra tal cual o las pasa al LLM
para traducir. La capa de presentación es responsabilidad del front.

---

## Tests

```bash
npm test -- --project @core/recomendador
```

83 tests:

- `dieta.test.ts` (13): precedencia y combinaciones.
- `hard-filters.test.ts` (29): alergias, dieta, restricciones, evitación,
  prioridad de reporte, casos realistas.
- `score.test.ts` (27): etiquetas/umbrales, picante, digestivo, ingredientes
  evitar/favoritos con topes, bonus regional, clamp 0..100.
- `recomendar.test.ts` (14): topN, ordenamiento, diversificación,
  incluirEvitar, maxEvitar, huérfanos, catálogo vacío.

Firmas completas en [API_CONTRACT.md §3](../../API_CONTRACT.md).
