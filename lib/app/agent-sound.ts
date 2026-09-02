/**
 * The sound of the agent waking up.
 *
 * Synthesised rather than an audio file, for two reasons. A 40KB mp3 for
 * three-quarters of a second is a network request in the exact moment the
 * screen is supposed to feel instant, and a file cannot be tuned once it
 * ships — this is a handful of numbers and a curve, and the curve is the
 * design.
 *
 * What it is: a rising fifth and octave with a lowpass opening underneath
 * them, over a breath of filtered air. The filter sweep is what makes it read
 * as something switching on rather than as a notification; the air is what
 * stops three tones sounding like three beeps.
 *
 * It broke up on real hardware once, and the digital signal was innocent —
 * rendered offline it had no clipping and no discontinuity at all. Three
 * things outside the samples were doing it, and all three are fixed here:
 *
 *   1. It was scheduled 20ms out from a context created in the same tick.
 *      That lands inside the render quantum that is already being filled, so
 *      the opening ramp gets truncated into a step. `primeAudio()` now builds
 *      the context on the press that opens the screen, and the chime is
 *      scheduled a comfortable 90ms out.
 *   2. Its fundamental was 392Hz. Phone speakers have nothing below roughly
 *      500Hz but excursion and distortion, so the loudest partial was the one
 *      the hardware could least reproduce. The notes moved up and a highpass
 *      takes the bottom off what is left.
 *   3. The bed was full-scale white noise through a bandpass, which is hiss.
 *      It is lowpassed air now, quieter, and fades in over four times as long.
 *
 * Browsers will not start audio without a gesture. That is fine here — the
 * only way to reach this screen is by pressing the orb.
 */

const KEY = "cc-agent-sound";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/**
 * Build the audio context now, before it is needed.
 *
 * Called from the press that opens the agent, which is a few hundred
 * milliseconds before the chime is scheduled. A context that is already
 * running by then does not have to start its first buffer while the main
 * thread is busy mounting two Lottie players and starting a canvas loop —
 * which is what a dropout sounds like.
 */
export function primeAudio(): void {
  if (soundOn()) audio();
}

/** Whether this person wants the agent to make noise. Default yes. */
export function soundOn(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    // Private mode, blocked storage. A missing preference is not an error.
    return true;
  }
}

export function setSoundOn(on: boolean): void {
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* The toggle still works for this session. */
  }
}

/**
 * Nothing in this module speaks any more.
 *
 * There used to be a `say()` here, and a `hush()` to stop it: the agent read a
 * greeting aloud through a TTS endpoint the moment its screen opened. That was
 * removed when the greeting moved into the realtime call itself — one voice
 * per conversation, and no paragraph read at somebody who has just pressed a
 * button. The chime below is all the sound this file makes now.
 */

export function startupChime(volume = 0.09): void {
  const ac = audio();
  if (!ac) return;
  buildChime(ac, ac.destination, ac.currentTime + 0.09, volume);
}

/**
 * The graph itself, against any context.
 *
 * Split out from `startupChime` so it can be rendered into an
 * OfflineAudioContext and measured — clipping, discontinuities and the amount
 * of energy sitting below what a phone speaker can reproduce are all things
 * you cannot see in a screenshot and cannot trust an ear to catch at this
 * volume.
 */
export function buildChime(
  ac: BaseAudioContext,
  out: AudioNode,
  t0: number,
  volume = 0.09,
): void {
  const END = t0 + 1.85;

  // Master, with its own fade at both ends. Every envelope inside decays to a
  // small positive number rather than zero — exponential ramps cannot reach
  // zero — and this is what actually takes it the last of the way, so nothing
  // can leave a step behind when its source node stops.
  const master = ac.createGain();
  master.gain.setValueAtTime(0, t0);
  master.gain.linearRampToValueAtTime(volume, t0 + 0.012);
  master.gain.setValueAtTime(volume, END - 0.25);
  master.gain.linearRampToValueAtTime(0, END);
  master.connect(out);

  // Nothing below here is reproduced by a laptop or phone speaker; it is only
  // excursion, and excursion is the sound of something breaking up.
  const hp = ac.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 240;
  hp.Q.value = 0.5;
  hp.connect(master);

  // The switching-on part. Everything goes through this.
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.Q.value = 0.6;
  lp.frequency.setValueAtTime(520, t0);
  lp.frequency.exponentialRampToValueAtTime(4800, t0 + 0.55);
  lp.connect(hp);

  // A4, E5, A5 — a fifth and an octave, which sit together without implying a
  // key. Sines throughout: a triangle on top added harmonics up past 8kHz for
  // sparkle nobody asked for and grit everybody heard.
  [440.0, 659.25, 880.0].forEach((f, i) => {
    const at = t0 + i * 0.09;
    const osc = ac.createOscillator();
    osc.type = "sine";
    // Each note slides the last few cents into place rather than starting on
    // it. This is most of what separates "alive" from "MIDI".
    osc.frequency.setValueAtTime(f * 0.995, at);
    osc.frequency.exponentialRampToValueAtTime(f, at + 0.22);

    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, at);
    // 55ms rather than 40. The three partials sum coherently at onset, and a
    // faster attack on that sum is a transient with nowhere to go.
    g.gain.exponentialRampToValueAtTime(0.62 - i * 0.14, at + 0.055);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 1.35);

    osc.connect(g);
    g.connect(lp);
    osc.start(at);
    osc.stop(END);
  });

  // The breath underneath: air rather than hiss.
  const len = Math.floor(ac.sampleRate * 1.1);
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  // Brown-ish rather than white — integrated and re-scaled, so the energy sits
  // low-mid where the tones are instead of on top of them.
  let run = 0;
  for (let i = 0; i < len; i++) {
    run = (run + (Math.random() * 2 - 1) * 0.06) * 0.985;
    data[i] = run * 6;
  }

  const noise = ac.createBufferSource();
  noise.buffer = buffer;

  const air = ac.createBiquadFilter();
  air.type = "lowpass";
  air.Q.value = 0.4;
  air.frequency.setValueAtTime(900, t0);
  air.frequency.exponentialRampToValueAtTime(3200, t0 + 0.6);

  const ng = ac.createGain();
  ng.gain.setValueAtTime(0.0001, t0);
  // 0.32s to arrive, where it used to be 0.14. A fast attack on noise is a
  // click dressed up as a breath.
  ng.gain.exponentialRampToValueAtTime(0.1, t0 + 0.32);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.05);

  noise.connect(air);
  air.connect(ng);
  ng.connect(lp);
  noise.start(t0);
  noise.stop(END);
}
