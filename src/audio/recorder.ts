export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private onAudioChunk: (buffer: Float32Array) => void;
  private activeBuffer: Float32Array[] = [];
  private totalSamples = 0;
  private isSpeaking = false;
  private silenceCounter = 0;
  private silenceLimit = 6; // ~1.5 seconds of pause to mark end of sentence[cite: 23]
  private minSpeechSamples = 16000; // Minimum 1 second of speech required[cite: 23]

  constructor(onAudioChunk: (buffer: Float32Array) => void) {
    this.onAudioChunk = onAudioChunk;
  }

  // Resamples hardware audio (44.1kHz / 48kHz) precisely to Whisper's required 16kHz[cite: 24]
  private resampleBuffer(buffer: Float32Array, inputSampleRate: number): Float32Array {
    if (inputSampleRate === 16000) return buffer;
    const ratio = inputSampleRate / 16000;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;

    while (offsetResult < result.length) {
      let nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass(); // Let browser use native rate, we resample dynamically[cite: 24]
    
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const actualSampleRate = this.audioContext.sampleRate;
    console.log(`AudioContext active sample rate: ${actualSampleRate}Hz (Resampling to 16000Hz)`);

    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);

      // Calculate RMS Volume for Voice Activity Detection[cite: 24]
      let sumSquares = 0;
      for (let i = 0; i < inputData.length; i++) {
        sumSquares += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sumSquares / inputData.length);
      const isVoice = rms > 0.012;

      if (isVoice) {
        if (!this.isSpeaking) {
          this.isSpeaking = true;
          this.silenceCounter = 0;
        }
        const resampledChunk = this.resampleBuffer(inputData, actualSampleRate);
        this.activeBuffer.push(resampledChunk);
        this.totalSamples += resampledChunk.length;
      } else if (this.isSpeaking) {
        this.silenceCounter++;
        const resampledChunk = this.resampleBuffer(inputData, actualSampleRate);
        this.activeBuffer.push(resampledChunk);
        this.totalSamples += resampledChunk.length;

        // If silence persists long enough, the sentence is complete[cite: 17, 25]
        if (this.silenceCounter > this.silenceLimit) {
          if (this.totalSamples >= this.minSpeechSamples) {
            const completeSentenceBuffer = new Float32Array(this.totalSamples);
            let offset = 0;
            for (const c of this.activeBuffer) {
              completeSentenceBuffer.set(c, offset);
              offset += c.length;
            }
            this.onAudioChunk(completeSentenceBuffer);
          }
          this.activeBuffer = [];
          this.totalSamples = 0;
          this.isSpeaking = false;
          this.silenceCounter = 0;
        }
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    // Prevent iOS Safari garbage collection by pinning to window[cite: 3]
    (window as any)._timekettleAudioFix = {
      stream: this.stream,
      context: this.audioContext,
      processor: this.processor,
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
    this.activeBuffer = [];
    this.totalSamples = 0;
    this.isSpeaking = false;
    delete (window as any)._timekettleAudioFix;
  }
}
