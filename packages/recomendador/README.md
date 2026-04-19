# @core/recomendador

Motor de reglas puro (sin I/O, sincrónico) que decide qué platillos son aptos
para un perfil y —próximamente— les asigna un score.

**Estado actual (Día 2):** solo **hard filters** (bloqueos binarios). El
scoring, soft filters y recomendación ordenada llegan en Día 3+.

**Quién lo usa:** el front, cada vez que hay que mostrar recomendaciones o el
detalle de un platillo.

**Dependencias:** solo `@core/types`. Cero dependencias externas — a propósito.

---

## API pública actual

```typescript
import { aplicarHardFilters, cumpleDieta, dietaEfectiva } from "@core/recomendador";
```

### `aplicarHardFilters(perfil, variante)`

Evalúa una variante contra los bloqueos duros del perfil:

```typescript
interface ResultadoHardFilter {
  apto: boolean;
  razonBloqueo?: string; // solo si apto === false
}

aplicarHardFilters(perfil, variante);
// { apto: true }
// o: { apto: false, razonBloqueo: "Contiene cerdo" }
```

Orden de evaluación (primera razón que bloquee es la que se reporta):

1. **Alergias** (`perfil.alergias` contra `variante.alergenos`,
   normalizando acentos y case).
2. **Dieta** (vegano / vegetariano / pescetariano — ver precedencia abajo).
3. **Restricciones médicas** (`sinGluten`, `sinLacteos`).
4. **Evitación por preferencia/religión** (`evitaCerdo`, `evitaMariscos`,
   `evitaAlcohol`).

### `dietaEfectiva(dieta)` y `cumpleDieta(dieta, variante)`

Resuelven la precedencia entre los tres flags de dieta (que son
independientes en el perfil, no mutuamente excluyentes):

```typescript
dietaEfectiva({ vegano: true, pescetariano: true, vegetariano: false });
// → "vegano" (el más estricto siempre gana)

dietaEfectiva({ vegano: false, pescetariano: true, vegetariano: true });
// → "pescetariano" (permite pescado; contrato §1.2)
```

Reglas (según [API_CONTRACT.md §1.2](../../API_CONTRACT.md)):

| vegano | pescetariano | vegetariano  | Efectiva       |
| ------ | ------------ | ------------ | -------------- |
| ✅     | (cualquiera) | (cualquiera) | `vegano`       |
| ❌     | ✅           | (cualquiera) | `pescetariano` |
| ❌     | ❌           | ✅           | `vegetariano`  |
| ❌     | ❌           | ❌           | `omnivoro`     |

---

## Decisiones de diseño no obvias

### Pescetariano sin flag de "contiene carne roja"

El CSV solo tiene `contiene_cerdo` y `contiene_mariscos`, no un flag genérico
de carne. La aproximación para pescetariano:

- Si `aptoVegetariano === true` → apto.
- Si `contieneCerdo === true` → bloquea (cerdo es carne).
- Si `contieneMariscos === true` → apto (asumimos que lo no-vegetariano es
  mariscos).
- Resto → bloquea asumiendo "tiene carne no identificada".

Edge case que cae por las grietas: platillo con mariscos **y** carne roja
(p.ej. mar y tierra). En nuestro dataset esos son raros. Si aparece uno, se
pasaría por apto erróneamente.

### Match de alergenos

Normalizamos ambos lados (lowercase + strip acentos + trim) y hacemos match
si alguna de las cadenas contiene a la otra. Así `"lácteos"` matchea
`"lacteos"`, `"LACTEOS"`, y `"soya"` matchea `"salsa de soya"`.
Strings vacíos o solo espacios en `perfil.alergias` se ignoran.

### Razones en español

Las `razonBloqueo` están hardcodeadas en español. El front las muestra tal
cual o las pasa al LLM para traducir. No intentamos i18n acá — la capa de
presentación es responsabilidad del front.

---

## Tests

```bash
npm test -- --project @core/recomendador
```

42 tests:

- `dieta.test.ts` (13): precedencia y combinaciones.
- `hard-filters.test.ts` (29): alergias, dieta, restricciones, evitación,
  prioridad de reporte, casos complejos realistas (ej. "musulmán estricto en
  taco al pastor", "celíaco pescetariano en tacos de camarón").

---

## Qué falta (próximo)

- `calcularMatchScore(perfil, variante, platillo): Recomendacion` —
  soft filters + score 0-100 + etiqueta y color de semáforo.
- `recomendarPlatillos(perfil, catalogo, opciones): ResultadoRecomendacion` —
  ordena, diversifica, separa recomendados de "evitar".

Firmas finales en [API_CONTRACT.md §3](../../API_CONTRACT.md).
