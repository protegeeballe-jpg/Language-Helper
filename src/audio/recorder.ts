export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private gainNode: GainNode | null = null;
  private onAudioChunk: (audioBlob: Blob) => void;
  private activeBuffer: Float32Array[] = [];
  private totalSamples = 0;
  private isSpeaking = false;
  private silenceCounter = 0;
  private silenceLimit = 5; // Quick pause detection
  private minSpeechSamples = 4000; // ~0.25s so short words work instantly

  constructor(onAudioChunk: (audioBlob: Blob) => void) {
    this.onAudioChunk = onAudioChunk;
  }

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

  private encodeWAV(samples: Float32Array, sampleRate: number = 16000): Blob {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    this.writeString(view, 8, 'WAVE');

    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);

    this.writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  private writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
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
    this.audioContext = new AudioContextClass();
    
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const actualSampleRate = this.audioContext.sampleRate;
    console.log(`AudioContext active sample rate: ${actualSampleRate}Hz (Resampling to 16000Hz)`);

    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    // Create a zero-gain node to prevent microphone feedback loop into speakers
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 0;

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);

      let sumSquares = 0;
      for (let i = 0; i < inputData.length; i++) {
        sumSquares += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sumSquares / inputData.length);
      
      // Diagnostic log: Watch this in your F12 Console while speaking
      console.log("Mic RMS volume level:", rms.toFixed(4));

      const isVoice = rms > 0.004;

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

        if (this.silenceCounter > this.silenceLimit) {
          if (this.totalSamples >= this.minSpeechSamples) {
            const completeSentenceBuffer = new Float32Array(this.totalSamples);
            let offset = 0;
            for (const c of this.activeBuffer) {
              completeSentenceBuffer.set(c, offset);
              offset += c.length;
            }
            const wavBlob = this.encodeWAV(completeSentenceBuffer, 16000);
            this.onAudioChunk(wavBlob);
          }
          this.activeBuffer = [];
          this.totalSamples = 0;
          this.isSpeaking = false;
          this.silenceCounter = 0;
        }
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);
  }

  stop() {
    if (this.processor && this.audioContext) {
      this.processor.disconnect();
      this.source?.disconnect();
      this.gainNode?.disconnect();
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
  }
}
