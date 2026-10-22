export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private onAudioChunk: (buffer: Float32Array) => void;
  private audioQueue: Float32Array[] = [];
  private totalSamples = 0;
  // Target ~5 seconds of audio per translation chunk (16000 Hz * 5s = 80,000 samples)
  private targetSamples = 80000; 

  constructor(onAudioChunk: (buffer: Float32Array) => void) {
    this.onAudioChunk = onAudioChunk;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass({ sampleRate: 16000 });

    // CRITICAL for iOS Safari: AudioContext starts suspended and must be resumed on user gesture
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const chunk = new Float32Array(inputData);

      this.audioQueue.push(chunk);
      this.totalSamples += chunk.length;

      // Once we have accumulated ~5 seconds of speech, send it to Whisper
      if (this.totalSamples >= this.targetSamples) {
        const mergedBuffer = new Float32Array(this.totalSamples);
        let offset = 0;
        for (const queuedChunk of this.audioQueue) {
          mergedBuffer.set(queuedChunk, offset);
          offset += queuedChunk.length;
        }

        // Reset queue for the next batch
        this.audioQueue = [];
        this.totalSamples = 0;

        // Pass the accumulated audio buffer to translation
        this.onAudioChunk(mergedBuffer);
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  stop() {
    if (this.processor && this.audioContext) {
      this.processor.disconnect();
      this.source?.disconnect();
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.stream = null;
    this.audioContext = null;
    this.audioQueue = [];
    this.totalSamples = 0;
  }
}