export type TTSEngine = "gemini" | "local";

export interface UserPreferences {
  engine: TTSEngine;
  geminiVoice: string;
  geminiStyle: string;
  localVoiceURI: string;
  speed: number;
  pitch: number;
  autoSave: boolean;
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: "feminine" | "masculine" | "neutral";
  description: string;
  accent?: string;
  isLocal?: boolean;
}
