# Contexto del proyecto — Recomendador de Comida Mexicana

> **Para el asistente:** este documento resume una conversación previa donde se diseñó la arquitectura de un proyecto de hackathon. El usuario va a continuar el desarrollo desde aquí. No re-expliques lo decidido; asume que las decisiones están tomadas y ayuda a ejecutar. Si algo parece ambiguo, pregunta antes de asumir.

---

## 1. El proyecto en una frase

App móvil multilingüe y privacy-friendly que recomienda comida mexicana a turistas extranjeros (especialmente Mundial FIFA 2026) según alergias, dieta, tolerancia al picante, restricciones culturales y ubicación en México.

## 2. Contexto del hackathon

- **Tiempo disponible:** ~10 días (semana y media).
- **Rol del usuario:** implementa toda la capa de lógica + integración con Supabase. Otra persona se encarga del front (React Native + Expo).
- **Requisitos explícitos del reto:**
  - Privacy-friendly: sin datos personales ni información médica sensible.
  - Multilingüe (visitantes internacionales).
  - Funcionalidad por ubicación (platillos típicos del estado visitado).
  - Enfoque especial en sedes del Mundial: CDMX, Jalisco, Nuevo León.
- **Prioridades del usuario, en orden:**
  1. Balance parejo entre calidad de código, features y pulido visual.
  2. Código limpio y bien arquitecturado.
  3. Demo pulida que impresione.
  4. Features avanzadas (secundario).

## 3. Dataset base (ya provisto por el reto)

Hay dos archivos CSV con schemas JSON y un script generador:

- `platillos.csv`: 214 platillos, con columnas `id_platillo`, `nombre_es`, `categoria`, `subcategoria`, `estado_tipico`, `region_tipica`, `descripcion_es`, `tipo_estructura`, `personalizable`, `nivel_picante_base`, `riesgo_digestivo_base`, `nota_cultural_es`, `recomendacion_turista_es`, `activo`.
- `variantes_platillo.csv`: 190 variantes, con columnas incluyendo `ingredientes_es` y `alergenos` serializadas como JSON dentro del CSV, más flags booleanas (`contiene_cerdo`, `contiene_mariscos`, `contiene_lacteos`, `contiene_gluten`, `contiene_alcohol`, `apto_vegetariano`, `apto_vegano`) y enums (`nivel_picante`, `riesgo_digestivo` con valores `bajo|medio|alto`).
- Cobertura: 30 estados mexicanos, 8 categorías, 11 regiones.
- Enums controlados en `tipo_estructura`: `cerrado_con_relleno`, `abierto_con_toppings`, `caldo`, `guiso`, `pan_relleno`, `tortilla_rellena`, `antojito_frito`, `bebida`, `postre`.
- **Los booleanos se guardan como strings `"true"`/`"false"`.**
- **Los arrays se guardan como strings JSON dentro de celdas CSV.**

## 4. Arquitectura decidida

