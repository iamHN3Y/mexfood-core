# API Contract — Core de Recomendación

**Versión:** 0.2.0 (dieta composable)

Este documento define **qué expone la capa de lógica** al front. El front importa funciones de `@core/recomendador` y `@core/data`; no conoce nada de Supabase, Gemini, ni reglas internas.

---

## 1. Tipos compartidos

### 1.1 Enums controlados

```typescript
type Nivel = "bajo" | "medio" | "alto";

type TipoEstructura =
  | "cerrado_con_relleno"
  | "abierto_con_toppings"
  | "caldo"
  | "guiso"
  | "pan_relleno"
  | "tortilla_rellena"
  | "antojito_frito"
  | "bebida"
  | "postre";

type Categoria =
  | "platillo fuerte"
  | "antojito"
  | "sopa/caldo"
  | "botana"
  | "bebida"
  | "postre"
  | "desayuno"
  | "pan/antojito dulce";

type ColorSemaforo = "verde" | "amarillo" | "naranja" | "rojo";

type IdiomaISO = "es" | "en" | "fr" | "de" | "pt" | "it" | "ja" | "ar" | "zh";
```

### 1.2 Perfil del usuario

Lo construye el onboarding del front y se pasa a cada llamada de recomendación. **Nunca se envía al backend**; vive solo en el dispositivo.

```typescript
// Identidad dietaria: lo que el usuario ES.
// Composable porque la realidad lo es (alguien puede ser
// vegetariano Y sin gluten, o pescetariano Y sin lácteos).
interface Dieta {
  vegetariano: boolean;       // no come carne ni pescado
  vegano: boolean;            // no come productos animales
  pescetariano: boolean;      // no come carne pero sí pescado/mariscos
}

// Restricciones alimentarias médicas/fisiológicas.
// Separadas de dieta porque son otra dimensión:
// alguien omnívoro puede ser celíaco.
interface Restricciones {
  sinGluten: boolean;
  sinLacteos: boolean;
}

interface Perfil {
  // Hard constraints (bloquean platillos completos)
  alergias: string[];              // ej. ["cacahuate", "nuez", "soya"]
  dieta: Dieta;
  restricciones: Restricciones;
  evitaCerdo: boolean;             // típicamente por religión/cultura
  evitaAlcohol: boolean;           // típicamente por religión/salud
  evitaMariscos: boolean;          // preferencia o alergia no listada explícitamente

  // Soft constraints (ajustan score, no bloquean)
  toleranciaPicante: Nivel;
  estomagoSensible: boolean;
  ingredientesEvitar: string[];    // preferencias de gusto, no médicas
  ingredientesFavoritos: string[];

  // Contexto
  estadoActual: string;            // ej. "Oaxaca", "Ciudad de México"
  idioma: IdiomaISO;
}
```

**Reglas de validación y precedencia de dieta** (implementadas en el motor, no responsabilidad del front):

- Si `dieta.vegano === true`, implica vegetariano. El motor trata vegano como un superset más estricto.
- Si `dieta.pescetariano === true && dieta.vegetariano === true`, **prevalece pescetariano** (se permite pescado/mariscos). Esto permite que el front ofrezca los checkboxes de forma independiente sin validar combinaciones.
- Si `dieta.vegano === true` y cualquier otro flag de dieta está en `true`, **prevalece vegano** (el más estricto gana).
- Todas las combinaciones son válidas desde el punto de vista del front; el motor resuelve ambigüedades según estas reglas.

### 1.3 Catálogo (lo que devuelve `@core/data`)

```typescript
interface Platillo {
  id: string;                      // "PL001"
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

interface Variante {
  id: string;                      // "VAR001"
  idPlatillo: string;              // FK → Platillo.id
  nombre: string;
  tipoVariante: string;
  ingredientes: string[];          // ya parseado, no string JSON
  alergenos: string[];             // ya parseado
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

interface Catalogo {
  platillos: Platillo[];
  variantes: Variante[];
}
```

### 1.4 Resultado de recomendación

