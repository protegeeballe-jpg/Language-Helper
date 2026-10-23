export const whisperEngine = {
  async translateAudio(audioBlob: Blob, previousContext?: string): Promise<string> {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;

    if (!apiKey) {
      console.error('Groq API Key is missing in environment variables.');
      return '';
    }

    const formData = new FormData();
    // Wrap the blob as a file named audio.webm
    formData.append('file', audioBlob, 'audio.webm');
    
    // IMPORTANT: Must be whisper-large-v3 for translation support on Groq!
    formData.append('model', 'whisper-large-v3'); 
    formData.append('temperature', '0');

    if (previousContext) {
      formData.append('prompt', previousContext);
    }

    try {
      const response = await fetch('https://api.groq.com/openai/v1/audio/translations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.error?.message || `Groq API responded with status ${response.status}`
        );
      }

      const data = await response.json();
      return data.text || '';
    } catch (error) {
      console.error('Groq cloud inference error:', error);
      throw error;
    }
  },
};
