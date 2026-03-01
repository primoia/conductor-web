// AudioWorklet processor: resamples from native rate to 16kHz, outputs PCM S16LE.
class PCMCaptureProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.targetRate = 16000;
        this.nativeRate = sampleRate; // AudioWorkletGlobalScope.sampleRate
        this.ratio = this.nativeRate / this.targetRate;
        this.needsResample = this.ratio > 1.01;

        // Output buffer: 320 samples = 640 bytes = 20ms at 16kHz
        this.targetSamples = 320;
        this.buffer = new Int16Array(this.targetSamples);
        this.offset = 0;
        this.resampleAccum = 0;
    }

    process(inputs) {
        const input = inputs[0];
        if (!input || !input[0]) return true;

        const samples = input[0]; // Float32 mono at native rate

        if (!this.needsResample) {
            // Native rate is ~16kHz, direct conversion
            for (let i = 0; i < samples.length; i++) {
                const s = Math.max(-1, Math.min(1, samples[i]));
                this.buffer[this.offset++] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                if (this.offset >= this.targetSamples) {
                    this.port.postMessage(this.buffer.buffer.slice(0));
                    this.offset = 0;
                }
            }
        } else {
            // Downsample: average groups of `ratio` samples
            const ratio = this.ratio;
            for (let i = 0; i < samples.length; i++) {
                this.resampleAccum++;
                if (this.resampleAccum >= ratio) {
                    this.resampleAccum -= ratio;

                    // Average nearby samples for anti-aliasing
                    const r = Math.round(ratio);
                    let sum = 0;
                    let count = 0;
                    for (let j = Math.max(0, i - r + 1); j <= i; j++) {
                        sum += samples[j];
                        count++;
                    }
                    const avg = sum / count;
                    const s = Math.max(-1, Math.min(1, avg));
                    this.buffer[this.offset++] = s < 0 ? s * 0x8000 : s * 0x7FFF;

                    if (this.offset >= this.targetSamples) {
                        this.port.postMessage(this.buffer.buffer.slice(0));
                        this.offset = 0;
                    }
                }
            }
        }

        return true;
    }
}

registerProcessor('pcm-capture', PCMCaptureProcessor);