```typescript
interface Recomendacion {
  varianteId: string;
  platilloId: string;
  score: number;                   // 0–100
  apto: boolean;                   // false si lo bloquearon hard filters
  etiqueta:
    | "Muy recomendable"
    | "Compatible con precauciones"
    | "Con reservas"
    | "No recomendable";
  color: ColorSemaforo;
  razonesPositivas: string[];      // en español, el front traduce si quiere
  razonesNegativas: string[];
  advertencias: string[];
  razonBloqueo?: string;           // solo si apto === false
}

interface ResultadoRecomendacion {
  recomendados: Recomendacion[];   // ordenados por score desc, top N
  evitar: Recomendacion[];         // algunos bloqueados, para educar al usuario
  totalEvaluados: number;
}
```

### 1.5 Salidas del LLM

```typescript
interface Explicacion {
  texto: string;                   // 2–3 oraciones en el idioma del perfil
  tipCultural?: string;            // opcional, una nota extra
  advertencia?: string;            // opcional, si hay algo a destacar
  fuente: "llm" | "plantilla";     // por si falló el LLM y se usó fallback
}

interface Frase {
  fraseEs: string;                 // "Sin cilantro, por favor"
  traduccion: string;              // en idioma del perfil
  pronunciacionFonetica: string;   // "Seen see-lahn-troh, por fah-vor"
}

interface AnalisisMenu {
  itemsDetectados: Array<{
    textoOriginal: string;         // como apareció en el menú
    matchPlatillo?: Platillo;      // null si no se pudo mapear
    score?: number;
    color?: ColorSemaforo;
    motivo: string;
  }>;
  confianzaOCR: "alta" | "media" | "baja";
}
```

---

## 2. Funciones expuestas por `@core/data`

### 2.1 `fetchCatalogo`

```typescript
function fetchCatalogo(): Promise<Catalogo>;
```

Descarga el catálogo completo desde Supabase. El front la llama una vez al arrancar la app.

**Errores posibles:** `NetworkError`, `SupabaseError`. Ambos extienden `Error` y tienen un campo `.code` string.

### 2.2 `fetchCatalogoConCache`

```typescript
interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

function fetchCatalogoConCache(
  storage: StorageAdapter,
  opciones?: { ttlDias?: number; forzarRefetch?: boolean }
): Promise<Catalogo>;
```

El front inyecta su `AsyncStorage` envuelto en `StorageAdapter`. Mi librería no conoce React Native. Default `ttlDias = 7`.

### 2.3 `registrarFeedback`

```typescript
function registrarFeedback(
  varianteId: string,
  util: boolean,
  perfilHash?: string              // opcional, ya hasheado
): Promise<void>;
```

Inserta feedback anónimo. Nunca incluye user_id, solo hash del perfil si se desea analytics. Errores se registran pero no se lanzan (no bloquear UX por un feedback fallido).

---

## 3. Funciones expuestas por `@core/recomendador`

### 3.1 `recomendarPlatillos` (función pura, síncrona)

```typescript
interface OpcionesRecomendacion {
  topN?: number;                   // default 5
  diversificar?: boolean;          // default true — evita top todo-tacos
  incluirEvitar?: boolean;         // default true
  maxEvitar?: number;              // default 5
}

function recomendarPlatillos(
  perfil: Perfil,
  catalogo: Catalogo,
  opciones?: OpcionesRecomendacion
): ResultadoRecomendacion;
```

**Pura y síncrona.** No hace I/O. No throws (si perfil o catálogo son inválidos, devuelve `ResultadoRecomendacion` vacío con warning en consola — criticable, lo discutimos).

**Tiempo esperado:** <50 ms para 190 variantes.

### 3.2 `calcularMatchScore` (función pura, expuesta para debugging / detalle)

```typescript
function calcularMatchScore(
  perfil: Perfil,
  variante: Variante,
  platillo: Platillo
): Recomendacion;
```

Útil si el front necesita el score de un platillo individual (ej. pantalla de detalle que muestra un platillo no top-5).

### 3.3 `generarExplicacion` (async, llama al LLM vía Edge Function)

