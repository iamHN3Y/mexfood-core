// Supabase Edge Function: proxy a Gemini con prompts estructurados.
// Deploy:
//   supabase functions deploy llm --no-verify-jwt
// Env (configurar en dashboard Supabase → Edge Functions → Secrets):
//   GEMINI_API_KEY       — obligatoria
//   GEMINI_MODEL         — opcional, default "gemini-2.5-flash-lite"
//   LLM_TIMEOUT_MS       — opcional, default 7000

// deno-lint-ignore-file no-explicit-any

const MODELO_DEFAULT = "gemini-2.5-flash-lite";
const TIMEOUT_DEFAULT_MS = 7000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Accion = "explicar" | "frases" | "analizar-menu";

interface PayloadLlm {
  accion: Accion;
  datos: unknown;
}

type ParteGemini = { text: string } | { inline_data: { mime_type: string; data: string } };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return json({ ok: false, error: "GEMINI_API_KEY no configurada" }, 500);
  }

  let payload: PayloadLlm;
  try {
    payload = (await req.json()) as PayloadLlm;
  } catch {
    return json({ ok: false, error: "JSON inválido" }, 400);
  }

  if (
    payload.accion !== "explicar" &&
    payload.accion !== "frases" &&
    payload.accion !== "analizar-menu"
  ) {
    return json({ ok: false, error: "accion desconocida" }, 400);
  }

  const partes = construirPartes(payload.accion, payload.datos);
  if (!partes) {
    return json({ ok: false, error: "datos inválidos para la accion" }, 400);
  }

  const modelo = Deno.env.get("GEMINI_MODEL") ?? MODELO_DEFAULT;
  const timeoutMs = Number(Deno.env.get("LLM_TIMEOUT_MS")) || TIMEOUT_DEFAULT_MS;

  try {
    const texto = await llamarGemini(apiKey, modelo, partes, timeoutMs);
    const datos = parsearRespuesta(payload.accion, texto);
    if (!datos) {
      return json({ ok: false, error: "Respuesta del modelo no parseable" }, 502);
    }
    return json({ ok: true, datos });
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err);
    return json({ ok: false, error: mensaje }, 502);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function construirPartes(accion: Accion, datos: unknown): ParteGemini[] | null {
  if (accion === "explicar") {
    const prompt = construirPromptExplicar(datos as any);
    return prompt ? [{ text: prompt }] : null;
  }
  if (accion === "frases") {
    const prompt = construirPromptFrases(datos as any);
    return prompt ? [{ text: prompt }] : null;
  }
  return construirPartesAnalizarMenu(datos as any);
}

