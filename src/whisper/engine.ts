import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.numThreads = 1;
}

class WhisperEngine {
  private transcriber: any = null;
  private isInitializing = false;

  async loadModel(onProgress?: (progress: any) => void) {
    if (this.transcriber) return;
    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return;
    }

    try {
      this.isInitializing = true;
      this.transcriber = await pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-tiny',
        {
          device: 'wasm',
          progress_callback: onProgress,
        }
      );
    } catch (error) {
      console.error('Failed to load Whisper model:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  async translateAudio(audioBuffer: Float32Array): Promise<string> {
    if (!this.transcriber) {
      await this.loadModel();
    }

    try {
      const output = await this.transcriber(audioBuffer, {
        language: 'tagalog',
        task: 'translate',
        return_timestamps: false,
        temperature: 0.0,
        no_speech_threshold: 0.6,
        compression_ratio_threshold: 2.4,
      });

      let text = output?.text ? output.text.trim() : '';
      
      // Strip non-speech bracket tags and boilerplate hallucinations
      text = text.replace(/\[.*?\]|\(.*?\)/g, '').trim();
      const lower = text.toLowerCase();

      if (
        !text ||
        lower.includes('thank you for watching') ||
        lower.includes('please subscribe') ||
        lower.includes('subtitles by')
      ) {
        return '';
      }

      return text;
    } catch (error) {
      console.error('Inference error:', error);
      return '';
    }
  }
}

export const whisperEngine = new WhisperEngine();
