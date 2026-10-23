export const whisperEngine = {
  async translateAudio(audioBlob: Blob, previousContext?: string): Promise<string> {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;

    if (!apiKey) {
      console.error('Groq API Key is missing in environment variables.');
      return '';
    }

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-large-v3'); 
    
    // 🌟 THE MAGIC FIX: Force Whisper to recognize Tagalog audio!
    formData.append('language', 'tl'); 
    formData.append('temperature', '0');

    // Prevent feeding single-word hallucinations (like "you") back into the prompt loop
    if (previousContext && previousContext.split(' ').length > 2) {
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
      const text = (data.text || '').trim();

      // Filter out common Whisper hallucination artifacts
      const lowerText = text.toLowerCase();
      if (lowerText === 'you' || lowerText === 'thank you.' || lowerText === 'thanks for watching.') {
        return '';
      }

      return text;
    } catch (error) {
      console.error('Groq cloud inference error:', error);
      throw error;
    }
  },
};
