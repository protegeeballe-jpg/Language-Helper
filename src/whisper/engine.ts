class CloudWhisperEngine {
  async translateAudio(audioBlob: Blob, previousContext: string = ''): Promise<string> {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('VITE_GROQ_API_KEY is missing in your environment variables (.env or Vercel settings).');
    }

    const formData = new FormData();
    formData.append('file', audioBlob, 'speech.wav');
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('response_format', 'json');
    
    // Pass previous context so the AI remembers the conversation thread
    if (previousContext) {
      formData.append('prompt', previousContext);
    }

    try {
      const response = await fetch('https://api.groq.com/openai/v1/audio/translations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Groq API error: ${response.statusText}`);
      }

      const data = await response.json();
      let text = data?.text ? data.text.trim() : '';

      // Strip non-speech bracket tags ([laughter], [music], etc.) and boilerplate hallucinations
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
      console.error('Groq cloud inference error:', error);
      throw error;
    }
  }

  // Compatibility wrapper so existing App.tsx initialization calls succeed instantly
  async loadModel(onProgress?: (progress: any) => void) {
    if (onProgress) {
      onProgress({ status: 'downloading', progress: 100 });
    }
    return Promise.resolve();
  }
}

export const whisperEngine = new CloudWhisperEngine();
