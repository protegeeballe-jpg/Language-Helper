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
  const [isModelLoading, setIsModelLoading] = useState(false);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  const handleAudioChunk = async (audioBuffer: Float32Array) => {
    try {
      setStatusText('Translating speech...');
      const resultText = await whisperEngine.translateAudio(audioBuffer);

      if (resultText && resultText.length > 2) {
        setEntries((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            translation: resultText,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
      setStatusText('Listening live...');
    } catch (err) {
      console.error('Translation processing error:', err);
      setStatusText('Listening live...');
    }
  };

  const toggleListening = async () => {
    if (isListening) {
      if (recorderRef.current) {
        recorderRef.current.stop();
        recorderRef.current = null;
      }
      setIsListening(false);
      setStatusText('Paused');
    } else {
      try {
        setIsModelLoading(true);
        setStatusText('Loading AI Interpreter...');

        // Ensure Whisper model is cached & ready
        await whisperEngine.loadModel((progress) => {
          if (progress?.status === 'downloading') {
            const pct = progress.progress ? Math.round(progress.progress) : 0;
            setStatusText(`Downloading Engine: ${pct}%`);
          }
        });

        setIsModelLoading(false);
        setStatusText('Activating Microphone...');
        
        const recorder = new AudioRecorder(handleAudioChunk);
        await recorder.start();
        recorderRef.current = recorder;

        setIsListening(true);
        setStatusText('Listening live...');
      } catch (err: any) {
        setIsModelLoading(false);
        setIsListening(false);
        console.error('Mic initialization failed:', err);
        alert('Microphone or AI initialization error: ' + (err.message || err));
        setStatusText('Error - Tap to Retry');
      }
    }
  };

  return (
    <div style={styles.container}>
      {/* Top Hardware-Style Status Bar */}
      <header style={styles.header}>
        <div style={styles.brandGroup}>
          <div style={{ ...styles.pulseDot, backgroundColor: isListening ? '#22c55e' : '#64748b' }} />
          <h1 style={styles.title}>Timekettle Mode</h1>
        </div>
        <span style={styles.statusBadge}>{statusText}</span>
      </header>

      {/* Main Translation Stream Feed */}
      <main style={styles.feed}>
        {entries.length === 0 ? (
          <div style={styles.welcomeCard}>
            <h2 style={{ fontSize: '1.35rem', marginBottom: '0.5qrem', color: '#f8fafc' }}>
              Tagalog ➔ English Interpreter
            </h2>
            <p style={{ color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
              Powered by local offline Whisper AI. Tap the button below, place the iPad nearby, and speak naturally in Tagalog.
            </p>
          </div>
        ) : (
          entries.map((item) => (
            <div key={item.id} style={styles.translationCard}>
              <div style={styles.cardHeader}>
                <span style={styles.tagLabel}>ENGLISH TRANSLATION</span>
                <span style={styles.timestamp}>{item.time}</span>
              </div>
              <p style={styles.translationText}>{item.translation}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </main>

      {/* Bottom Control Bar */}
      <footer style={styles.footer}>
        <button
          onClick={toggleListening}
          disabled={isModelLoading}
          style={{
            ...styles.mainButton,
            backgroundColor: isListening ? '#ef4444' : '#2563eb',
            opacity: isModelLoading ? 0.7 : 1,
          }}
        >
          {isModelLoading ? 'Initializing...' : isListening ? 'Stop Listening' : 'Start Live Translation'}
        </button>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#090d16',
    color: '#f8fafc',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    padding: '1rem 1.25rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderBottom: '1px solid #1e293b',
  },
  brandGroup: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  pulseDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    boxShadow: '0 0 8px currentColor',
  },
  title: { fontSize: '1.1rem', fontWeight: 600, margin: 0 },
  statusBadge: {
    fontSize: '0.75rem',
    padding: '0.35rem 0.75rem',
    borderRadius: '9999px',
    backgroundColor: '#1e293b',
    color: '#38bdf8',
    fontWeight: 500,
  },
  feed: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  welcomeCard: {
    backgroundColor: '#1e293b',
    padding: '2rem 1.5rem',
    borderRadius: '1rem',
    border: '1px solid #334155',
    textAlign: 'center',
    marginTop: '4rem',
  },
  translationCard: {
    backgroundColor: '#1e293b',
    padding: '1.25rem',
    borderRadius: '0.85rem',
    borderLeft: '4px solid #38bdf8',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  tagLabel: {
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    color: '#38bdf8',
  },
  timestamp: { fontSize: '0.7rem', color: '#64748b' },
  translationText: { fontSize: '1.35rem', fontWeight: 500, margin: 0, lineHeight: 1.5, color: '#f1f5f9' },
  footer: {
    padding: '1.25rem',
    backgroundColor: '#0f172a',
    borderTop: '1px solid #1e293b',
    display: 'flex',
    justifyContent: 'center',
  },
  mainButton: {
    width: '100%',
    maxWidth: '400px',
    padding: '1rem',
    borderRadius: '9999px',
    border: 'none',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '1.05rem',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(37, 99, 235, 0.4)',
    transition: 'transform 0.1s ease',
  },
};