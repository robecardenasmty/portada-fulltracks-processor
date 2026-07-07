import { runAllAgents, getReporters, getReporterVoiceId } from "../../lib/agents";
import {
  generateFulltracks,
  validateFulltrackRequirements,
} from "../../lib/openai-client";

// IMPORTANTE: en Next.js (Pages Router) el límite del body se define
// AQUÍ, dentro del archivo de la API, no en next.config.js.
// Vercel además tiene un límite duro de ~4.5MB en funciones serverless,
// así que "10mb" es seguro como techo, pero el body real nunca debe
// pasar de ~4mb o Vercel lo cortará antes de llegar aquí.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    let { portada_base64, remitente, asunto } = req.body;

    if (!portada_base64) {
      return res.status(400).json({ error: "Falta portada_base64" });
    }

    if (!portada_base64.match(/^[A-Za-z0-9+/=]+$/)) {
      return res.status(400).json({
        error: "base64 inválido - contiene caracteres no permitidos",
        recibido: portada_base64.substring(0, 50) + "...",
      });
    }

    portada_base64 = portada_base64.replace(/\s/g, "");
    const padding = portada_base64.length % 4;
    if (padding) {
      portada_base64 += "=".repeat(4 - padding);
    }

    const portadaDataUrl = `data:image/jpeg;base64,${portada_base64}`;

    // ============================================
    // PASO 1: Agente 1 (OCR) - solo este puede correr
    // sin fulltracks todavía
    // ============================================
    const validacionesIniciales = await runAllAgents(portadaDataUrl, [], []);

    if (validacionesIniciales.agente1_ocr.error) {
      return res.status(400).json({
        error: "No se pudo procesar la portada",
        detalles: validacionesIniciales.agente1_ocr.detalles,
        validaciones_agentes: validacionesIniciales,
      });
    }

    const noticias = validacionesIniciales.agente1_ocr.noticias || [];

    if (noticias.length === 0) {
      return res.status(400).json({
        error: "No se extrajeron noticias de la portada",
        validaciones_agentes: validacionesIniciales,
      });
    }

    // ============================================
    // PASO 2: Generar fulltracks con OpenAI GPT
    // ============================================
    const fulltracksResponse = await generateFulltracks(noticias);

    if (!fulltracksResponse.exito) {
      return res.status(500).json({
        error: "Error al generar fulltracks",
        detalles: fulltracksResponse.error,
        validaciones_agentes: validacionesIniciales,
      });
    }

    const fulltracks = fulltracksResponse.parsed;

    // ============================================
    // PASO 3: Re-correr Agentes 2, 3 y 4 YA CON los
    // fulltracks generados
    // ============================================
    const validacionesFinales = await runAllAgents(
      portadaDataUrl,
      fulltracks,
      fulltracks.map((f) => f.reportero)
    );

    // ============================================
    // PASO 4: Asignar Fish Audio IDs
    // ============================================
    const fulltracksConVoces = fulltracks.map((ft) => ({
      ...ft,
      fish_audio_id: getReporterVoiceId(ft.reportero) || null,
    }));

    // ============================================
    // PASO 5: Validar requisitos finales
    // ============================================
    const validacionRequisitos = validateFulltrackRequirements(fulltracks);

    // ============================================
    // RESPUESTA FINAL
    // ============================================
    return res.status(200).json({
      exito: true,
      timestamp: new Date().toISOString(),
      portada_info: {
        remitente: remitente || "desconocido",
        asunto: asunto || "sin asunto",
        legibilidad: validacionesIniciales.agente1_ocr.legibilidad,
      },
      noticias_extraidas: noticias.length,
      fulltracks_generados: fulltracks.length,
      fulltracks: fulltracksConVoces,
      validaciones_agentes: {
        agente1_ocr: validacionesIniciales.agente1_ocr,
        agente2_estructura: validacionesFinales.agente2_estructura,
        agente3_timings: validacionesFinales.agente3_timings,
        agente4_audio: validacionesFinales.agente4_audio,
      },
      validaciones_finales: validacionRequisitos,
      estado_general:
        validacionRequisitos.advertencias.length === 0
          ? "aprobado"
          : "con_advertencias",
      listo_para_audio:
        validacionRequisitos.validos === fulltracks.length,
    });
  } catch (error) {
    console.error("Error en process-portada:", error);
    return res.status(500).json({
      error: "Error interno del servidor",
      detalles: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
