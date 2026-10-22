import React, { useState, useEffect, useRef } from 'react';

interface Entry {
  id: string;
  text: string;
  time: string;
}

export default function App() {
  const [isListening, setIsListening] = useState(false);
  const [transcripts, setTranscripts] = useState<Entry[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  const toggleListening = () => {
    setIsListening(!isListening);
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Language Helper</h1>
        <span style={styles.badge}>{isListening ? 'Listening...' : 'Offline Ready'}</span>
      </header>

      <main style={styles.feed}>
        {transcripts.length === 0 ? (
          <div style={styles.emptyState}>
            Tap the button below to start listening. Spoken Tagalog will automatically appear here as written English in real time.
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
          onClick={toggleListening}
          style={{
            ...styles.micButton,
            backgroundColor: isListening ? '#dc2626' : '#2563eb',
          }}
        >
          {isListening ? 'Stop' : 'Start'}
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
    padding: '1rem',
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
  text: { fontSize: '1.125rem', margin: 0, lineHeight: 1.5 },
  emptyState: { textAlign: 'center', color: '#64748b', marginTop: '4rem', padding: '0 2rem' },
  controls: {
    padding: '1.5rem',
    display: 'flex',
    justifyContent: 'center',
    borderTop: '1px solid #1e293b',
  },
  micButton: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    border: 'none',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
  },
};