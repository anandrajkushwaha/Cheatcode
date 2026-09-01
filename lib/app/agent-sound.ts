/**
 * The sound of the agent waking up.
 *
 * Synthesised rather than an audio file, for two reasons. A 40KB mp3 for
 * three-quarters of a second is a network request in the exact moment the
 * screen is supposed to feel instant, and a file cannot be tuned once it
 * ships — this is three numbers and a curve, and the curve is the design.
 *
 * What it is: a rising fifth-and-octave with a lowpass opening underneath it,
 * over a short breath of filtered noise. The filter sweep is what makes it
 * read as something switching on rather than as a notification; the noise is
 * what stops the three tones sounding like three beeps.
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

/** Plays once, when the surface opens. */
export function startupChime(volume = 0.075): void {
  const ac = audio();
  if (!ac) return;
  buildChime(ac, ac.destination, ac.currentTime + 0.02, volume);
}

/**
 * The graph itself, against any context.
 *
 * Split out from `startupChime` so it can be rendered into an
 * OfflineAudioContext and measured — a sound that is silent because a gain
 * ramp hits zero is a bug you cannot see in a screenshot, and there is no
 * other way to check it.
 */
export function buildChime(
  ac: BaseAudioContext,
  out: AudioNode,
  t0: number,
  volume = 0.075,
): void {
  const master = ac.createGain();
  master.gain.value = volume;
  master.connect(out);

  // The switching-on part. Everything tonal goes through this.
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.Q.value = 0.7;
  lp.frequency.setValueAtTime(420, t0);
  lp.frequency.exponentialRampToValueAtTime(5200, t0 + 0.5);
  lp.connect(master);

  // G4, D5, A5 — stacked fifths, which sit together without implying a key.
  [392.0, 587.33, 880.0].forEach((f, i) => {
    const at = t0 + i * 0.085;
    const osc = ac.createOscillator();
    osc.type = i === 2 ? "triangle" : "sine";
    // Each note slides the last few cents into place rather than starting on
    // it. This is most of what separates "alive" from "MIDI".
    osc.frequency.setValueAtTime(f * 0.994, at);
    osc.frequency.exponentialRampToValueAtTime(f, at + 0.2);

    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.9 - i * 0.24, at + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 1.15);

    osc.connect(g);
    g.connect(lp);
    osc.start(at);
    osc.stop(at + 1.25);
  });

  // The breath underneath.
  const len = Math.floor(ac.sampleRate * 0.75);
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

  const noise = ac.createBufferSource();
  noise.buffer = buffer;

  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 0.8;
  bp.frequency.setValueAtTime(700, t0);
  bp.frequency.exponentialRampToValueAtTime(2600, t0 + 0.45);

  const ng = ac.createGain();
  ng.gain.setValueAtTime(0.0001, t0);
  ng.gain.exponentialRampToValueAtTime(0.2, t0 + 0.14);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.75);

  noise.connect(bp);
  bp.connect(ng);
  ng.connect(master);
  noise.start(t0);
  noise.stop(t0 + 0.78);
}
