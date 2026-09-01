/**
 * Microphone → 16-bit PCM, on the audio thread.
 *
 * The Live API wants raw little-endian 16kHz PCM. Doing that conversion on
 * the main thread means every dropped frame is a click in what the model
 * hears, and the main thread of this app is busy animating a canvas and a
 * Lottie. An AudioWorklet runs on the audio thread, where nothing the UI does
 * can interrupt it.
 *
 * Batched to 2048 samples — 128ms at 16kHz. Smaller batches are a message per
 * 8ms and the postMessage overhead starts to matter; larger ones are latency
 * the person hears as the agent being slow to notice they stopped talking.
 */
class Capture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Int16Array(2048);
    this.n = 0;
    this.peak = 0;
    this.since = 0;
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;

    for (let i = 0; i < ch.length; i++) {
      const s = Math.max(-1, Math.min(1, ch[i]));
      const a = s < 0 ? s : -s;
      if (-a > -this.peak) this.peak = -a;

      // Asymmetric on purpose: -1 maps to -32768 and +1 to 32767, which is
      // what the format actually is. Using 32768 on both sides clips the
      // loudest positive sample of every take.
      this.buf[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;

      if (this.n === this.buf.length) {
        this.port.postMessage({ pcm: this.buf.buffer.slice(0), peak: this.peak });
        this.n = 0;
        this.peak = 0;
      }
    }

    return true;
  }
}

registerProcessor("cc-capture", Capture);
