import express from "express";
import path from "path";
import dns from "dns";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Enable CORS for external deployment systems (like Vercel) accessing Cloud Run APIs
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: "15mb" }));

// Lazy initializer for Google Gemini SDK client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("A chave de API (GEMINI_API_KEY) não está configurada. Por favor, adicione seu segred no painel Secrets.");
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// REST full-stack endpoint for Text-to-Speech
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voice, style } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "O texto é obrigatório e precisa ser uma string." });
    }

    const voiceName = voice || "Zephyr";
    const expressiveStyle = style || "natural";

    // Build standard Portuguese TTS prompt directive
    // Instruct Gemini directly in English or Portuguese on the tone
    const promptText = `Por favor, leia o seguinte texto em português em tom de voz ${expressiveStyle}. Mantenha a respiração e a entonação extremamente naturais. Texto:\n${text}`;

    const client = getGeminiClient();

    // Use gemini-3.1-flash-tts-preview model to generate standard high-fidelity audio
    const ttsResponse = await client.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: promptText }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) {
      console.error("Gemini Response:", JSON.stringify(ttsResponse));
      return res.status(500).json({
        error: "O modelo Gemini não retornou nenhum dado de áudio. Verifique se o seu texto é adequado ou tente novamente.",
      });
    }

    // Return successfully
    return res.json({
      success: true,
      audioBase64: base64Audio,
      sampleRate: 24000,
    });
  } catch (error: any) {
    console.error("Erro no processamento da rota /api/tts:", error);
    return res.status(500).json({
      error: error.message || "Erro desconhecido ao processar conversão TTS de áudio.",
    });
  }
});

// Serve health status
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Import Vite middleware dynamically in development mode
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production mode
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[VozViva Server] Servidor executando em http://localhost:${PORT}`);
  });
}

startServer();
