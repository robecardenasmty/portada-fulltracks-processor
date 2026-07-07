import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const REPORTER_VOICES = {
  "Santiago Landa": "5a7d7405d30a4045975ddd2c2c14bf2c",
  "Mariana Robles": "fb146e57407540f0be6863063d94bea5",
  "Diego Barrera": "d81087c7bc264a06b3d243b52f91477d",
  "Valeria Montemayor": "420c2c8decaa48818a73f0e0672a82f3",
  "Andrés Villaseñor": "5e701da3e85d4720a1d00ec1f2f6b4b4",
  "Natalia Lascuráin": "86d76f757e794ee68ade7875c3fe8310",
  "Ricardo Alvarado": "1a81186975ec41eba1e68fd563e9be4a",
  "Camila Serrano": "9121eefdd6154365bb4c7c087cff1036",
  "Emilio Garza": "19f72e1f83d54baeac149cbf4f5f1b50",
  "Lucía Herrera": "9626fb0595f840c5bad68e6f8365dbd4",
};

// Agente 1: OCR + Extrae noticias de la portada
export async function agentOCRExtraction(portadaBase64) {
  try {
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: portadaBase64.replace(/^data:image\/(png|jpg|jpeg);base64,/, ""),
              },
            },
            {
              type: "text",
              text: `Eres un especialista en OCR para portadas de periódicos.
              
Analiza esta portada y extrae SOLO las noticias visibles y legibles.
Devuelve un JSON con este formato:
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

Sé honesto: si la portada no es legible o está borrosa, indícalo.`,
            },
          ],
        },
      ],
    });

    return JSON.parse(response.content[0].text);
  } catch (error) {
    return {
      error: true,
      mensaje: "Error en OCR",
      detalles: error.message,
    };
  }
}

// Agente 2: Valida estructura (que tenga la info necesaria)
export async function agentStructureValidation(noticias) {
  try {
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `Eres un validador editorial de noticias para fulltracks de TV.

Valida estas noticias:
${JSON.stringify(noticias, null, 2)}

Para cada noticia, verifica:
1. Tiene título claro
2. Tiene descripción suficiente (no vaga)
3. Sección identificada correctamente
4. Tiene suficiente información para un fulltrack de 55-65 palabras

Devuelve un JSON:
{
  "validaciones": [
    {
      "titulo": "...",
      "valido": true|false,
      "razon": "...",
      "sugerencias": "..."
    }
  ],
  "resumen": "..."
}`,
        },
      ],
    });

    return JSON.parse(response.content[0].text);
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
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `Eres un especialista en timing para locutor de noticias.

Analiza estos fulltracks:
${JSON.stringify(fulltracks, null, 2)}

Para cada fulltrack:
1. Cuenta palabras (debe estar entre 55-65)
2. Estima duración de lectura a ritmo de noticiero (aprox 140-160 palabras/min)
3. Verifica que no haya pausas extrañas en el flujo
4. Valida que la firma esté correcta

Devuelve:
{
  "timings": [
    {
      "fulltrack": "...",
      "palabras": 60,
      "duracion_estimada": "25 segundos",
      "valido": true|false,
      "notas": "..."
    }
  ],
  "resumen": "..."
}`,
        },
      ],
    });

    return JSON.parse(response.content[0].text);
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
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `Eres un especialista en calidad de voz y pronunciación para doblaje.

Estos fulltracks serán grabados con voces IA por estos reporteros:
${JSON.stringify(reporteros, null, 2)}

Analiza:
${JSON.stringify(fulltracks, null, 2)}

Para cada fulltrack verifica:
1. No hay palabras difíciles de pronunciar para IA
2. Puntuación adecuada para pausas naturales
3. Ritmo fluido (sin saltos de tema abruptos)
4. Tono periodístico consistente
5. Nombres y palabras clave correctas

Devuelve:
{
  "calidad": [
    {
      "fulltrack": "...",
      "reportero": "...",
      "pronunciable": true|false,
      "ritmo": "bueno|medio|mejora",
      "recomendaciones": "..."
    }
  ],
  "resumen_general": "..."
}`,
        },
      ],
    });

    return JSON.parse(response.content[0].text);
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

// Obtener IDs de voz según reportero
export function getReporterVoiceId(nombre) {
  return REPORTER_VOICES[nombre] || null;
}

// Listar todos los reporteros disponibles
export function getReporters() {
  return Object.keys(REPORTER_VOICES);
}
