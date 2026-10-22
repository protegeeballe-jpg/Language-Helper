import { pipeline } from '@huggingface/transformers';

export class LocalWhisperTranslator {
  private pipe: any = null;
  private isInitializing: boolean = false;

  async loadModel(onProgress?: (progress: number) => void) {
    if (this.pipe) return;
    if (this.isInitializing) return;

    this.isInitializing = true;
    console.log("Loading local Whisper model into browser memory...");

    // Loads local quantized Whisper model for speech translation
    this.pipe = await pipeline('automatic-speech-recognition', 'onnx-community/whisper-tiny', {
      dtype: 'fp32',
      progress_callback: (info: any) => {
        if (info.status === 'progress' && onProgress) {
          onProgress(Math.round(info.progress || 0));
        }
      }
    });

    this.isInitializing = false;
    console.log("Whisper AI loaded successfully!");
  }

  async translateAudio(audioBuffer: Float32Array): Promise<string> {
    if (!this.pipe) {
      await this.loadModel();
    }

    // Direct audio translation from Tagalog speech to English text
    const result = await this.pipe(audioBuffer, {
      language: 'tagalog',
      task: 'translate',
    });

    return Array.isArray(result) ? result[0].text : result.text;
  }
}

export const whisperEngine = new LocalWhisperTranslator();