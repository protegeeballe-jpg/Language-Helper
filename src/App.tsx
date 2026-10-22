import React, { useState, useEffect, useRef } from 'react';
import { whisperEngine } from './whisper/engine';
import { AudioRecorder } from './audio/recorder';

interface TranslationPair {
  id: string;
  translation: string;
  time: string;
}

export default function App() {
  const [isListening, setIsListening] = useState(false);
  const [entries, setEntries] = useState<TranslationPair[]>([]);
  const [statusText, setStatusText] = useState('Ready for Conversation');
  const [isLoading, setIsLoading] = useState(false);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  
  // Keep track of latest entries for instant conversational memory context
  const entriesRef = useRef<TranslationPair[]>([]);
  entriesRef.current = entries;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  const handleAudioChunk = async (audioBlob: Blob) => {
    try {
      setStatusText('Translating speech...');
      
      // Grab the last translated sentence to maintain conversational context
      const lastEntry = entriesRef.current[entriesRef.current.length - 1];
      const previousContext = lastEntry ? lastEntry.translation : '';

      const translated = await whisperEngine.translateAudio(audioBlob, previousContext);
      
      if (translated && translated.length > 1) {
        setEntries((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            translation: translated,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
      setStatusText('Listening live...');
    } catch (err: any) {
      console.error('Translation error:', err);
      setStatusText('Listening live...');
    }
  };

  const startListening = async () => {
    try {
      setIsLoading(true);
      setStatusText('Activating Microphone...');

      const recorder = new AudioRecorder(handleAudioChunk);
      await recorder.start();
      recorderRef.current = recorder;

      setIsLoading(false);
      setIsListening(true);
      setStatusText('Listening live...');
    } catch (err: any) {
      setIsLoading(false);
      setIsListening(false);
      setStatusText('Error Starting');
      alert(`Microphone access or startup error: ${err.message || err}`);
    }
  };

  const stopListening = () => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    setIsListening(false);
    setStatusText('Paused');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#090d16', color: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <header style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: isListening ? '#22c55e' : '#64748b', boxShadow: '0 0 8px currentColor' }} />
          <h1 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Timekettle Cloud Interpreter</h1>
        </div>
        <span style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', borderRadius: '9999px', backgroundColor: '#1e293b', color: '#38bdf8', fontWeight: 500 }}>{statusText}</span>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {entries.length === 0 ? (
          <div style={{ backgroundColor: '#1e293b', padding: '2rem 1.5rem', borderRadius: '1rem', border: '1px solid #334155', textAlign: 'center', marginTop: '4rem' }}>
            <h2 style={{ fontSize: '1.35rem', marginBottom: '0.5rem', color: '#f8fafc' }}>Tagalog-English Voice Mode</h2>
            <p style={{ color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>Powered by lightning-fast cloud AI. Speak naturally—the app uses smart pause detection and context memory.</p>
          </div>
        ) : (
          entries.map((item) => (
            <div key={item.id} style={{ backgroundColor: '#1e293b', padding: '1.25rem', borderRadius: '0.85rem', borderLeft: '4px solid #38bdf8', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', color: '#38bdf8' }}>ENGLISH TRANSLATION</span>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{item.time}</span>
              </div>
              <p style={{ fontSize: '1.35rem', fontWeight: 500, margin: 0, lineHeight: 1.5, color: '#f1f5f9' }}>{item.translation}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </main>

      <footer style={{ padding: '1.25rem', backgroundColor: '#0f172a', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={isLoading}
          style={{ width: '100%', maxWidth: '400px', padding: '1rem', borderRadius: '9999px', border: 'none', backgroundColor: isListening ? '#ef4444' : '#2563eb', color: '#fff', fontWeight: 'bold', fontSize: '1.05rem', cursor: 'pointer', boxShadow: '0 4px 16px rgba(37, 99, 235, 0.4)' }}
        >
          {isLoading ? 'Initializing...' : isListening ? 'Stop Listening' : 'Start Live Translation'}
        </button>
      </footer>
    </div>
  );
}
