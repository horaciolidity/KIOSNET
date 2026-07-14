class AudioHelper {
  private static ctx: AudioContext | null = null;

  private static getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Quick success beep (for POS scan/checkout success)
  public static playSuccessBeep() {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880.00, ctx.currentTime + 0.1); // A5

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.warn('Audio play blocked or unsupported:', e);
    }
  }

  // Quick scan beep (for item addition)
  public static playScanBeep() {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, ctx.currentTime); // 1000Hz

      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05); // 0.05s

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      console.warn('Audio play blocked or unsupported:', e);
    }
  }

  // Notification chime (resonant bell ring)
  public static playNotificationBell() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now); // A5
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(883, now); // Resonance

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      
      osc1.stop(now + 1.2);
      osc2.stop(now + 1.2);
    } catch (e) {
      console.warn('Audio play blocked or unsupported:', e);
    }
  }

  // Box Open "Cha-ching!" (metallic cash register sound)
  public static playCashRegister() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      // Part 1: Metallic drawer slide (white noise burst)
      const bufferSize = ctx.sampleRate * 0.12; // 0.12s
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 1000;
      
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.06, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      // Part 2: Dual metallic bell rings (Ching!)
      const bell1 = ctx.createOscillator();
      const bell2 = ctx.createOscillator();
      const bellGain = ctx.createGain();

      bell1.type = 'sine';
      bell1.frequency.setValueAtTime(1567.98, now + 0.04); // G6
      
      bell2.type = 'sine';
      bell2.frequency.setValueAtTime(1975.53, now + 0.05); // B6

      bellGain.gain.setValueAtTime(0.0, now);
      bellGain.gain.setValueAtTime(0.2, now + 0.05);
      bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      bell1.connect(bellGain);
      bell2.connect(bellGain);
      bellGain.connect(ctx.destination);

      noise.start(now);
      bell1.start(now + 0.04);
      bell2.start(now + 0.05);

      noise.stop(now + 0.12);
      bell1.stop(now + 0.8);
      bell2.stop(now + 0.8);
    } catch (e) {
      console.warn('Audio play blocked or unsupported:', e);
    }
  }
}

export default AudioHelper;
