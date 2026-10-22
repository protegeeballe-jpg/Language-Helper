export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private onAudioChunk: (buffer: Float32Array) => void;
  private audioQueue: Float32Array[] = [];
  private totalSamples = 0;
  private targetSamples = 80000; // ~5 seconds at 16kHz

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

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);

      // RMS Volume Calculation to detect actual speech vs silence/room noise
      let sumSquares = 0;
      for (let i = 0; i < inputData.length; i++) {
        sumSquares += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sumSquares / inputData.length);

      // If audio is below this volume threshold, it's silence/noise—skip it!
      if (rms < 0.015) {
        return; 
      }

      const chunk = new Float32Array(inputData);
      this.audioQueue.push(chunk);
      this.totalSamples += chunk.length;

      if (this.totalSamples >= this.targetSamples) {
        const mergedBuffer = new Float32Array(this.totalSamples);
        let offset = 0;
        for (const queuedChunk of this.audioQueue) {
          mergedBuffer.set(queuedChunk, offset);
          offset += queuedChunk.length;
        }

        this.audioQueue = [];
        this.totalSamples = 0;
        this.onAudioChunk(mergedBuffer);
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    (window as any).__globalAudioFix = {
      stream: this.stream,
      context: this.audioContext,
      processor: this.processor
    };
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
    delete (window as any).__globalAudioFix;
  }
}