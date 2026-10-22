import React, { useState, useEffect, useRef } from 'react';
import { whisperEngine } from './whisper/engine';
import { AudioRecorder } from './audio/recorder';

interface Entry {
  id: string;
  text: string;
  time: string;
}

export default function App() {
  const [isListening, setIsListening] = useState(false);
  const [transcripts, setTranscripts] = useState<Entry[]>([]);
  const [hasStarted, setHasStarted] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Tap Anywhere to Start');
  const recorderRef = useRef<AudioRecorder | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  const handleAudioChunk = async (audioBuffer: Float32Array) => {
    try {
      setStatusMessage('Translating Tagalog...');
      const translation = await whisperEngine.translateAudio(audioBuffer);

      if (translation && translation.trim().length > 0) {
        setTranscripts((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            text: translation,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
      setStatusMessage('Listening for Tagalog...');
    } catch (error) {
      console.error('Translation error:', error);
      setStatusMessage('Listening...');
    }
  };

  const startListening = async () => {
    try {
      setHasStarted(true);
      setStatusMessage('Initializing Local AI Engine...');

      await whisperEngine.loadModel();

      const recorder = new AudioRecorder(handleAudioChunk);
      await recorder.start();
      recorderRef.current = recorder;

      setIsListening(true);
      setStatusMessage('Listening for Tagalog...');
    } catch (err) {
      console.error('Microphone access denied or error:', err);
      setStatusMessage('Microphone access required');
      alert('Please allow microphone access so the app can hear nearby conversations.');
    }
  };

  const stopListening = () => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    setIsListening(false);
    setStatusMessage('Paused');
  };

  return (
    <div style={styles.container} onClick={!hasStarted ? startListening : undefined}>
      <header style={styles.header}>
        <h1 style={styles.title}>Language Helper</h1>
        <span style={styles.badge}>{statusMessage}</span>
      </header>

      <main style={styles.feed}>
        {transcripts.length === 0 ? (
          <div style={styles.emptyState}>
            {!hasStarted ? (
              <div style={styles.welcomeBox}>
                <p style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                  Welcome to Language Helper 🕊️
                </p>
                <p>Tap anywhere on the screen to start live local Tagalog-to-English translation.</p>
              </div>
            ) : (
              <p>Listening... Speak Tagalog into your mic, and the English translation will appear here!</p>
            )}
          </div>
        ) : (
          transcripts.map((entry) => (
            <div key={entry.id} style={styles.card}>
              <span style={styles.timestamp}>{entry.time}</span>
              <p style={styles.text}>{entry.text}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </main>

      <footer style={styles.controls}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isListening) startListening();
            else stopListening();
          }}
          style={{
            ...styles.actionButton,
            backgroundColor: isListening ? '#dc2626' : '#2563eb',
          }}
        >
          {isListening ? 'Pause' : 'Start Listening'}
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
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    fontFamily: 'system-ui, sans-serif',
    cursor: 'pointer',
  },
  header: {
    padding: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #1e293b',
  },
  title: { fontSize: '1.25rem', fontWeight: 'bold', margin: 0 },
  badge: {
    fontSize: '0.75rem',
    padding: '0.25rem 0.5rem',
    borderRadius: '9999px',
    backgroundColor: '#1e293b',
    color: '#38bdf8',
  },
  feed: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  card: {
    backgroundColor: '#1e293b',
    padding: '1rem',
    borderRadius: '0.75rem',
    borderLeft: '4px solid #38bdf8',
  },
  timestamp: { fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' },
  text: { fontSize: '1.25rem', margin: 0, lineHeight: 1.5 },
  emptyState: { textAlign: 'center', color: '#94a3b8', marginTop: '6rem', padding: '0 2rem' },
  welcomeBox: {
    backgroundColor: '#1e293b',
    padding: '2rem',
    borderRadius: '1rem',
    border: '1px solid #334155',
  },
  controls: {
    padding: '1.5rem',
    display: 'flex',
    justifyContent: 'center',
    borderTop: '1px solid #1e293b',
  },
  actionButton: {
    padding: '0.75rem 2rem',
    borderRadius: '9999px',
    border: 'none',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '1rem',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
  },
};
