import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

// CRITICAL FIX: Explicitly direct mobile browsers & Vite to the CDN for WASM binaries
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.numThreads = 1;
  env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3/dist/';
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
      console.log('Loading Whisper AI model from CDN...');

      this.transcriber = await pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-tiny',
        {
          device: 'wasm',
          progress_callback: onProgress,
        }
      );
      console.log('Whisper AI model loaded successfully!');
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
        chunk_length_s: 30,
        stride_length_s: 5,
        language: 'tagalog',
        task: 'translate',
        return_timestamps: false,
        temperature: 0.0,
        no_speech_threshold: 0.6,
        compression_ratio_threshold: 2.4,
      });

      const text = output?.text ? output.text.trim() : '';
      const lowerText = text.toLowerCase();
      
      if (
        lowerText.includes('thank you for watching') ||
        lowerText.includes('please subscribe') ||
        lowerText.includes('subtitles by')
      ) {
        return '';
      }

      return text;
    } catch (error) {
      console.error('Inference error during translation:', error);
      return '';
    }
  }
}

export const whisperEngine = new WhisperEngine();
