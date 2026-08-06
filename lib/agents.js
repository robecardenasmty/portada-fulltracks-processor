import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const REPORTER_VOICES = {
  "Alejandro Córdova": "434f43ec01bc469a8adb871c424a17da",
  "Renata Lozano": "04db0f12a69b49f1a52e3de00336eb08",
  "Mateo Salas": "322afb36c76f46b0a2778bf11fdc2518",
  "Daniela Villarreal": "d61f1b46bcae4138b73e1a7b074a32bc",
  "Rodrigo Treviño": "21e7a4e03a264381947cb323626a3a04",
  "Paulina Cantú": "aa29994adcd44098b27b59cb1ca68d51",
  "Javier Castañeda": "c8bed8c949ce478fa479917273d5b074",
  "Fernanda Montalvo": "b22667757d0e45e9a71c752382f6a706",
  "Mauricio Leal": "e6f80a75818846988ef084c6e7ff78bf",
  "Regina de Ochoa": "3a0d5627caa648189c7d6550cc5aedb0",
};

function extractJSON(rawText) {
  if (!rawText) throw new Error("Respuesta vacía del modelo");

  let text = rawText.trim();
  text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "");
  text = text.replace(/```\s*$/i, "");

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(
      `No se pudo parsear JSON (posible respuesta truncada). ` +
        `Longitud del texto: ${rawText.length} caracteres. ` +
        `Últimos 200 caracteres: ...${rawText.slice(-200)}`
    );
  }
}

function detectMediaType(portadaInput) {
  const match = portadaInput.match(/^data:image\/(png|jpeg|jpg|webp);base64,/);
  if (match) {
    const ext = match[1] === "jpg" ? "jpeg" : match[1];
    return `image/${ext}`;
  }
  return "image/jpeg";
}

function stripBase64Prefix(portadaInput) {
  return portadaInput.replace(/^data:image\/\w+;base64,/, "");
}

// Agente 1: OCR + Extrae noticias de la portada
export async function agentOCRExtraction(portadaBase64) {
  try {
    const mediaType = detectMediaType(portadaBase64);
    const cleanBase64 = stripBase64Prefix(portadaBase64);

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: cleanBase64,
              },
            },
            {
              type: "text",
              text: `Eres un especialista en OCR para portadas de periódicos.

Analiza esta portada y extrae SOLO las noticias visibles y legibles.

Responde ÚNICAMENTE con un JSON válido, sin texto antes ni después, sin bloques de markdown. El formato exacto debe ser:
{
  "noticias": [
    {
      "titulo": "...",
      "descripcion": "...",
      "seccion": "política|local|nacional|internacional|deportes|otro"
    }
  ],
  "legibilidad": "alta|media|baja",
  "observaciones": "..."
}

Sé honesto: si la portada no es legible o está borrosa, indícalo en "observaciones" pero igual intenta extraer lo que se alcance a leer.`,
            },
          ],
        },
      ],
    });

    const rawText = response.content[0]?.text || "";
    return extractJSON(rawText);
  } catch (error) {
    return {
      error: true,
      mensaje: "Error en OCR",
      detalles: error.message,
    };
  }
}

// Agente 2: Valida estructura (que tenga la info necesaria)
export async function agentStructureValidation(fulltracks) {
  try {
    if (!fulltracks || fulltracks.length === 0) {
      return {
        validaciones: [],
        resumen: "Sin fulltracks que validar todavía",
      };
    }

    // Solo mandamos título + palabras para mantener la respuesta corta
    const resumenFulltracks = fulltracks.map((f) => ({
      numero: f.numero,
      titulo: f.titulo,
      palabras: f.palabras,
      reportero: f.reportero,
    }));

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      messages: [
        {
          role: "user",
          content: `Eres un validador editorial de fulltracks de TV.

Valida estos ${fulltracks.length} fulltracks (solo con su resumen):
${JSON.stringify(resumenFulltracks, null, 2)}

Para cada uno, indica brevemente (máximo 10 palabras por campo) si el título es claro y el conteo de palabras es razonable (idealmente 55-65).

Responde ÚNICAMENTE con un JSON válido, sin texto antes ni después, y SÉ BREVE en cada campo de texto:
{
  "validaciones": [
    {
      "numero": 1,
      "valido": true,
      "razon": "breve"
    }
  ],
  "resumen": "breve resumen general en una frase"
}`,
        },
      ],
    });

    const rawText = response.content[0]?.text || "";
    return extractJSON(rawText);
  } catch (error) {
    return {
      error: true,
      mensaje: "Error en validación estructural",
      detalles: error.message,
    };
  }
}

// Agente 3: Revisa timings y duración
export async function agentTimingValidation(fulltracks) {
  try {
    if (!fulltracks || fulltracks.length === 0) {
      return {
        timings: [],
        resumen: "Sin fulltracks que validar todavía",
      };
    }

    const resumenFulltracks = fulltracks.map((f) => ({
      numero: f.numero,
      palabras: f.palabras,
      duracion_estimada: f.duracion_estimada,
    }));

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Eres un especialista en timing para locutor de noticias.

Revisa estos ${fulltracks.length} fulltracks (ya con conteo de palabras):
${JSON.stringify(resumenFulltracks, null, 2)}

Para cada uno, valida si las palabras están entre 55-65 (ideal) y si la duración estimada es razonable (~25 seg).

Responde ÚNICAMENTE con un JSON válido, sin texto antes ni después, SÉ BREVE:
{
  "timings": [
    {
      "numero": 1,
      "valido": true,
      "nota": "breve"
    }
  ],
  "resumen": "breve resumen general en una frase"
}`,
        },
      ],
    });

    const rawText = response.content[0]?.text || "";
    return extractJSON(rawText);
  } catch (error) {
    return {
      error: true,
      mensaje: "Error en validación de timings",
      detalles: error.message,
    };
  }
}