```
┌─────────────────────────────────────────────────────────┐
│                   FRONT (otra persona)                  │
│              React Native + Expo                        │
│              Solo UI, navegación, estado visual         │
└────────────────────┬────────────────────────────────────┘
                     │ importa desde tu librería
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   TERRITORIO DEL USUARIO                │
│                                                         │
│  ┌────────────────────────────────────────────────┐     │
│  │   @core/recomendador                           │     │
│  │   • Motor de reglas (puro, síncrono)           │     │
│  │   • Integración Gemini (vía Edge Function)     │     │
│  │   • Cache, fallbacks, tipos                    │     │
│  └──────────────────────┬─────────────────────────┘     │
│                         │                               │
│  ┌──────────────────────▼─────────────────────────┐     │
│  │   @core/data                                   │     │
│  │   • Cliente Supabase                           │     │
│  │   • Fetch catálogo con cache                   │     │
│  │   • Feedback anónimo                           │     │
│  └──────────────────────┬─────────────────────────┘     │
│                         │                               │
│  ┌──────────────────────▼─────────────────────────┐     │
│  │   SUPABASE                                     │     │
│  │   • Postgres: platillos, variantes, feedback   │     │
│  │   • Edge Function: proxy a Gemini API          │     │
│  │   • Row Level Security                         │     │
│  └────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

**Principios clave de la arquitectura:**

- La librería de lógica es **agnóstica** de React Native, AsyncStorage, Supabase. Recibe datos, devuelve datos.
- El **motor de reglas corre en el cliente** (no en backend). Con 190 variantes cabe en memoria, da respuesta instantánea, y permite modo offline.
- **Supabase solo sirve el catálogo** y aloja el Edge Function que actúa como proxy a Gemini (protege la API key).
- El **perfil del usuario nunca sale del dispositivo** excepto como input al Edge Function para generar explicaciones (y ni ahí se persiste).

## 5. Stack técnico

| Capa | Tecnología | Notas |
|---|---|---|
| Lenguaje | TypeScript | Obligatorio, aunque el usuario no lo domina aún |
| Tests | Vitest (preferido) o Jest | TDD suave para el motor |
| Backend | Supabase (Postgres + REST + Edge Functions) | Free tier |
| LLM | Gemini 2.0 Flash API | Free tier generoso (15 req/min, 1M tokens/día), multilingüe, con visión |
| Proxy LLM | Supabase Edge Function (Deno) | Oculta API key del cliente |
| Front (otro dev) | React Native + Expo + NativeWind | Solo para contexto |

**Decisión sobre el LLM:** se evaluó Ollama/DeepSeek local con Docker y se descartó para producción por problemas con multilingüe en modelos pequeños y dependencia del hardware para demos. Para desarrollo local se puede usar Ollama + Qwen 2.5 7B como sustituto gratuito mientras se itera, con abstracción por interface `LLMProvider` para permitir swap.

## 6. Decisiones de diseño importantes (no negociar sin razón)

### 6.1 Hard filters vs soft filters
Todo lo que involucra salud o creencias (alergias, cerdo, alcohol, dieta estricta) bloquea el platillo completo con `score: 0`. Todo lo demás (picante, digestivo, preferencias) solo resta puntos. **Nunca mezclar las dos categorías**: una alergia al cacahuate jamás debe aparecer como "95% compatible".

### 6.2 Match score, no "% de daño"
Se rechazó explícitamente la idea de mostrar porcentajes tipo "50% de hacerte daño" porque:
- No hay datos reales de reacciones para calcular probabilidades.
- Es éticamente problemático dar falsa precisión sobre temas de salud.
- Expone al proyecto a críticas técnicas de jueces con criterio.

En su lugar: **match score 0–100 de compatibilidad con preferencias declaradas** + semáforo verde/amarillo/naranja/rojo.

### 6.3 Dieta composable (no enum)
Se cambió de `dieta: "vegetariano" | "vegano" | ...` a objetos composables:

```typescript
interface Dieta {
  vegetariano: boolean;
  vegano: boolean;
  pescetariano: boolean;
}

interface Restricciones {
  sinGluten: boolean;
  sinLacteos: boolean;
}
```

**Razón:** la realidad permite combinaciones (vegetariano + sin gluten, pescetariano + sin lácteos). El front presenta tres checkboxes independientes y el motor resuelve precedencia:

- `vegano` siempre gana (el más estricto).
- `pescetariano` prevalece sobre `vegetariano` solo (permite pescado/mariscos).
- Si nada está marcado, no hay restricción dietaria.

**Deuda técnica conocida:** el dataset no distingue `contienePescado` de `contieneMariscos`. Para MVP: pescetariano permite variantes con `contieneMariscos` como proxy imperfecto.

### 6.4 Las funciones LLM nunca rechazan
`generarExplicacion` y `generarFrasesParaPedir` **siempre resuelven**. Si Gemini falla, cae a plantillas generadas con los flags del platillo. La app no se rompe si se cae la API.

### 6.5 Funciones de data sí pueden rechazar
`fetchCatalogo` y `registrarFeedback` lanzan `CoreError` con `code` y `recoverable`. El front decide cómo mostrar el error.

## 7. Contrato de API público

El usuario comparte este contrato con el dev de front. Ya está en `API_CONTRACT.md` (versión 0.2.0).

### 7.1 Funciones de `@core/data`

```typescript
function fetchCatalogo(): Promise<Catalogo>;

function fetchCatalogoConCache(
  storage: StorageAdapter,
  opciones?: { ttlDias?: number; forzarRefetch?: boolean }
): Promise<Catalogo>;

function registrarFeedback(
  varianteId: string,
  util: boolean,
  perfilHash?: string
): Promise<void>;

interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
```

### 7.2 Funciones de `@core/recomendador`

```typescript
// Puras, síncronas
function recomendarPlatillos(
  perfil: Perfil,
  catalogo: Catalogo,
  opciones?: OpcionesRecomendacion
): ResultadoRecomendacion;

function calcularMatchScore(
  perfil: Perfil,
  variante: Variante,
  platillo: Platillo
): Recomendacion;

// Async, nunca rechazan (degradan a plantilla)
function generarExplicacion(
  perfil: Perfil,
  recomendacion: Recomendacion,
  platillo: Platillo,
  variante: Variante
): Promise<Explicacion>;

function generarFrasesParaPedir(
  platillo: Platillo,
  perfil: Perfil
): Promise<Frase[]>;