function construirPromptExplicar(datos: {
  perfil?: any;
  recomendacion?: any;
  platillo?: any;
  variante?: any;
}): string | null {
  if (!datos?.perfil || !datos?.recomendacion || !datos?.platillo) return null;
  const { perfil, recomendacion, platillo, variante } = datos;

  return [
    `Eres un guía culinario mexicano hablándole a un turista.`,
    `Genera una explicación breve (2-3 oraciones) en el idioma ISO "${perfil.idioma ?? "es"}" sobre por qué el platillo le encaja o no al perfil.`,
    ``,
    `PLATILLO: ${platillo.nombre} (${platillo.categoria}, típico de ${platillo.estadoTipico}).`,
    `Descripción: ${platillo.descripcion}`,
    `Nota cultural: ${platillo.notaCultural}`,
    variante
      ? `Variante evaluada: ${variante.nombre} (ingredientes: ${(variante.ingredientes ?? []).join(", ")}).`
      : "",
    ``,
    `RESULTADO DEL RECOMENDADOR:`,
    `- apto: ${recomendacion.apto}`,
    `- score: ${recomendacion.score}`,
    `- etiqueta: ${recomendacion.etiqueta}`,
    recomendacion.razonBloqueo ? `- razón de bloqueo: ${recomendacion.razonBloqueo}` : "",
    recomendacion.razonesPositivas?.length
      ? `- razones positivas: ${recomendacion.razonesPositivas.join("; ")}`
      : "",
    recomendacion.razonesNegativas?.length
      ? `- razones negativas: ${recomendacion.razonesNegativas.join("; ")}`
      : "",
    ``,
    `PERFIL RELEVANTE:`,
    `- estadoActual: ${perfil.estadoActual}`,
    `- toleranciaPicante: ${perfil.toleranciaPicante}`,
    perfil.alergias?.length ? `- alergias: ${perfil.alergias.join(", ")}` : "",
    ``,
    `Responde EXCLUSIVAMENTE con JSON válido, sin prosa alrededor, con esta forma:`,
    `{"texto": "...", "tipCultural": "...", "advertencia": "..."}`,
    `Los campos tipCultural y advertencia son opcionales; omítelos si no aportan.`,
    `No uses markdown, no uses backticks, no pongas nada antes o después del JSON.`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

function construirPromptFrases(datos: { perfil?: any; platillo?: any }): string | null {
  if (!datos?.perfil || !datos?.platillo) return null;
  const { perfil, platillo } = datos;

  return [
    `Eres un asistente de viaje en México.`,
    `Genera 3 frases útiles en español que el turista puede decir al mesero al pedir "${platillo.nombre}".`,
    `Cada frase debe incluir su traducción al idioma ISO "${perfil.idioma ?? "en"}" y una pronunciación fonética aproximada leíble por un hablante del idioma destino.`,
    ``,
    `PERFIL RELEVANTE:`,
    `- toleranciaPicante: ${perfil.toleranciaPicante}`,
    perfil.alergias?.length ? `- alergias: ${perfil.alergias.join(", ")}` : "",
    perfil.ingredientesEvitar?.length ? `- evita: ${perfil.ingredientesEvitar.join(", ")}` : "",
    ``,
    `Prioriza frases relevantes al perfil (ej. "sin X" si hay alergia, "sin picante" si tolerancia baja).`,
    ``,
    `Responde EXCLUSIVAMENTE con JSON válido, sin markdown ni prosa alrededor:`,
    `{"frases": [{"fraseEs": "...", "traduccion": "...", "pronunciacionFonetica": "..."}, ...]}`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

function construirPartesAnalizarMenu(datos: {
  imagenBase64?: string;
  mimeType?: string;
}): ParteGemini[] | null {
  if (typeof datos?.imagenBase64 !== "string" || datos.imagenBase64.trim() === "") return null;
  const mimeType =
    typeof datos.mimeType === "string" && datos.mimeType.trim() !== ""
      ? datos.mimeType
      : "image/jpeg";

  const prompt = [
    `Eres un OCR culinario. Mira la imagen del menú y extrae SOLO los nombres de platillos mexicanos visibles.`,
    `Reglas:`,
    `- Ignora precios, descripciones largas, encabezados de sección, leyendas del restaurante.`,
    `- Normaliza plurales/mayúsculas si es útil, pero no traduzcas ni inventes.`,
    `- Si un platillo tiene varias opciones (ej. "taco al pastor / carnitas / suadero"), lista cada uno.`,
    `- Si no lees nada legible, devuelve items: [].`,
    ``,
    `Responde EXCLUSIVAMENTE con JSON válido, sin markdown:`,
    `{"items": ["Taco al pastor", "Mole poblano", ...]}`,
  ].join("\n");

  return [{ text: prompt }, { inline_data: { mime_type: mimeType, data: datos.imagenBase64 } }];
}

async function llamarGemini(
  apiKey: string,
  modelo: string,
  partes: ParteGemini[],
  timeoutMs: number,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: partes }],
        generationConfig: {
          temperature: 0.6,
          responseMimeType: "application/json",
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as any;
    const texto = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof texto !== "string" || texto.trim() === "") {
      throw new Error("Gemini devolvió respuesta vacía");
    }
    return texto;
  } finally {
    clearTimeout(timer);
  }
}

function parsearRespuesta(accion: Accion, texto: string): unknown | null {
  const limpio = texto
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/, "");
  let datos: any;
  try {
    datos = JSON.parse(limpio);
  } catch {
    return null;
  }

  if (accion === "explicar") {
    if (typeof datos?.texto !== "string" || datos.texto.trim() === "") return null;
    const out: any = { texto: datos.texto };
    if (typeof datos.tipCultural === "string" && datos.tipCultural.trim() !== "") {
      out.tipCultural = datos.tipCultural;
    }
    if (typeof datos.advertencia === "string" && datos.advertencia.trim() !== "") {
      out.advertencia = datos.advertencia;
    }
    return out;
  }

  if (accion === "frases") {
    if (!Array.isArray(datos?.frases)) return null;
    const frases = [];
    for (const f of datos.frases) {
      if (
        typeof f?.fraseEs !== "string" ||
        typeof f?.traduccion !== "string" ||
        typeof f?.pronunciacionFonetica !== "string"
      ) {
        return null;
      }
      frases.push({
        fraseEs: f.fraseEs,
        traduccion: f.traduccion,
        pronunciacionFonetica: f.pronunciacionFonetica,
      });
    }
    return { frases };
  }

  // analizar-menu
  if (!Array.isArray(datos?.items)) return null;
  const items: string[] = [];
  for (const it of datos.items) {
    if (typeof it === "string" && it.trim() !== "") items.push(it.trim());
  }
  return { items };
}