// Agente 4: Valida calidad de audio/pronunciación
export async function agentAudioQuality(fulltracks, reporteros) {
  try {
    if (!fulltracks || fulltracks.length === 0) {
      return {
        calidad: [],
        resumen_general: "Sin fulltracks que validar todavía",
      };
    }

    // Mandamos el contenido completo pero pedimos respuesta muy breve
    const resumenFulltracks = fulltracks.map((f) => ({
      numero: f.numero,
      contenido: f.contenido,
      reportero: f.reportero,
    }));

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      messages: [
        {
          role: "user",
          content: `Eres un especialista en calidad de voz y pronunciación para doblaje IA.

Revisa estos ${fulltracks.length} fulltracks:
${JSON.stringify(resumenFulltracks, null, 2)}

Para cada uno, indica muy brevemente si es pronunciable para una voz IA y si el ritmo es bueno.

Responde ÚNICAMENTE con un JSON válido, sin texto antes ni después, SÉ MUY BREVE en cada campo:
{
  "calidad": [
    {
      "numero": 1,
      "pronunciable": true,
      "ritmo": "bueno"
    }
  ],
  "resumen_general": "breve resumen general en una frase"
}`,
        },
      ],
    });

    const rawText = response.content[0]?.text || "";
    return extractJSON(rawText);
  } catch (error) {
    return {
      error: true,
      mensaje: "Error en validación de audio",
      detalles: error.message,
    };
  }
}

// Ejecuta los 4 agentes en paralelo
export async function runAllAgents(portadaBase64, fulltracks, reporteros) {
  const [ocr, structure, timing, audio] = await Promise.all([
    agentOCRExtraction(portadaBase64),
    agentStructureValidation(fulltracks),
    agentTimingValidation(fulltracks),
    agentAudioQuality(fulltracks, reporteros),
  ]);

  return {
    timestamp: new Date().toISOString(),
    agente1_ocr: ocr,
    agente2_estructura: structure,
    agente3_timings: timing,
    agente4_audio: audio,
    estado_general:
      !ocr.error && !structure.error && !timing.error && !audio.error
        ? "aprobado"
        : "con_advertencias",
  };
}

export function getReporterVoiceId(nombre) {
  return REPORTER_VOICES[nombre] || null;
}

export function getReporters() {
  return Object.keys(REPORTER_VOICES);
}
