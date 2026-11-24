// Plays the AI chant as it is generated: each chunk (a hemistich) is scheduled right after
// the previous one on a Web Audio clock. In-browser synthesis can be slower than real time (single-threaded WASM, an
// integrated GPU), so playback is held until enough is buffered to run without gaps (see `shouldRelease`), or until
// the listener asks to hear what is ready. Create the player inside the click handler: browsers only let a user
// gesture unlock audio, and the unlocked context is then held (suspended) until release.

export class StreamPlayer {
  private ctx: AudioContext;
  private at = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private ended = false;
  private closed = false;
  private isHeld: boolean;
  private isPaused = false;
  /** Seconds of audio received so far. */
  made = 0;
  /** Called once, when the producer has ended and everything scheduled has been heard. */
  onDone: (() => void) | null = null;

  constructor({ hold = false }: { hold?: boolean } = {}) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.isHeld = hold;
    // Unlock on the gesture, then hold if asked.
    void this.ctx.resume().then(() => {
      if (this.isHeld || this.isPaused) void this.ctx.suspend().catch(() => {});
    }, () => {});
    if (hold) void this.ctx.suspend().catch(() => {});
  }

  get held() {
    return this.isHeld;
  }
  get paused() {
    return this.isPaused;
  }
  /** True while playing and everything made so far has been heard (the next chunk is still being made). */
  get starved() {
    return !this.isHeld && !this.ended && this.ctx.currentTime >= this.at - 0.02;
  }

  push(samples: Float32Array, sampleRate: number) {
    if (this.closed || !samples.length) return;
    const buf = this.ctx.createBuffer(1, samples.length, sampleRate);
    buf.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    // A small lead on the first chunk and after a stall, so the start is not clipped.
    const start = Math.max(this.at, this.ctx.currentTime + 0.06);
    src.start(start);
    this.at = start + buf.duration;
    this.made += buf.duration;
    this.sources.add(src);
    src.onended = () => {
      this.sources.delete(src);
      this.check();
    };
  }

  /** No more chunks are coming; a held player starts now. */
  end() {
    this.ended = true;
    this.release();
    this.check();
  }

  /** Start playing what is buffered (and keep playing as more arrives). */
  release() {
    if (!this.isHeld) return;
    this.isHeld = false;
    if (!this.isPaused) void this.ctx.resume().catch(() => {});
  }

  private check() {
    if (this.ended && this.sources.size === 0 && !this.closed) {
      const cb = this.onDone;
      this.onDone = null;
      cb?.();
    }
  }

  pause() {
    this.isPaused = true;
    void this.ctx.suspend().catch(() => {});
  }
  resume() {
    this.isPaused = false;
    if (!this.isHeld) void this.ctx.resume().catch(() => {});
  }
  stop() {
    if (this.closed) return;
    this.closed = true;
    this.onDone = null;
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {}
    }
    this.sources.clear();
    void this.ctx.close().catch(() => {});
  }
}

/** Never hold longer than this after the first chunk: past it, play and accept pauses (a long commentary on a slow
 *  device would otherwise stay silent for minutes). */
export const MAX_HOLD_S = 30;

/**
 * Hold playback until it can run to the end without a gap: release once the audio already made is at least the time
 * the rest will take to make, at the rate seen so far. `done` and `total` count units (sentences, hemistichs, or
 * characters), `made` is seconds of audio so far, `elapsed` the seconds spent making it.
 */
export function shouldRelease({ done, total, made, elapsed }: { done: number; total: number; made: number; elapsed: number }): boolean {
  if (done >= total) return true;
  if (done <= 0 || made <= 0 || elapsed <= 0) return false;
  const restAudio = (made / done) * (total - done);
  const rate = made / elapsed; // seconds of audio per second of work
  return made >= restAudio / rate - restAudio;
}
