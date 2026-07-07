import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const FULLTRACK_SYSTEM_PROMPT = `Eres un productor editorial de noticiero especializado en crear fulltracks breves para voz off a partir de portadas de periódico, notas periodísticas o textos informativos.
Tu tarea es convertir cada nota visible o proporcionada por el usuario en un fulltrack independiente, con estilo de noticiero profesional, claro, directo y con ritmo televisivo.

REGLAS GENERALES:
1. Escribe siempre en español mexicano, con tono periodístico, sobrio y dinámico.
2. Cada fulltrack debe durar aproximadamente 25 segundos leído en voz off.
3. Cada fulltrack debe tener entre 55 y 65 palabras, incluyendo la firma final.
4. No escribas introducciones largas ni explicaciones adicionales.
5. No inventes datos que no estén en la imagen, portada o texto proporcionado.
6. Escribe la noticia de forma DIRECTA, como si el reportero narrara el hecho, no como si describiera lo que dice un documento. Evita citar la fuente ("de acuerdo con la publicación", "la nota señala", "según la portada") salvo en el caso raro de que la información sea genuinamente ambigua o incompleta — y en ese caso, úsalo como excepción puntual, nunca en más de 1 de cada 5 fulltracks.
7. VARÍA OBLIGATORIAMENTE la primera frase de cada fulltrack. No repitas la misma estructura de entrada dos veces seguidas. Alterna entre: mencionar el lugar/institución primero, mencionar la acción primero, mencionar una cifra o dato concreto primero, o plantear el hecho central directo. Ejemplos de arranques variados: "El Congreso de Nuevo León enfrenta...", "Autoridades de Monterrey confirmaron...", "Con 28 años como edad mínima...", "Una nueva medida busca...".
8. No uses lenguaje exagerado, amarillista o de opinión.
9. Mantén estructura de noticiero: entrada informativa directa, desarrollo breve, impacto o contexto, y firma final.
10. Cada nota debe salir como un bloque separado.
11. No repitas el mismo reportero en notas consecutivas, salvo que ya se hayan usado todos los nombres disponibles.

REPORTEROS FIJOS (usa solo estos):
1. Santiago Landa
2. Mariana Robles
3. Diego Barrera
4. Valeria Montemayor
5. Andrés Villaseñor
6. Natalia Lascuráin
7. Ricardo Alvarado
8. Camila Serrano
9. Emilio Garza
10. Lucía Herrera

REGLA DE FIRMAS:
Todos los fulltracks deben terminar exactamente con esta estructura:
PARA EL HORIZONTE EXPRESS, [Nombre del reportero].

ESTRUCTURA DE SALIDA:
Usa este formato:
### [Número]. [Tema o titular breve]
[Fulltrack en un solo párrafo, entre 55 y 65 palabras, con firma final incluida.]

ESTILO DE REDACCIÓN:
Debe sonar como voz off de reportero de noticiero, narrando el hecho directamente. Usa frases claras y variadas para arrancar cada nota, por ejemplo:
- "El Congreso de Nuevo León vuelve a estar bajo cuestionamientos..."
- "Autoridades locales confirmaron esta semana..."
- "Con una nueva disposición, Nuevo León..."
- "La medida generó reacciones..."
- "El resultado representa un golpe para..."

EVITA:
- "En esta nota vamos a hablar de..."
- "Te contamos todos los detalles..."
- Empezar dos fulltracks seguidos con la misma estructura o muletilla
- Abusar de "de acuerdo con la publicación / la nota señala / según la portada" (máximo ocasional, nunca como patrón repetido)
- Opiniones personales
- Burlas
- Frases demasiado largas
- Palabras rebuscadas
- Cierres distintos a la firma establecida`;

export async function generateFulltracks(noticias) {
  try {
    const noticiasText = noticias
      .map((n) => `- ${n.titulo}: ${n.descripcion}`)
      .join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: FULLTRACK_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Genera fulltracks a partir de estas noticias:\n\n${noticiasText}\n\nRecuerda: cada fulltrack entre 55-65 palabras, firma obligatoria, formato ### Número. Título`,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const fulltracksText = response.choices[0].message.content;
    return {
      exito: true,
      fulltracks_raw: fulltracksText,
      parsed: parseFulltracks(fulltracksText),
    };
  } catch (error) {
    return {
      exito: false,
      error: error.message,
    };
  }
}

// Parsea los fulltracks generados al formato JSON
function parseFulltracks(text) {
  const fulltracks = [];
  const bloques = text.split("###").filter((b) => b.trim());

  bloques.forEach((bloque, index) => {
    const lineas = bloque.trim().split("\n");
    const titulo = lineas[0].trim();
    const contenido = lineas.slice(1).join("\n").trim();

    // Extrae el reportero del contenido (busca "PARA EL HORIZONTE EXPRESS, [Nombre]")
    const firmRegex = /PARA EL HORIZONTE EXPRESS, (.+?)\./;
    const match = contenido.match(firmRegex);
    const reportero = match ? match[1].trim() : "Sin asignar";

    // Cuenta palabras
    const palabras = contenido
      .split(/\s+/)
      .filter((p) => p.length > 0).length;

    fulltracks.push({
      numero: index + 1,
      titulo: titulo,
      contenido: contenido,
      reportero: reportero,
      palabras: palabras,
      duracion_estimada: `${Math.round((palabras / 150) * 60)} segundos`,
    });
  });

  return fulltracks;
}

// Valida que los fulltracks cumplan requisitos
export function validateFulltrackRequirements(fulltracks) {
  const validacion = {
    total_fulltracks: fulltracks.length,
    validos: 0,
    advertencias: [],
  };

  fulltracks.forEach((ft, idx) => {
    if (ft.palabras < 55 || ft.palabras > 65) {
      validacion.advertencias.push(
        `Fulltrack ${ft.numero}: ${ft.palabras} palabras (debe ser 55-65)`
      );
    } else if (!ft.contenido.includes("PARA EL HORIZONTE EXPRESS")) {
      validacion.advertencias.push(
        `Fulltrack ${ft.numero}: Falta firma obligatoria`
      );
    } else {
      validacion.validos++;
    }
  });

  return validacion;
}
