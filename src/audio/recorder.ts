export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private onAudioChunk: (buffer: Float32Array) => void;
  private audioQueue: Float32Array[] = [];
  private totalSamples = 0;
  // ~4 seconds of speech per chunk for optimal Whisper processing speed & accuracy
  private targetSamples = 64000; 

  constructor(onAudioChunk: (buffer: Float32Array) => void) {
    this.onAudioChunk = onAudioChunk;
  }

  async start() {
    // Request clean, high-quality mono audio directly from the device microphone
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
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

      // Voice Activity Detection (VAD) filter: calculates energy to ignore silence
      let sumSquares = 0;
      for (let i = 0; i < inputData.length; i++) {
        sumSquares += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sumSquares / inputData.length);

      // Threshold set to ignore ambient room noise while capturing speaking voice clearly
      if (rms < 0.012) {
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

    // Prevent iOS Safari garbage collection
    (window as any).__timekettleAudioFix = {
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
    delete (window as any).__timekettleAudioFix;
  }
}