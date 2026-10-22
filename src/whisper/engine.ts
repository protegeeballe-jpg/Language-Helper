import { pipeline, env } from '@huggingface/transformers';

// Configure environment for browser execution
env.allowLocalModels = false;
env.useBrowserCache = true;

class WhisperEngine {
  private transcriber: any = null;
  private isInitializing = false;

  async loadModel(onProgress?: (progress: any) => void) {
    if (this.transcriber) return;
    if (this.isInitializing) {
      // Wait if another call is already loading it
      while (this.isInitializing) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return;
    }

    try {
      this.isInitializing = true;
      console.log('Loading Whisper AI model...');

      // Load whisper-tiny optimized for browser web environment
      this.transcriber = await pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-tiny',
        {
          device: 'wasm', // Safe, reliable fallback for all devices including iPads
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
      // Run local speech recognition and translate Tagalog to English
      const output = await this.transcriber(audioBuffer, {
        chunk_length_s: 30,
        stride_length_s: 5,
        language: 'tagalog',
        task: 'translate', // Translates Tagalog speech directly into written English
        return_timestamps: false,
      });

      return output?.text ? output.text.trim() : '';
    } catch (error) {
      console.error('Inference error during translation:', error);
      return '';
    }
  }
}

export const whisperEngine = new WhisperEngine();