// Opcional / avanzada (puede no llegar a v1)
function analizarMenu(
  imagenBase64: string,
  perfil: Perfil,
  catalogo: Catalogo
): Promise<AnalisisMenu>;
```

### 7.3 Tipos principales

```typescript
type Nivel = "bajo" | "medio" | "alto";
type ColorSemaforo = "verde" | "amarillo" | "naranja" | "rojo";
type IdiomaISO = "es" | "en" | "fr" | "de" | "pt" | "it" | "ja" | "ar" | "zh";

interface Perfil {
  alergias: string[];
  dieta: { vegetariano: boolean; vegano: boolean; pescetariano: boolean };
  restricciones: { sinGluten: boolean; sinLacteos: boolean };
  evitaCerdo: boolean;
  evitaAlcohol: boolean;
  evitaMariscos: boolean;
  toleranciaPicante: Nivel;
  estomagoSensible: boolean;
  ingredientesEvitar: string[];
  ingredientesFavoritos: string[];
  estadoActual: string;
  idioma: IdiomaISO;
}

interface Platillo {
  id: string;              // "PL001"
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
  id: string;              // "VAR001"
  idPlatillo: string;
  nombre: string;
  tipoVariante: string;
  ingredientes: string[];  // ya parseado desde JSON
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

interface Recomendacion {
  varianteId: string;
  platilloId: string;
  score: number;           // 0–100
  apto: boolean;
  etiqueta: "Muy recomendable" | "Compatible con precauciones" | "Con reservas" | "No recomendable";
  color: ColorSemaforo;
  razonesPositivas: string[];
  razonesNegativas: string[];
  advertencias: string[];
  razonBloqueo?: string;
}

interface Explicacion {
  texto: string;
  tipCultural?: string;
  advertencia?: string;
  fuente: "llm" | "plantilla";
}
```

## 8. Algoritmo del motor (pseudocódigo aprobado)

```
FUNCIÓN calcularMatchScore(perfil, variante, platillo):

  # CAPA 1: HARD FILTERS
  PARA cada alergeno EN perfil.alergias:
    SI alergeno ∈ variante.alergenos:
      RETORNAR { score: 0, apto: false, razonBloqueo: "Contiene " + alergeno }

  SI perfil.evitaCerdo Y variante.contieneCerdo: bloquear
  SI perfil.evitaAlcohol Y variante.contieneAlcohol: bloquear
  SI perfil.evitaMariscos Y variante.contieneMariscos: bloquear

  # Resolver dieta efectiva (vegano > pescetariano > vegetariano)
  efectiva = dietaEfectiva(perfil.dieta)
  SI efectiva == "vegano" Y !variante.aptoVegano: bloquear
  SI efectiva == "vegetariano" Y !variante.aptoVegetariano: bloquear
  SI efectiva == "pescetariano" Y !variante.aptoVegetariano Y !variante.contieneMariscos: bloquear

  SI perfil.restricciones.sinGluten Y variante.contieneGluten: bloquear
  SI perfil.restricciones.sinLacteos Y variante.contieneLacteos: bloquear

  # CAPA 2: SOFT FILTERS
  score = 100
  diferenciaPicante = nivelANum(variante.nivelPicante) - nivelANum(perfil.toleranciaPicante)
  SI diferenciaPicante == 1: score -= 20, añadir advertencia
  SI diferenciaPicante >= 2: score -= 40, añadir advertencia fuerte

  SI variante.riesgoDigestivo == "alto":
    SI perfil.estomagoSensible: score -= 25
    SINO: score -= 10
  SI variante.riesgoDigestivo == "medio" Y perfil.estomagoSensible: score -= 10

  PARA cada ingrediente EN variante.ingredientes:
    SI ingrediente ∈ perfil.ingredientesEvitar: score -= 8
    SI ingrediente ∈ perfil.ingredientesFavoritos: score += 5

  SI platillo.estadoTipico == perfil.estadoActual: score += 10
  SINO SI misma región: score += 5

  # CAPA 3: NORMALIZACIÓN
  score = clamp(score, 0, 100)
  # Umbrales: >=80 verde, >=60 amarillo, >=40 naranja, <40 rojo

