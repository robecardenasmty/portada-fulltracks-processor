import { runAllAgents, getReporters, getReporterVoiceId } from "../../lib/agents";
import {
  generateFulltracks,
  validateFulltrackRequirements,
} from "../../lib/openai-client";

export default async function handler(req, res) {
  // Solo POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    let { portada_base64, remitente, asunto } = req.body;

    if (!portada_base64) {
      return res.status(400).json({ error: "Falta portada_base64" });
    }

    // Validar que sea base64 válido (solo caracteres base64)
    if (!portada_base64.match(/^[A-Za-z0-9+/=]+$/)) {
      return res.status(400).json({ 
        error: "base64 inválido - contiene caracteres no permitidos",
        recibido: portada_base64.substring(0, 50) + "..."
      });
    }

    // Asegurar que sea múltiplo de 4 (requerimiento de base64)
    portada_base64 = portada_base64.replace(/\s/g, '');
    const padding = portada_base64.length % 4;
    if (padding) {
      portada_base64 += '='.repeat(4 - padding);
    }

    // ============================================
    // PASO 1: Ejecutar 4 agentes en paralelo
    // ============================================
    const validaciones = await runAllAgents(
      `data:image/jpeg;base64,${portada_base64}`,
      [],
      []
    );

    // Si hay errores críticos en OCR, abortar
    if (validaciones.agente1_ocr.error) {
      return res.status(400).json({
        error: "No se pudo procesar la portada",
        detalles: validaciones.agente1_ocr.detalles,
        validaciones,
      });
    }

    const noticias = validaciones.agente1_ocr.noticias || [];

    if (noticias.length === 0) {
      return res.status(400).json({
        error: "No se extrajeron noticias de la portada",
        validaciones,
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
        validaciones,
      });
    }

    const fulltracks = fulltracksResponse.parsed;

    // ============================================
    // PASO 3: Re-validar con los agentes 2, 3, 4
    // ============================================
    const validacionesFinales = await runAllAgents(
      `data:image/jpeg;base64,${portada_base64}`,
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
        legibilidad: validaciones.agente1_ocr.legibilidad,
      },
      noticias_extraidas: noticias.length,
      fulltracks_generados: fulltracks.length,
      fulltracks: fulltracksConVoces,
      validaciones_agentes: {
        agente1_ocr: validaciones.agente1_ocr,
        agente2_estructura: validaciones.agente2_estructura,
        agente3_timings: validaciones.agente3_timings,
        agente4_audio: validaciones.agente4_audio,
      },
      validaciones_finales: validacionRequisitos,
      estado_general: validacionRequisitos.advertencias.length === 0
        ? "aprobado"
        : "con_advertencias",
      listo_para_audio: validacionRequisitos.validos === fulltracks.length,
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
