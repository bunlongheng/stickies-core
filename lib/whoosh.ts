/**
 * The sound a note makes on its way out.
 *
 * Synthesised, not shipped - one noise burst through a filter band that sweeps
 * upward, with the level held back until the erase rips across. Ported from
 * Noto's Whoosh.swift, same xorshift noise, same two one-pole lowpasses, same
 * envelope. Built once on first use and replayed from the same buffer.
 */
let ctx: AudioContext | null = null;
let buffer: AudioBuffer | null = null;

export function whoosh() {
  try {
    ctx ??= new AudioContext();
    buffer ??= build(ctx);
    if (!buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    void ctx.resume();
    source.start();
  } catch {
    // A sound is never worth failing a delete over.
  }
}

function build(ctx: AudioContext) {
  const rate = ctx.sampleRate;
  const frames = Math.floor(rate);
  const buf = ctx.createBuffer(1, frames, rate);
  const out = buf.getChannelData(0);

  let low = 0;
  let lower = 0;
  let seed = 0x9e3779b9;
  const peak = 0.62; // where the erase is at full speed

  for (let i = 0; i < frames; i++) {
    const t = i / frames;
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const noise = (seed | 0) / 2147483647;
    // Two one-pole lowpasses whose cutoffs climb; their difference is a band that
    // rises in pitch, which is what reads as a whoosh.
    const fast = 0.02 + 0.5 * t * t;
    low += fast * (noise - low);
    lower += fast * 0.3 * (noise - lower);
    const envelope = t < peak ? (t / peak) ** 2 : Math.exp(-7 * (t - peak));
    out[i] = (low - lower) * envelope * 0.6;
  }
  return buf;
}
