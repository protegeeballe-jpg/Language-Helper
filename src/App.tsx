import React, { useState, useEffect, useRef } from 'react';
import { whisperEngine } from './whisper/engine';

interface TranslationPair {
  id: string;
  translation: string;
  time: string;
}

export default function App() {
  const [isListening, setIsListening] = useState(false);
  const [entries, setEntries] = useState<TranslationPair[]>([]);
  const [statusText, setStatusText] = useState('Ready');
  const [isLoading, setIsLoading] = useState(false);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  const startListening = async () => {
    try {
      setIsLoading(true);
      setStatusText('Loading Secure Local AI...');
      
      await whisperEngine.loadModel((p) => {
        if (p?.status === 'downloading') {
          const pct = p.progress ? Math.round(p.progress) : 0;
          setStatusText(`Downloading Model: ${pct}%`);
        }
      });

      setStatusText('Requesting Microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true }
      });
      mediaStreamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass({ sampleRate: 16000 });
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      let audioQueue: Float32Array[] = [];
      let totalSamples = 0;
      const targetSamples = 32000; // ~2 seconds chunks for smooth processing

      processor.onaudioprocess = async (e) => {
        const input = e.inputBuffer.getChannelData(0);
        audioQueue.push(new Float32Array(input));
        totalSamples += input.length;

        if (totalSamples >= targetSamples) {
          const merged = new Float32Array(totalSamples);
          let offset = 0;
          for (const chunk of audioQueue) {
            merged.set(chunk, offset);
            offset += chunk.length;
          }
          audioQueue = [];
          totalSamples = 0;

          try {
            setStatusText('Translating...');
            const translated = await whisperEngine.translateAudio(merged);
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
            setStatusText('Listening Securely...');
          } catch (err) {
            console.error('Translation error:', err);
            setStatusText('Listening Securely...');
          }
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      setIsLoading(false);
      setIsListening(true);
      setStatusText('Listening Securely...');
    } catch (err: any) {
      setIsLoading(false);
      setIsListening(false);
      setStatusText('Error Starting');
      alert(`Initialization error: ${err.message || err}`);
    }
  };

  const stopListening = () => {
    if (processorRef.current && audioContextRef.current) {
      processorRef.current.disconnect();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    setIsListening(false);
    setStatusText('Paused');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#090d16', color: '#f8fafc', fontFamily: 'sans-serif' }}>
      <header style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', backgroundColor: '#0f172a', borderBottom: '1px solid #1e293b' }}>
        <h1 style={{ fontSize: '1.1rem', margin: 0 }}>Secure Local Tagalog Translator</h1>
        <span style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', borderRadius: '9999px', backgroundColor: '#1e293b', color: '#38bdf8' }}>{statusText}</span>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {entries.length === 0 ? (
          <div style={{ backgroundColor: '#1e293b', padding: '2rem', borderRadius: '1rem', textAlign: 'center', marginTop: '4rem' }}>
            <h2>100% On-Device & Private</h2>
            <p style={{ color: '#94a3b8' }}>Tap below to start secure local translation for your daughter.</p>
          </div>
        ) : (
          entries.map((item) => (
            <div key={item.id} style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '0.75rem', borderLeft: '4px solid #38bdf8' }}>
              <span style={{ fontSize: '0.65rem', color: '#38bdf8', fontWeight: 'bold' }}>ENGLISH TRANSLATION</span>
              <p style={{ fontSize: '1.25rem', margin: '0.5rem 0 0 0' }}>{item.translation}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </main>

      <footer style={{ padding: '1.25rem', backgroundColor: '#0f172a', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={isLoading}
          style={{ width: '100%', maxWidth: '400px', padding: '1rem', borderRadius: '9999px', border: 'none', backgroundColor: isListening ? '#ef4444' : '#2563eb', color: '#fff', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}
        >
          {isLoading ? 'Loading AI...' : isListening ? 'Stop Listening' : 'Start Secure Translation'}
        </button>
      </footer>
    </div>
  );
}