```typescript
function generarExplicacion(
  perfil: Perfil,
  recomendacion: Recomendacion,
  platillo: Platillo,
  variante: Variante
): Promise<Explicacion>;
```

Llama al Edge Function proxy de Gemini. **Siempre resuelve**, nunca rechaza. Si el LLM falla, devuelve `Explicacion` construida con plantillas y `fuente: "plantilla"`. El front puede mostrar un indicador sutil.

**Timeout:** 8 segundos. **Cache:** hit ratio esperado alto (mismos pares perfil–platillo).

### 3.4 `generarFrasesParaPedir` (async)

```typescript
function generarFrasesParaPedir(
  platillo: Platillo,
  perfil: Perfil
): Promise<Frase[]>;
```

Devuelve 3 frases útiles. Mismas garantías que `generarExplicacion`.

### 3.5 `analizarMenu` (async, feature avanzada — puede no estar en v1)

```typescript
function analizarMenu(
  imagenBase64: string,
  perfil: Perfil,
  catalogo: Catalogo
): Promise<AnalisisMenu>;
```

---

## 4. Errores y manejo

Todos los errores lanzados heredan de `CoreError`:

```typescript
class CoreError extends Error {
  code: string;                    // "NETWORK" | "SUPABASE" | "LLM_TIMEOUT" | ...
  recoverable: boolean;            // si true, el front puede reintentar
}
```

Funciones `async` de LLM **no lanzan**; degradan a plantilla. Funciones `async` de data **sí lanzan** para que el front decida qué hacer (mostrar error, reintentar).

---

## 5. Convenciones

- **Idioma del contenido:** todas las strings del catálogo están en español. Las respuestas del LLM van en `perfil.idioma`.
- **Colores del semáforo:** decisión del motor, no del front. El front solo renderiza.
- **Razones en prosa:** strings listas para mostrar, en español. El front las traduce solo si decide hacerlo (recomiendo dejarlas en español y que el LLM traduzca en la explicación completa).
- **Nunca hay user_id.** Todo es anónimo. El perfil nunca sale del dispositivo excepto como entrada a `generarExplicacion`, que lo manda al Edge Function pero no lo persiste.

---

## 6. Versionado

Rompemos compatibilidad solo antes del congelamiento en día 5. Después de día 5, cualquier cambio es aditivo o requiere negociación.

---

## 7. Ejemplo completo de uso (para mockeo en front)

```typescript
import { fetchCatalogoConCache, registrarFeedback } from "@core/data";
import {
  recomendarPlatillos,
  generarExplicacion,
  generarFrasesParaPedir,
} from "@core/recomendador";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Al arrancar la app
const catalogo = await fetchCatalogoConCache(AsyncStorage);
// Después del onboarding
const perfil: Perfil = {
  alergias: ["cacahuate"],
  dieta: {
    vegetariano: true,
    vegano: false,
    pescetariano: false,
  },
  restricciones: {
    sinGluten: false,
    sinLacteos: false,
  },
  evitaCerdo: true,
  evitaMariscos: false,
  evitaAlcohol: false,
  toleranciaPicante: "bajo",
  estomagoSensible: true,
  ingredientesEvitar: ["cilantro"],
  ingredientesFavoritos: ["queso"],
  estadoActual: "Oaxaca",
  idioma: "en",
};

// Home
const { recomendados, evitar } = recomendarPlatillos(perfil, catalogo);
// recomendados[0].score === 92
// recomendados[0].color === "verde"

// Detalle de platillo
const explicacion = await generarExplicacion(
  perfil,
  recomendados[0],
  catalogo.platillos.find(p => p.id === recomendados[0].platilloId)!,
  catalogo.variantes.find(v => v.id === recomendados[0].varianteId)!
);
// explicacion.texto === "This tlayuda with beans and cheese is a great fit..."

const frases = await generarFrasesParaPedir(platillo, perfil);
// frases[0].fraseEs === "Sin cilantro, por favor"

// Feedback opcional
await registrarFeedback(recomendados[0].varianteId, true);
```