  RETORNAR Recomendacion completa
```

**Diversificación del top:** no más de 2 variantes de la misma subcategoría en el top 5. Ordenar por score descendente, luego aplicar el filtro.

**Pesos pendientes de calibrar en día 4.** Los números de arriba son iniciales; se ajustarán corriendo el motor sobre perfiles sintéticos.

## 9. Cronograma de 10 días

- **Día 1:** Setup repo + TypeScript + Vitest + tipos + parser CSV. Levantar Supabase, importar CSV a tablas con JSONB, configurar RLS.
- **Día 2:** Cliente `@core/data` envolviendo Supabase. Motor de reglas: hard filters con tests unitarios agresivos (mín. 20 tests).
- **Día 3:** Motor de reglas: soft filters + scoring + ranking + diversificación. Tests con 5-6 perfiles sintéticos.
- **Día 4:** Calibración del motor sobre perfiles reales. `TUNING.md`. Montar Edge Function proxy a Gemini en Supabase.
- **Día 5:** Librería LLM: `callLLM` base con abstracción por interface `LLMProvider`. `generarExplicacion` con prompt estructurado + few-shot + output JSON.
- **Día 6:** `generarFrasesParaPedir`. Cache (memoria LRU + persistente vía `StorageAdapter`). Manejo completo de fallos, modo offline con plantillas.
- **Día 7:** Tabla `feedback` en Supabase + `registrarFeedback`. Arrancar feature avanzada.
- **Día 8:** Terminar feature avanzada (probablemente escáner de menús con Gemini visión + cache en tabla `menus_escaneados`).
- **Día 9:** Documentación (`README.md`, `ARCHITECTURE.md`, `TUNING.md`), ejemplos ejecutables en `examples/`.
- **Día 10:** Pairing con dev de front, integración end-to-end, buffer de bugs, preparar pitch técnico.

## 10. Estado actual

**Completado en conversación previa:**
- [x] Análisis del reto y del dataset.
- [x] Decisión de stack (TypeScript, Supabase, Gemini API).
- [x] Arquitectura de capas definida.
- [x] Pseudocódigo del motor aprobado.
- [x] Contrato de API v0.2.0 con dieta composable.

**Siguiente paso inmediato (donde se quedó):**
- [ ] **Día 1: setup real del repo.** Concretamente:
  1. Estructura de carpetas del monorepo (o carpetas hermanas — decisión pendiente).
  2. `package.json`, `tsconfig.json`, config de Vitest, ESLint, Prettier.
  3. Archivo `types.ts` con todos los tipos del contrato traducidos a TypeScript ejecutable.
  4. Parser de CSV que lea los dos archivos y devuelva `Catalogo` tipado, con los JSON internos ya parseados.
  5. Tests base del parser verificando que arrays JSON parseen correctamente.
  6. SQL de creación de tablas Supabase con `JSONB` para `ingredientes_es` y `alergenos`.
  7. Script de Node que convierta CSV originales en `INSERT` masivo para Supabase.

El usuario prefiere arrancar con esto paso a paso revisando conforme avanza, en vez de recibir todo de golpe.

## 11. Riesgos y cosas a cuidar

- **Dataset con JSON dentro de CSV:** parsear cuidadosamente. Campos `ingredientes_es` y `alergenos` llegan como strings JSON.
- **Booleanos como strings en CSV:** convertir `"true"`/`"false"` a booleans al leer.
- **APIs de Node que no existen en React Native:** evitar `Buffer`, `fs`, `crypto` sin polyfill cross-platform.
- **API key de Gemini:** NUNCA en el cliente. Siempre vía Edge Function con `supabase secrets`.
- **RLS de Supabase:** configurar desde día 1. `SELECT` abierto, `INSERT/UPDATE/DELETE` cerrados en el cliente.
- **No perder tiempo en Supabase:** la plomería es divertida pero no es lo valioso. Máximo 3 medias-jornadas al backend en total.
- **Normalización de strings:** alergenos e ingredientes pueden venir con acentos, mayúsculas, plurales. Normalizar con `.normalize("NFD").toLowerCase()` o similar antes de comparar.

## 12. Archivos del proyecto relevantes

Cuando el usuario los adjunte al entorno:
- `Anexo_Hackathón.docx` — planteamiento del reto.
- `alimentos.zip` — dataset de platillos y variantes.
  - `data/platillos.csv` — 214 filas, catálogo maestro.
  - `data/variantes_platillo.csv` — 190 filas, variantes concretas.
  - `schemas/*.schema.json` — JSON Schema de cada CSV.
  - `scripts/seed_dataset.py` — generador original, no necesitamos correrlo.
- `API_CONTRACT.md` — contrato público v0.2.0.

---

**Para el asistente que retome la conversación:** el usuario está listo para ejecutar. Arranca con el setup del día 1 paso a paso, empezando por la estructura de carpetas y `package.json`. Valida decisiones puntuales cuando sea necesario (ej: monorepo vs carpetas hermanas) pero no re-discutas las decisiones arquitectónicas ya tomadas. Si notas contradicciones entre el plan y lo que el usuario pide, señálalo antes de implementar.
