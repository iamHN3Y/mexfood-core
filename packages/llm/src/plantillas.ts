import type { Explicacion, Frase, Perfil, Platillo, Recomendacion, Variante } from "@core/types";

export function plantillaExplicacion(
  recomendacion: Recomendacion,
  platillo: Platillo,
  _variante: Variante,
): Explicacion {
  if (!recomendacion.apto) {
    const razon = recomendacion.razonBloqueo ?? "No es compatible con tu perfil.";
    return {
      texto: `Mejor evita ${platillo.nombre}: ${razon.toLowerCase()}.`,
      fuente: "plantilla",
    };
  }

  const positiva = recomendacion.razonesPositivas[0];
  const negativas = recomendacion.razonesNegativas;

  const intro =
    recomendacion.color === "verde"
      ? `${platillo.nombre} es una excelente opción para ti`
      : recomendacion.color === "amarillo"
        ? `${platillo.nombre} te puede funcionar`
        : `${platillo.nombre} es una opción con reservas`;

  const justificacion = positiva
    ? `: ${positiva.toLowerCase()}.`
    : platillo.descripcion
      ? `: ${platillo.descripcion}`
      : ".";

  const explicacion: Explicacion = {
    texto: `${intro}${justificacion}`,
    fuente: "plantilla",
  };

  if (platillo.notaCultural) {
    explicacion.tipCultural = platillo.notaCultural;
  }

  if (negativas.length > 0) {
    explicacion.advertencia = negativas.join(". ") + ".";
  }

  return explicacion;
}

export function plantillaFrases(platillo: Platillo, perfil: Perfil): Frase[] {
  const frases: Frase[] = [
    {
      fraseEs: `¿Me trae un ${platillo.nombre}, por favor?`,
      traduccion: `Could I have one ${platillo.nombre}, please?`,
      pronunciacionFonetica: `meh TRAH-eh oon ${aproximarFonetica(platillo.nombre)}, por fah-VOHR`,
    },
    {
      fraseEs: `¿Qué ingredientes lleva?`,
      traduccion: `What ingredients does it have?`,
      pronunciacionFonetica: `keh een-greh-dee-EHN-tehs YEH-vah`,
    },
  ];

  if (perfil.toleranciaPicante === "bajo") {
    frases.push({
      fraseEs: `Sin picante, por favor.`,
      traduccion: `No spice, please.`,
      pronunciacionFonetica: `seen pee-KAHN-teh, por fah-VOHR`,
    });
  } else if (perfil.alergias.length > 0) {
    const alergia = perfil.alergias[0] ?? "";
    frases.push({
      fraseEs: `Soy alérgico a ${alergia}. ¿Tiene?`,
      traduccion: `I'm allergic to ${alergia}. Does it have any?`,
      pronunciacionFonetica: `soy ah-LEHR-hee-koh ah ${aproximarFonetica(alergia)}. TYEH-neh`,
    });
  } else {
    frases.push({
      fraseEs: `¿Me lo recomienda?`,
      traduccion: `Would you recommend it?`,
      pronunciacionFonetica: `meh loh reh-koh-MYEHN-dah`,
    });
  }

  return frases;
}

function aproximarFonetica(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/ñ/g, "ny")
    .replace(/j/g, "h")
    .replace(/ll/g, "y")
    .replace(/h/g, "")
    .replace(/qu/g, "k")
    .replace(/c([ei])/g, "s$1")
    .replace(/á/g, "ah")
    .replace(/é/g, "eh")
    .replace(/í/g, "ee")
    .replace(/ó/g, "oh")
    .replace(/ú/g, "oo");
}
