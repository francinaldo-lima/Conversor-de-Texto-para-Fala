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
    
    let msg = error.message || String(error);
    
    // Parse nested JSON strings if present in the message
    try {
      const jsonStart = msg.indexOf("{");
      const jsonEnd = msg.lastIndexOf("}");
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        const jsonStr = msg.substring(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(jsonStr);
        if (parsed.error && parsed.error.message) {
          msg = parsed.error.message;
        } else if (parsed.message) {
          msg = parsed.message;
        }
      }
    } catch (e) {
      // ignore parsing error
    }

    // Handle typical raw quota or translation limits
    if (
      msg.toLowerCase().includes("quota") ||
      msg.toLowerCase().includes("exceeded") ||
      msg.toLowerCase().includes("429") ||
      msg.toLowerCase().includes("resource_exhausted") ||
      msg.toLowerCase().includes("limit")
    ) {
      msg = "Limite de cota de IA excedido (Erro 429: Quota Exceeded). Como este aplicativo utiliza a API gratuita do Google Gemini para síntese de voz nativa, existem limites temporários de requisições por minuto. Por favor, aguarde de 30 a 60 segundos antes de tentar novamente, ou alterne para as 'Vozes do Navegador' ao lado para uso ilimitado e sem limites temporários!";
    }

    return res.status(500).json({
      error: msg,
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
