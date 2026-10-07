/**
 * Web Audio API retro sound synthesizer for offline UI feedback.
 * Generates chimes and clicks dynamically without any external audio files.
 */

let isMuted = false;
try {
  isMuted = localStorage.getItem('terra_audio_muted') === 'true';
} catch {
  // Gesperrter Browserspeicher darf den Start des Quiz nicht verhindern.
}

export function isAudioMuted() {
  return isMuted;
}

export function setAudioMuted(muted) {
  isMuted = muted;
  try {
    localStorage.setItem('terra_audio_muted', muted ? 'true' : 'false');
  } catch {
    // Die Toneinstellung bleibt ohne dauerhaften Speicher für diese Sitzung gültig.
  }
}

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Plays a quick, soft retro interface click sound.
 */
export function playClick() {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Fast frequency sweep down
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.03);

    // Fast volume decay
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.035);
  } catch (e) {
    console.warn('Audio click failed to play:', e);
  }
}

/**
 * Plays a major chord arpeggio chime for correct answers.
 */
export function playCorrectChime() {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Notes: C5 (523.25 Hz), E5 (659.25 Hz), G5 (783.99 Hz), C6 (1046.50 Hz)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const noteDuration = 0.08;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle'; // Warm, soft retro wave
      osc.frequency.value = freq;

      const startTime = now + idx * 0.06;
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.12, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });
  } catch (e) {
    console.warn('Audio correct chime failed to play:', e);
  }
}

/**
 * Plays a low-pitched detuned buzzer for incorrect answers.
 */
export function playErrorBuzzer() {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    // Low harsh square waves
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(140, now);
    osc1.frequency.linearRampToValueAtTime(100, now + 0.25);

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(142, now); // slightly detuned
    osc2.frequency.linearRampToValueAtTime(102, now + 0.25);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.3);
    osc2.stop(now + 0.3);
  } catch (e) {
    console.warn('Audio error buzzer failed to play:', e);
  }
}
