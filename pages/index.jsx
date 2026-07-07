import { useState } from "react";

export default function Dashboard() {
  const [portadaBase64, setPortadaBase64] = useState(null);
  const [portadaPreview, setPortadaPreview] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  // Comprime imagen a ~500KB máximo
  const compressImage = async (base64String) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Reduce tamaño si es muy grande
        if (width > 1920 || height > 1440) {
          const ratio = Math.min(1920 / width, 1440 / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Comprime a JPEG con calidad 0.8
        const compressed = canvas.toDataURL("image/jpeg", 0.8);
        resolve(compressed);
      };
      img.src = base64String;
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Muestra que está comprimiendo
    setCargando(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target.result;
        const compressed = await compressImage(base64);
        
        setPortadaBase64(compressed);
        setPortadaPreview(compressed);
        setResultado(null);
        setCargando(false);
      } catch (err) {
        setError(`Error comprimiendo imagen: ${err.message}`);
        setCargando(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const procesarPortada = async () => {
    if (!portadaBase64) {
      setError("Por favor carga una portada primero");
      return;
    }

    setCargando(true);
    setError(null);

    try {
      // Extrae solo la parte base64, sin el prefijo "data:image/..."
      const base64Only = portadaBase64.includes(',') 
        ? portadaBase64.split(',')[1] 
        : portadaBase64;

      console.log("Enviando base64 de", base64Only.length, "caracteres");

      const res = await fetch("/api/process-portada", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portada_base64: base64Only,
          remitente: "test@example.com",
          asunto: "Portada de prueba",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error procesando portada");
        setResultado(data);
      } else {
        setResultado(data);
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>📰 Portada → Fulltracks</h1>
        <p>Procesador de portadas a scripts de TV con agentes IA</p>
      </header>

      <div style={styles.content}>
        {/* SECCIÓN 1: Upload */}
        <section style={styles.section}>
          <h2>1. Cargar Portada</h2>
          <div style={styles.uploadArea}>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={styles.fileInput}
            />
            <p style={styles.uploadText}>PNG, JPG o JPEG (se comprime automáticamente)</p>
          </div>

          {portadaPreview && (
            <div style={styles.preview}>
              <img
                src={portadaPreview}
                alt="Preview"
                style={styles.previewImage}
              />
              <p style={styles.uploadedText}>✓ Portada cargada y comprimida</p>
            </div>
          )}
        </section>

        {/* SECCIÓN 2: Procesar */}
        <section style={styles.section}>
          <h2>2. Procesar con Agentes</h2>
          <button
            onClick={procesarPortada}
            disabled={!portadaBase64 || cargando}
            style={{
              ...styles.button,
              ...(cargando || !portadaBase64 ? styles.buttonDisabled : {}),
            }}
          >
            {cargando ? "⏳ Procesando (30-45s)..." : "▶ Procesar Portada"}
          </button>

          {cargando && (
            <div style={styles.loading}>
              <div style={styles.spinner}></div>
              <p>Los 4 agentes están validando...</p>
              <ul style={styles.agentList}>
                <li>🔍 Agente 1: OCR & Extracción</li>
                <li>✓ Agente 2: Validación Estructural</li>
                <li>⏱ Agente 3: Timings</li>
                <li>🎙 Agente 4: Calidad de Audio</li>
              </ul>
            </div>
          )}

          {error && <div style={styles.errorBox}>{error}</div>}
        </section>

        {/* SECCIÓN 3: Resultados */}
        {resultado && (
          <section style={styles.section}>
            <h2>3. Resultados</h2>

            {/* Estado General */}
            <div
              style={{
                ...styles.statusCard,
                borderColor:
                  resultado.exito && resultado.estado_general === "aprobado"
                    ? "#10b981"
                    : "#f59e0b",
              }}
            >
              <h3>
                {resultado.exito ? "✓ Procesado" : "⚠ Con Errores"}
              </h3>
              <p>
                Estado:{" "}
                <strong>
                  {resultado.estado_general === "aprobado"
                    ? "Aprobado"
                    : "Con Advertencias"}
                </strong>
              </p>
              <p>Fulltracks: {resultado.fulltracks_generados}</p>
              <p>Listo para audio: {resultado.listo_para_audio ? "Sí" : "No"}</p>
            </div>

            {/* Validaciones de Agentes */}
            {resultado.validaciones_agentes && (
              <div style={styles.agentsResults}>
                <h3>Validaciones de Agentes</h3>

                <div style={styles.agentCard}>
                  <h4>🔍 Agente 1: OCR</h4>
                  {resultado.validaciones_agentes.agente1_ocr.error ? (
                    <p style={styles.errorText}>
                      ❌ {resultado.validaciones_agentes.agente1_ocr.mensaje}
                    </p>
                  ) : (
                    <>
                      <p>
                        Legibilidad:{" "}
                        {resultado.validaciones_agentes.agente1_ocr.legibilidad}
                      </p>
                      <p>
                        Noticias extraídas:{" "}
                        {
                          resultado.validaciones_agentes.agente1_ocr.noticias
                            ?.length
                        }
                      </p>
                    </>
                  )}
                </div>

                <div style={styles.agentCard}>
                  <h4>✓ Agente 2: Estructura</h4>
                  {resultado.validaciones_agentes.agente2_estructura.error ? (
                    <p style={styles.errorText}>⚠ Error en validación</p>
                  ) : (
                    <p>
                      Validaciones:{" "}
                      {resultado.validaciones_agentes.agente2_estructura.resumen}
                    </p>
                  )}
                </div>

                <div style={styles.agentCard}>
                  <h4>⏱ Agente 3: Timings</h4>
                  {resultado.validaciones_agentes.agente3_timings.error ? (
                    <p style={styles.errorText}>⚠ Error en timings</p>
                  ) : (
                    <p>
                      {
                        resultado.validaciones_agentes.agente3_timings
                          .resumen
                      }
                    </p>
                  )}
                </div>

                <div style={styles.agentCard}>
                  <h4>🎙 Agente 4: Audio</h4>
                  {resultado.validaciones_agentes.agente4_audio.error ? (
                    <p style={styles.errorText}>⚠ Error en validación</p>
                  ) : (
                    <p>
                      {resultado.validaciones_agentes.agente4_audio.resumen_general}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Fulltracks */}
            {resultado.fulltracks && resultado.fulltracks.length > 0 && (
              <div style={styles.fulltracksSection}>
                <h3>📋 Fulltracks Generados</h3>
                {resultado.fulltracks.map((ft, idx) => (
                  <div key={idx} style={styles.fulltrackCard}>
                    <div style={styles.fulltrackHeader}>
                      <h4>
                        {ft.numero}. {ft.titulo}
                      </h4>
                      <span style={styles.badge}>{ft.reportero}</span>
                    </div>
                    <p style={styles.fulltrackText}>{ft.contenido}</p>
                    <div style={styles.fulltrackMeta}>
                      <span>📝 {ft.palabras} palabras</span>
                      <span>⏱ {ft.duracion_estimada}</span>
                      {ft.fish_audio_id && (
                        <span>🎙 ID: {ft.fish_audio_id.slice(0, 8)}...</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Botón Enviar a n8n */}
            {resultado.listo_para_audio && (
              <button
                onClick={() =>
                  console.log("Enviar a n8n:", resultado)
                }
                style={styles.buttonSuccess}
              >
                ✓ Listo para Enviar a n8n + Fish Audio
              </button>
            )}
          </section>
        )}
      </div>

      <footer style={styles.footer}>
        <p>
          RC Portada Processor • Vercel + Claude API + OpenAI GPT + Fish Audio
        </p>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#0f172a",
    color: "#e2e8f0",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  header: {
    backgroundColor: "#1e293b",
    padding: "2rem",
    textAlign: "center",
    borderBottom: "2px solid #3b82f6",
  },
  content: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "2rem 1rem",
  },
  section: {
    backgroundColor: "#1e293b",
    padding: "2rem",
    marginBottom: "2rem",
    borderRadius: "8px",
    border: "1px solid #334155",
  },
  uploadArea: {
    border: "2px dashed #3b82f6",
    borderRadius: "8px",
    padding: "2rem",
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.3s",
  },
  fileInput: {
    display: "block",
    margin: "0 auto",
    cursor: "pointer",
  },
  uploadText: {
    marginTop: "0.5rem",
    fontSize: "0.9rem",
    color: "#94a3b8",
  },
  preview: {
    marginTop: "1.5rem",
    textAlign: "center",
  },
  previewImage: {
    maxWidth: "100%",
    maxHeight: "300px",
    borderRadius: "8px",
    border: "1px solid #334155",
  },
  uploadedText: {
    marginTop: "0.5rem",
    color: "#10b981",
    fontWeight: "bold",
  },
  button: {
    padding: "0.75rem 1.5rem",
    fontSize: "1rem",
    backgroundColor: "#3b82f6",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    transition: "background 0.3s",
  },
  buttonDisabled: {
    backgroundColor: "#64748b",
    cursor: "not-allowed",
    opacity: 0.6,
  },
  buttonSuccess: {
    padding: "0.75rem 1.5rem",
    fontSize: "1rem",
    backgroundColor: "#10b981",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    marginTop: "1rem",
  },
  loading: {
    marginTop: "2rem",
    textAlign: "center",
    padding: "2rem",
    backgroundColor: "#0f172a",
    borderRadius: "8px",
  },
  spinner: {
    display: "inline-block",
    width: "40px",
    height: "40px",
    border: "4px solid #3b82f6",
    borderTop: "4px solid transparent",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  agentList: {
    marginTop: "1rem",
    listStyle: "none",
    padding: 0,
    textAlign: "left",
  },
  errorBox: {
    marginTop: "1rem",
    padding: "1rem",
    backgroundColor: "#7f1d1d",
    borderLeft: "4px solid #ef4444",
    borderRadius: "6px",
    color: "#fca5a5",
  },
  errorText: {
    color: "#f87171",
  },
  statusCard: {
    padding: "1.5rem",
    backgroundColor: "#0f172a",
    border: "2px solid",
    borderRadius: "8px",
    marginBottom: "1.5rem",
  },
  agentsResults: {
    marginTop: "2rem",
  },
  agentCard: {
    padding: "1rem",
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "6px",
    marginBottom: "1rem",
  },
  fulltracksSection: {
    marginTop: "2rem",
  },
  fulltrackCard: {
    padding: "1.5rem",
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "6px",
    marginBottom: "1rem",
  },
  fulltrackHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem",
  },
  badge: {
    display: "inline-block",
    padding: "0.25rem 0.75rem",
    backgroundColor: "#3b82f6",
    borderRadius: "20px",
    fontSize: "0.85rem",
    fontWeight: "bold",
  },
  fulltrackText: {
    fontStyle: "italic",
    color: "#cbd5e1",
    marginBottom: "1rem",
    lineHeight: "1.6",
  },
  fulltrackMeta: {
    display: "flex",
    gap: "1rem",
    fontSize: "0.85rem",
    color: "#94a3b8",
  },
  footer: {
    textAlign: "center",
    padding: "2rem",
    borderTop: "1px solid #334155",
    color: "#64748b",
  },
};

// Agrega animación CSS
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}
