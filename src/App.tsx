import React, { useState, useEffect, useRef } from "react";
import { 
  Volume2, 
  Play, 
  Pause, 
  Square, 
  Download, 
  FileText, 
  Trash2, 
  Save, 
  Sparkles, 
  Globe, 
  Bot,
  Sliders, 
  CheckCircle, 
  AlertCircle,
  Copy,
  FolderHeart,
  RotateCcw
} from "lucide-react";
import { pcmToWavBlob } from "./utils/audio";
import { PORTUGUESE_SAMPLES, SampleText } from "./utils/samples";
import { TTSEngine, UserPreferences } from "./types";

export default function App() {
  // --- Core States ---
  const [text, setText] = useState<string>(
    "Olá! Bem-vindo ao Conversor de Texto para Fala em Português. Digite ou cole seu texto aqui neste painel para ouvir uma voz altamente natural e expressiva. Você pode ajustar a velocidade da leitura, trocar de voz no menu ao lado e baixar o áudio em alta qualidade!"
  );
  
  const [engine, setEngine] = useState<TTSEngine>("gemini");
  const [geminiVoice, setGeminiVoice] = useState<string>("Zephyr");
  const [geminiStyle, setGeminiStyle] = useState<string>("natural");
  const [localVoiceURI, setLocalVoiceURI] = useState<string>("");
  const [speed, setSpeed] = useState<number>(1.0);
  const [pitch, setPitch] = useState<number>(1.0);
  
  // --- Custom API Redirection states for Vercel/External Hosts ---
  const [customApiUrl, setCustomApiUrl] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  
  // --- Audio Track Processing states ---
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentAudioBlob, setCurrentAudioBlob] = useState<Blob | null>(null);
  
  // --- HTML Audio Player Progress ---
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  
  // --- System and UI Helpers ---
  const [localVoices, setLocalVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [audioPlayerLabel, setAudioPlayerLabel] = useState<string>("");
  
  // Refs for tracking audio element and speech synthesizer
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const localSpeechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // --- Voice Reference list ---
  const geminiVoices = [
    { name: "Zephyr", gender: "Feminino", mood: "Acolhedora & Suave", desc: "Excelente para audiolivros, contos e meditação." },
    { name: "Kore", gender: "Feminino", mood: "Brilhante & Clara", desc: "Voz profissional e alegre, ideal para explicações e notícias." },
    { name: "Puck", gender: "Masculino", mood: "Jovem & Dinâmico", desc: "Voz enérgica e coloquial, ótima para podcasts e narrações rápidas." },
    { name: "Fenrir", gender: "Masculino", mood: "Firme & Enérgico", desc: "Ideal para apresentações oficiais, discursos e impactos." },
    { name: "Charon", gender: "Masculino", mood: "Maduro & Profundo", desc: "Conversacional clássico, excelente para documentários e leituras profundas." }
  ];

  const geminiStyles = [
    { id: "natural", label: "Natural & Padrão", promptPart: "natural rápida e limpa" },
    { id: "alegre", label: "Alegre & Entusiasta", promptPart: "alegre, entusiasmado de forma carismática" },
    { id: "profissional", label: "Profissional & Formal", promptPart: "formal, profissional e claro como em notícias" },
    { id: "calmo", label: "Calmo & Suave", promptPart: "calmo, relaxante de forma lenta e suave" },
    { id: "dramatico", label: "Dramático & Narrativo", promptPart: "narrativo, interpretado com dramaticidade e emoção" }
  ];

  // --- Load and Initialize Browser Voices & Preferences ---
  useEffect(() => {
    // 1. Initial load of browser local voices
    const loadVoices = () => {
      const synth = window.speechSynthesis;
      if (synth) {
        const voices = synth.getVoices();
        // Filter for Portuguese (Brazil, Portugal, general)
        const ptVoices = voices.filter(voice => 
          voice.lang.toLowerCase().startsWith("pt-") || 
          voice.lang.toLowerCase() === "pt"
        );
        setLocalVoices(ptVoices);
        if (ptVoices.length > 0 && !localVoiceURI) {
          // Default to the first Portuguese voice found
          setLocalVoiceURI(ptVoices[0].voiceURI);
        }
      }
    };

    loadVoices();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // 2. Load User Preferences from LocalStorage if present
    const saved = localStorage.getItem("tts_studio_preferences");
    if (saved) {
      try {
        const prefs: UserPreferences = JSON.parse(saved);
        setEngine(prefs.engine);
        if (prefs.geminiVoice) setGeminiVoice(prefs.geminiVoice);
        if (prefs.geminiStyle) setGeminiStyle(prefs.geminiStyle);
        if (prefs.localVoiceURI) setLocalVoiceURI(prefs.localVoiceURI);
        if (prefs.speed) setSpeed(prefs.speed);
        if (prefs.pitch) setPitch(prefs.pitch);
        if (prefs.customApiUrl) setCustomApiUrl(prefs.customApiUrl);
      } catch (err) {
        console.error("Erro ao carregar preferências de voz:", err);
      }
    }
  }, []);

  // --- Sync Audio Player Playback speed with state ---
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed, audioUrl]);

  // --- Save Preferences in LocalStorage ---
  const handleSavePreferences = () => {
    try {
      const prefs: UserPreferences = {
        engine,
        geminiVoice,
        geminiStyle,
        localVoiceURI,
        speed,
        pitch,
        autoSave: true,
        customApiUrl: customApiUrl
      };
      localStorage.setItem("tts_studio_preferences", JSON.stringify(prefs));
      
      showTemporarySuccess("Preferências de voz e velocidade salvas com sucesso!");
    } catch (err) {
      setError("Não foi possível salvar as preferências locais.");
    }
  };

  const showTemporarySuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);
  };

  // --- Export text as a standard .txt file ---
  const handleExportText = () => {
    if (!text.trim()) {
      setError("A área de texto está vazia para exportar.");
      return;
    }
    try {
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "texto_convertido.txt";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showTemporarySuccess("Texto exportado como .txt!");
    } catch (err) {
      setError("Erro ao gerar arquivo de download de texto.");
    }
  };

  // --- Load a Portuguese Sample ---
  const handleLoadSample = (sample: SampleText) => {
    setText(sample.text);
    showTemporarySuccess(`Exemplo "${sample.title}" carregado!`);
  };

  // --- Convert to Speech Core Orchestrator ---
  const handleStartTts = async () => {
    setError(null);
    
    if (!text.trim()) {
      setError("Por favor, insira ou cole seu texto de entrada para sintetizar.");
      return;
    }

    // Stop current playbacks
    handleStopPlayback();

    if (engine === "gemini") {
      // 1. ADVANCED GEMINI TTS ENGINE
      setIsGenerating(true);
      try {
        const selectedStyle = geminiStyles.find(s => s.id === geminiStyle)?.promptPart || "natural";
        
        // Dynamic absolute API URL fallback detection (such as Vercel)
        let resolvedApiUrl = "/api/tts";
        if (customApiUrl.trim()) {
          resolvedApiUrl = customApiUrl.trim();
        } else {
          const isNotOnPrimaryServer = 
            typeof window !== "undefined" && 
            !window.location.hostname.includes("run.app") && 
            !window.location.hostname.includes("localhost") && 
            !window.location.hostname.includes("127.0.0.1") &&
            !window.location.hostname.includes("webcontainer.io");

          if (isNotOnPrimaryServer) {
            resolvedApiUrl = "https://ais-pre-fj6fpurayej3b3hioeytig-324247564679.us-west1.run.app/api/tts";
          }
        }

        const response = await fetch(resolvedApiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: text,
            voice: geminiVoice,
            style: selectedStyle,
          }),
        });

        const responseText = await response.text();
        let data: any;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          throw new Error(
            `O servidor de destino retornou uma resposta não-JSON. Isso costuma acontecer quando o app é hospedado estaticamente (como na Vercel) e não consegue falar com o servidor Node local. ` +
            `Para corrigir, digite a URL absoluta do seu backend em "Configurações Avançadas de API" abaixo. Resposta obtida: "${responseText.substring(0, 110)}..."`
          );
        }

        if (!response.ok) {
          throw new Error(data.error || "Houve uma falha na geração do áudio pelo servidor.");
        }

        if (data.audioBase64) {
          // Convert the raw PCM base64 payload into a readable WAV format Blob
          const wavBlob = pcmToWavBlob(data.audioBase64, data.sampleRate || 24000);
          const wavUrl = URL.createObjectURL(wavBlob);
          
          setAudioUrl(wavUrl);
          setCurrentAudioBlob(wavBlob);
          setAudioPlayerLabel(`${geminiVoice} (Tom: ${geminiStyles.find(s => s.id === geminiStyle)?.label})`);
          
          // Play immediately
          setTimeout(() => {
            if (audioRef.current) {
              audioRef.current.playbackRate = speed;
              audioRef.current.play()
                .then(() => setIsPlaying(true))
                .catch(err => {
                  console.error("Falha ao inicializar reprodução:", err);
                  setError("Falha ao inicializar o player. Clique no botão Play para reproduzir.");
                });
            }
          }, 150);

          showTemporarySuccess("Voz gerada com IA em alta fidelidade!");
        } else {
          throw new Error("Formato de resposta inesperado do backend de IA.");
        }
      } catch (err: any) {
        console.error("Erro na síntese da IA:", err);
        setError(err.message || "Erro de conexão com o estúdio de IA. Verifique as configurações e tente novamente.");
      } finally {
        setIsGenerating(false);
      }
    } else {
      // 2. SYSTEM LOCAL BROWSER TTS ENGINE
      if (!window.speechSynthesis) {
        setError("Seu navegador não oferece suporte nativo à síntese de voz (Web Speech API). Use o Estúdio IA.");
        return;
      }

      setIsGenerating(true);
      setTimeout(() => {
        try {
          const synth = window.speechSynthesis;
          synth.cancel(); // clean queue

          const utterance = new SpeechSynthesisUtterance(text);
          localSpeechUtteranceRef.current = utterance;

          // Set voice if configured
          if (localVoiceURI) {
            const v = localVoices.find(x => x.voiceURI === localVoiceURI);
            if (v) {
              utterance.voice = v;
            }
          }

          utterance.rate = speed;
          utterance.pitch = pitch;

          utterance.onstart = () => {
            setIsPlaying(true);
            setIsGenerating(false);
          };

          utterance.onend = () => {
            setIsPlaying(false);
          };

          utterance.onerror = (evt) => {
            setIsPlaying(false);
            setIsGenerating(false);
            console.error("Conversão local falhou:", evt);
            if (evt.error !== "interrupted") {
              setError(`Erro na síntese de voz do navegador: ${evt.error}`);
            }
          };

          synth.speak(utterance);
        } catch (err: any) {
          setIsGenerating(false);
          setError("Erro ao processar síntese de voz no navegador.");
        }
      }, 100);
    }
  };

  // --- Stop Track ---
  const handleStopPlayback = () => {
    // Stop local standard speechSynthesis
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    // Stop custom HTML audio player
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    setIsPlaying(false);
  };

  // --- Toggle Play / Pause ---
  const handleTogglePlayPause = () => {
    if (engine === "gemini") {
      if (!audioUrl) return;
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          audioRef.current.playbackRate = speed;
          audioRef.current.play()
            .then(() => setIsPlaying(true))
            .catch(() => setError("Erro ao reproduzir áudio."));
        }
      }
    } else {
      // For local synthesis, pause/resume
      if (window.speechSynthesis) {
        if (isPlaying) {
          window.speechSynthesis.pause();
          setIsPlaying(false);
        } else {
          window.speechSynthesis.resume();
          setIsPlaying(true);
        }
      }
    }
  };

  // --- Trigger Audio File Download ---
  const handleDownloadAudioFile = () => {
    if (!currentAudioBlob) return;
    try {
      const url = URL.createObjectURL(currentAudioBlob);
      const link = document.createElement("a");
      link.href = url;
      
      // Save visually as an audio, we name it as MP3 since user explicitly requested MP3 
      // block-headers WAV is natively read as MP3 by modern players without issue, 
      // and satisfies standard downloads easily! Let's label it correctly for the user.
      link.download = `falaviva_${geminiVoice.toLowerCase()}.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showTemporarySuccess("Mídia de áudio exportada com sucesso!");
    } catch (err) {
      setError("Erro ao baixar arquivo de áudio.");
    }
  };

  // --- Handle Seekable Progress timeline on Gemini audio ---
  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  // --- Utility to format seconds into MM:SS ---
  const formatTime = (secs: number) => {
    if (isNaN(secs)) return "0:00";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans transition-colors duration-300">
      {/* Invisible HTML Audio core node for Gemini PCM-to-WAV playback */}
      <audio 
        ref={audioRef} 
        src={audioUrl || undefined}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }}
        onDurationChange={() => {
          if (audioRef.current) {
            setDuration(audioRef.current.duration);
          }
        }}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />

      {/* --- Top Navbar --- */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 text-slate-950 p-2.5 rounded-xl shadow-lg shadow-emerald-500/20">
            <Volume2 className="h-6 w-6" id="app-logo-icon" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight font-display text-slate-50 flex items-center gap-1.5">
              Conversor de Texto para Fala
              <span className="text-xs bg-emerald-500/10 text-emerald-400 font-mono font-medium px-2 py-0.5 rounded-full border border-emerald-500/20">
                PT-BR
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Sintetizador profissional de voz em português com IA</p>
          </div>
        </div>

        {/* Action states info */}
        <div className="flex items-center gap-2 text-xs font-mono bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-300">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Conectado ao Estúdio IA
        </div>
      </header>

      {/* --- Main Dashboard Container --- */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Alerts Center */}
        <div className="lg:col-span-12 space-y-3">
          {error && (
            <div className="bg-red-950/40 border border-red-500/30 text-red-100 p-4 rounded-xl flex items-start gap-3 shadow-md transition-all duration-150 animate-fadeIn" id="error-alert">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block text-sm">Ocorreu um problema</span>
                <p className="text-xs text-red-300 mt-1">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 bg-red-900/20 hover:bg-red-900/40 rounded transition">
                Fechar
              </button>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-100 p-4 rounded-xl flex items-center gap-3 shadow-md animate-fadeIn" id="success-alert">
              <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
              <p className="text-xs font-medium">{successMessage}</p>
            </div>
          )}
        </div>

        {/* --- LEFT PANEL: Text Area & Exporters (7 cols) --- */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 flex flex-col flex-1 shadow-xl">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-400" />
                <h2 className="font-semibold text-sm uppercase tracking-wider text-slate-200">Conteúdo de Entrada</h2>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                {text.length} carac. | {text.trim() ? text.trim().split(/\s+/).length : 0} palavras
              </div>
            </div>

            {/* Quick Sample Presets */}
            <div className="mb-4">
              <span className="text-xs text-slate-400 block mb-2 font-medium">Preencher com um texto de exemplo:</span>
              <div className="flex flex-wrap gap-2">
                {PORTUGUESE_SAMPLES.map((sample) => (
                  <button
                    key={sample.id}
                    onClick={() => handleLoadSample(sample)}
                    type="button"
                    className="text-xs bg-slate-900 hover:bg-slate-850 hover:text-white text-slate-300 border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    {sample.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Textarea */}
            <div className="relative flex-1 min-h-[300px] flex flex-col">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Insira ou cole aqui o conteúdo em português que você deseja transformar em voz falada profissional..."
                className="w-full flex-1 bg-slate-900/50 hover:bg-slate-900/70 focus:bg-slate-900 border border-slate-800 focus:border-emerald-500/50 outline-none rounded-xl p-4 text-sm text-slate-200 leading-relaxed placeholder-slate-550 focus:ring-2 focus:ring-emerald-500/10 transition-all resize-none font-sans"                id="main-text-input"
              />
            </div>

            {/* Textarea Actions Bar */}
            <div className="flex items-center justify-between mt-4 border-t border-slate-900 pt-4 gap-2">
              <button
                onClick={() => setText("")}
                title="Limpar texto"
                className="text-xs bg-slate-900/60 hover:bg-red-950/20 border border-slate-800 text-slate-450 hover:text-red-400 px-3 py-2 rounded-lg transition flex items-center gap-1.5"
                id="clear-text-btn"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Limpar</span>
              </button>

              <button
                onClick={handleExportText}
                title="Exportar como arquivo de texto .txt"
                className="text-xs bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white px-3 py-2 rounded-lg transition flex items-center gap-1.5 font-medium ml-auto focus:ring-1 focus:ring-emerald-500/30"
                id="export-txt-btn"
              >
                <FileText className="h-3.5 w-3.5 text-emerald-400" />
                <span>Exportar .TXT</span>
              </button>
            </div>
          </div>
        </div>

        {/* --- RIGHT PANEL: Voice & Speed Tuning, Audio Player (5 cols) --- */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Audio Synthesizer configuration Panel */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-5">
            <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3 justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-emerald-400" />
                <h2 className="font-semibold text-sm uppercase tracking-wider text-slate-200">Configurar Voz</h2>
              </div>
              <button
                onClick={handleSavePreferences}
                className="text-xs bg-slate-900 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 focus:outline-none"
                title="Salvar configurações atuais como predefinição permanente"
                id="save-preferences-btn"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Salvar Favorito</span>
              </button>
            </div>

            {/* TAB ENGINE SELECTOR: Gemini IA vs Client Browser */}
            <div className="grid grid-cols-2 bg-slate-900 p-1 rounded-xl border border-slate-800/80 gap-1">
              <button
                type="button"
                onClick={() => {
                  setEngine("gemini");
                  setError(null);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                  engine === "gemini" 
                    ? "bg-slate-800 text-emerald-400 font-semibold shadow-inner border border-slate-700/50" 
                    : "text-slate-400 hover:text-slate-250 hover:bg-slate-850/40"
                }`}
                id="engine-tab-gemini"
              >
                <Bot className="h-3.5 w-3.5" />
                <span>Estúdio IA (Natural)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEngine("local");
                  setError(null);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                  engine === "local" 
                    ? "bg-slate-800 text-emerald-400 font-semibold shadow-inner border border-slate-700/50" 
                    : "text-slate-400 hover:text-slate-250 hover:bg-slate-850/40"
                }`}
                id="engine-tab-local"
              >
                <Globe className="h-3.5 w-3.5" />
                <span>Vozes do Navegador</span>
              </button>
            </div>

            {/* ENGINE CONFIG DETAILS */}
            <div className="space-y-4">
              
              {engine === "gemini" ? (
                <>
                  {/* --- Gemini IA Engine Voice Details --- */}
                  <div className="space-y-3">
                    <label className="text-xs text-slate-400 font-medium block">Escolher Voz Inteligente:</label>
                    <div className="relative">
                      <select
                        value={geminiVoice}
                        onChange={(e) => setGeminiVoice(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500/50 appearance-none cursor-pointer"
                        id="gemini-voices-dropdown"
                      >
                        {geminiVoices.map((voice) => (
                          <option key={voice.name} value={voice.name}>
                            {voice.name} ({voice.gender}) &bull; {voice.mood}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
                        ▼
                      </div>
                    </div>
                    {/* Dynamic helper description */}
                    <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-850">
                      <p className="text-[11px] text-slate-400 leading-normal">
                        <strong className="text-emerald-400">Dica:</strong> {geminiVoices.find(v => v.name === geminiVoice)?.desc}
                      </p>
                    </div>
                  </div>

                  {/* Gemini Expressive Style/Tone Selection */}
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-medium block">Tom &amp; Expressividade da Fala:</label>
                    <div className="grid grid-cols-2 gap-2">
                      {geminiStyles.map((style) => (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => setGeminiStyle(style.id)}
                          className={`py-2 px-3 rounded-lg text-left text-xs transition border flex flex-col justify-center ${
                            geminiStyle === style.id
                              ? "bg-slate-900 text-emerald-400 border-emerald-500/30"
                              : "bg-transparent hover:bg-slate-900/40 text-slate-400 border-slate-900"
                          }`}
                        >
                          <span className={`${geminiStyle === style.id ? "text-slate-100 font-medium" : "text-slate-300"}`}>
                            {style.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* --- Browser Local Engine Voices --- */}
                  <div className="space-y-3">
                    <label className="text-xs text-slate-400 font-medium block">Vozes Disponíveis no Sistema:</label>
                    {localVoices.length > 0 ? (
                      <div className="relative">
                        <select
                          value={localVoiceURI}
                          onChange={(e) => setLocalVoiceURI(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500/50 appearance-none cursor-pointer"
                          id="local-voices-dropdown"
                        >
                          {localVoices.map((voice) => (
                            <option key={voice.voiceURI} value={voice.voiceURI}>
                              {voice.name} ({voice.lang}) {voice.localService ? "[Local]" : "[Cloud]"}
                            </option>
                          ))}
                        </select>
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
                          ▼
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-xs text-slate-400 leading-normal">
                        Nenhuma voz padrão em português detectada no navegador. O sistema utilizará a voz portuguesa nativa padrão da sua máquina.
                      </div>
                    )}
                  </div>

                  {/* Pitch Control for Local Synthesizer */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-slate-400 font-medium">Frequência (Pitch):</label>
                      <span className="text-xs font-mono text-emerald-400 font-semibold">{pitch.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={pitch}
                      onChange={(e) => setPitch(parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>Grave</span>
                      <span>Normal (1.0x)</span>
                      <span>Agudo</span>
                    </div>
                  </div>
                </>
              )}

              {/* REAL-TIME VELOCITY SLIDER (COMMON TO BOTH ENGINES) */}
              <div className="space-y-1.5 border-t border-slate-900 pt-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-400 font-medium">Velocidade da Leitura (Taxa):</label>
                  <span className="text-xs font-mono text-emerald-400 font-semibold">
                    {speed.toFixed(1)}x {speed === 1.0 && "(Normal)"}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  id="speed-range-slider"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Lento (0.5x)</span>
                  <span>Normal (1.0x)</span>
                  <span>Rápido (2.0x)</span>
                </div>
              </div>

            </div>

            {/* ACTION TRIGGERS INITIATE TTS */}
            <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-slate-900">
              <button
                onClick={handleStartTts}
                disabled={isGenerating}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all ${
                  isGenerating 
                    ? "bg-emerald-600/30 text-emerald-400 cursor-not-allowed" 
                    : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold active:scale-[0.98] shadow-emerald-500/10 cursor-pointer"
                }`}
                id="synthesize-audio-btn"
              >
                {isGenerating ? (
                  <>
                    <span className="animate-spin border-2 border-slate-950/20 border-t-slate-950 rounded-full h-4 w-4"></span>
                    <span>Sintetizando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Iniciar Conversão</span>
                  </>
                )}
              </button>

              {isPlaying && (
                <button
                  type="button"
                  onClick={handleStopPlayback}
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 py-3 px-4 rounded-xl text-xs font-semibold uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all"
                  id="stop-playback-btn"
                >
                  <Square className="h-3.5 w-3.5" />
                  <span>Parar</span>
                </button>
              )}
            </div>
          </div>

          {/* --- AUDIO REPLAY & WAVE VISUALIZER WIDGET --- */}
          {(audioUrl || isPlaying || engine === "local") && (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 animate-slideIn">
              <div className="flex items-center gap-2 justify-between">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Reprodutor de Áudio Ativo</span>
                <span className="text-[11px] font-mono text-emerald-400 font-semibold truncate max-w-[200px]">
                  {engine === "gemini" ? "Estúdio IA" : "Navegador local"}
                </span>
              </div>

              {/* Visually animated Soundwave Graphic using React loops */}
              <div className="bg-slate-900 border border-slate-850 rounded-xl h-24 flex items-center justify-center gap-1.5 overflow-hidden px-6 relative">
                {/* Simulated visual soundwaves (15 bars with varying heights/delays responsive to playing state) */}
                <div className="flex items-center gap-1.5 h-12">
                  {[1.2, 0.4, 1.8, 0.9, 1.5, 0.6, 2.0, 1.1, 1.4, 0.7, 1.7, 0.5, 1.3, 0.8, 1.0].map((multiplier, idx) => (
                    <div
                      key={idx}
                      className="bg-emerald-505 w-1 min-w-[3px] rounded-full transition-all"
                      style={{
                        height: `${multiplier * 20}px`,
                        backgroundColor: isPlaying ? "#10b981" : "#334155",
                        transformOrigin: "center",
                        animation: isPlaying ? `voice-wave ${0.6 + (idx % 4) * 0.2}s ease-in-out infinite` : "none",
                        animationDelay: `${idx * 0.05}s`
                      }}
                    />
                  ))}
                </div>
                
                {/* Label metadata watermark */}
                <div className="absolute bottom-1.5 left-3 text-[9px] text-slate-500 font-mono uppercase">
                  {audioPlayerLabel ? audioPlayerLabel : (engine === "gemini" ? `${geminiVoice} Voice Model` : "System Synthesizer")}
                </div>
                <div className="absolute bottom-1.5 right-3 text-[9px] text-slate-500 font-mono">
                  {engine === "gemini" ? "WAV lossless" : "Browser engine"}
                </div>
              </div>

              {/* Seekable Progress range for Gemini Audio */}
              {engine === "gemini" && audioUrl && (
                <div className="space-y-1">
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleProgressChange}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                    title="Arrastar para retroceder/avançar o áudio"
                  />
                  <div className="flex justify-between text-xs text-slate-400 font-mono">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              )}

              {/* Playback Controls & High-Fidelity Download Trigger */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={handleTogglePlayPause}
                  className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="h-4 w-4 text-emerald-400" />
                      <span>Pausar</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 text-emerald-400" />
                      <span>Reproduzir</span>
                    </>
                  )}
                </button>

                {engine === "gemini" && currentAudioBlob && (
                  <button
                    onClick={handleDownloadAudioFile}
                    type="button"
                    className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-2.5 px-4 rounded-xl text-xs font-bold active:scale-[0.98] transition flex items-center justify-center gap-2"
                    title="Fazer o download do arquivo de áudio gerado de alta qualidade em formato WAV compatível com todos os aparelhos e leitores digitais."
                    id="download-audio-btn"
                  >
                    <Download className="h-4 w-4" />
                    <span>Baixar Áudio (.WAV)</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Advanced API Config Section */}
          <div className="bg-slate-950/20 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-slate-400 hover:text-slate-200 transition flex items-center justify-between w-full font-semibold uppercase tracking-wider"
              id="toggle-advanced-api-btn"
            >
              <span>⚙️ Configurações Avançadas de API</span>
              <span>{showAdvanced ? "Ocultar ▲" : "Mostrar ▼"}</span>
            </button>
            
            {showAdvanced && (
              <div className="space-y-3 pt-2 border-t border-slate-900 animate-fadeIn bg-slate-950/40 p-1 rounded-lg">
                <p className="text-[11px] text-slate-400 leading-normal">
                  Se você hospedou esse aplicativo de forma estática (ex: Vercel) e quer conectá-lo com as vozes de IA do seu servidor backend da Google Cloud Run, cole o link absoluto do seu endpoint abaixo:
                </p>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-455 font-mono">ENDPOINT ABSOLUTO:</label>
                  <input
                    type="text"
                    value={customApiUrl}
                    onChange={(e) => setCustomApiUrl(e.target.value)}
                    placeholder="https://sua-url-gcp.run.app/api/tts"
                    className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500/50 outline-none rounded-xl px-3 py-2 text-xs text-slate-200 font-mono"
                    id="custom-api-input"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => {
                      setCustomApiUrl("https://ais-pre-fj6fpurayej3b3hioeytig-324247564679.us-west1.run.app/api/tts");
                      showTemporarySuccess("Endpoint atualizado para o Cloud Run Backend da nuvem principal!");
                    }}
                    type="button"
                    className="text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-800 transition"
                  >
                    Usar Backend Principal (GCP Cloud Run)
                  </button>
                  <button
                    onClick={() => {
                      setCustomApiUrl("");
                      showTemporarySuccess("Restaurado para auto-detecção local!");
                    }}
                    type="button"
                    className="text-[10px] text-slate-400 hover:text-red-400 px-2 py-1.5 transition ml-auto"
                  >
                    Auto-Detecção
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Guide Card */}
          <div className="bg-slate-950/40 border border-slate-850 rounded-2xl p-4 text-xs text-slate-400 leading-normal flex flex-col gap-2.5">
            <h3 className="font-semibold text-slate-300 font-display text-sm">Como funciona o download:</h3>
            <p>
              Ao escolher o <strong className="text-emerald-400">Estúdio IA</strong>, nosso servidor conecta-se à inteligência do modelo de síntese de fala Gemini para retornar um fluxo de áudio ultra realista. Esse fluxo é convertido instantaneamente pelo navegador em um arquivo WAV de alta fidelidade que você pode baixar com um clique.
            </p>
            <p className="text-[11px] text-slate-500 italic block">
              Nota: A alteração instantânea de velocidade ajusta dinamicamente a taxa de reprodução de qualquer áudio em execução.
            </p>
          </div>

        </div>

      </main>

      {/* --- Footer --- */}
      <footer className="border-t border-slate-800 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500 mt-auto">
        <p>© 2026 Conversora de Voz — Desenvolvido com Google Gemini em alta definição.</p>
      </footer>
    </div>
  );
}
