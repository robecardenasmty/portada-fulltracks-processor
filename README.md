# 📰 Portada → Fulltracks Processor

Sistema automatizado que convierte portadas de periódico en fulltracks de voz para TV usando agentes IA + OpenAI GPT + Fish Audio.

## 🎯 Flujo

```
n8n (Gmail Trigger)
  ↓
Portada → API Vercel
  ↓
4 Agentes Claude (paralelo)
  ├─ Agente 1: OCR + Extrae noticias
  ├─ Agente 2: Valida estructura
  ├─ Agente 3: Revisa timings
  └─ Agente 4: Calidad de audio
  ↓
OpenAI GPT (Genera fulltracks)
  ↓
Fish Audio IDs asignados (10 reporteros)
  ↓
Respuesta JSON → n8n
  ↓
n8n → Fish Audio API (genera audios)
  ↓
Google Drive (guarda archivos)
```

## ⚙️ Instalación (SIN CLI, 100% WEB)

### 1. Crear el repositorio en GitHub

1. Ve a **github.com** → **New Repository**
2. Nombre: `portada-fulltracks-processor`
3. Public
4. Click **Create**

### 2. Agregar archivos vía GitHub Web UI

Para cada archivo, ve al repo → **Add file** → **Create new file**:

**Estructura esperada:**
```
portada-fulltracks-processor/
├── package.json
├── next.config.js
├── .env.local.example
├── README.md
├── pages/
│   ├── index.jsx
│   └── api/
│       └── process-portada.js
└── lib/
    ├── agents.js
    └── openai-client.js
```

### 3. Configurar Vercel (sin CLI)

1. Ve a **vercel.com**
2. Click **New Project**
3. Selecciona el repo `portada-fulltracks-processor`
4. Click **Import**
5. En **Environment Variables**, agrega:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   OPENAI_API_KEY=sk-...
   FISH_AUDIO_API_KEY=tu-api-key
   ```
6. Click **Deploy**

**Tu app estará en:** `https://portada-fulltracks-processor.vercel.app`

---

## 🔑 Variables de Entorno

Copia `.env.local.example` a `.env.local` localmente, o agrégalas en Vercel:

```
ANTHROPIC_API_KEY=sk-ant-xxxxx
OPENAI_API_KEY=sk-xxxxx
FISH_AUDIO_API_KEY=xxxxx
AGENT_TIMEOUT=45000
```

---

## 📡 Integración con n8n

En tu workflow n8n, después de descargar la portada:

### Nodo HTTP Request:

```
POST https://portada-fulltracks-processor.vercel.app/api/process-portada

Body (JSON):
{
  "portada_base64": "{{ $json.parts[0].body }}",
  "remitente": "{{ $json.from }}",
  "asunto": "{{ $json.subject }}"
}
```

### Respuesta esperada:

```json
{
  "exito": true,
  "fulltracks": [
    {
      "numero": 1,
      "titulo": "...",
      "contenido": "...",
      "reportero": "Santiago Landa",
      "palabras": 60,
      "duracion_estimada": "25 segundos",
      "fish_audio_id": "5a7d7405d30a4045975ddd2c2c14bf2c"
    }
  ],
  "listo_para_audio": true
}
```

---

## 🎙️ Reporteros y Voice IDs (Fish Audio)

```
1. Santiago Landa → 5a7d7405d30a4045975ddd2c2c14bf2c
2. Mariana Robles → fb146e57407540f0be6863063d94bea5
3. Diego Barrera → d81087c7bc264a06b3d243b52f91477d
4. Valeria Montemayor → 420c2c8decaa48818a73f0e0672a82f3
5. Andrés Villaseñor → 5e701da3e85d4720a1d00ec1f2f6b4b4
6. Natalia Lascuráin → 86d76f757e794ee68ade7875c3fe8310
7. Ricardo Alvarado → 1a81186975ec41eba1e68fd563e9be4a
8. Camila Serrano → 9121eefdd6154365bb4c7c087cff1036
9. Emilio Garza → 19f72e1f83d54baeac149cbf4f5f1b50
10. Lucía Herrera → 9626fb0595f840c5bad68e6f8365dbd4
```

---

## 🧠 Agentes Validadores

Cada agente es un Claude Sonnet independiente corriendo en paralelo:

### Agente 1: OCR + Extracción
- Analiza imagen de portada
- Extrae noticias principales
- Reporta legibilidad

### Agente 2: Validación Estructural
- Verifica que cada noticia tenga info suficiente
- Valida secciones (política, local, etc.)
- Asegura que haya contenido para fulltrack

### Agente 3: Timings
- Cuenta palabras (55-65 requeridas)
- Estima duración (25 seg aprox)
- Valida flujo de lectura

### Agente 4: Calidad de Audio
- Verifica pronunciabilidad para IA
- Revisa puntuación (pausas naturales)
- Valida tono periodístico

---

## 🚀 Testing Local (Opcional)

Si quieres probar localmente con Node.js instalado:

```bash
npm install
npm run dev
```

Luego ve a `http://localhost:3000`

---

## 📋 Ejemplo de Fulltrack Generado

```
### 1. Congreso en cuestionamientos

El Congreso de Nuevo León vuelve a estar bajo cuestionamientos por decisiones de política interna. 
De acuerdo con la publicación, la medida ha generado reacciones encontradas entre legisladores. 
El resultado representa un escenario complejo para el próximo período legislativo. 
PARA EL HORIZONTE EXPRESS, Santiago Landa.
```

**Palabra count:** 58
**Duración estimada:** 25 segundos
**Reportero:** Santiago Landa
**Fish Audio ID:** 5a7d7405d30a4045975ddd2c2c14bf2c

---

## 🛠️ Stack

- **Frontend:** React (Next.js)
- **Backend:** Vercel Serverless (Node.js)
- **IA:** Claude API (4 agentes) + OpenAI GPT-4
- **Audio:** Fish Audio API
- **Database:** No required (stateless)

---

## 📞 Soporte

Cualquier problema:
1. Revisa los logs en **Vercel Dashboard** → **Functions**
2. Valida que las API keys estén correctas
3. Asegúrate que la portada sea legible (JPG/PNG de calidad)

---

**Creado para El Horizonte Express** 🎙️
