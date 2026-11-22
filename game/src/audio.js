// Sound, synthesised live with WebAudio: no audio files, no network.
// Footsteps, alert stings, camera beeps, coin clinks and the getaway
// fanfare are all built from oscillators and filtered noise.

let context = null;
let master = null;
let muted = false;

/** Create (or reuse) the audio context. Call from a user gesture. */
export function ensureAudio() {
  if (typeof window === 'undefined') return null;
  if (!context) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0.5;
    master.connect(context.destination);
  }
  if (context.state === 'suspended') context.resume();
  return context;
}

/** Silence everything (M key). */
export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

export function isMuted() {
  return muted;
}

function tone(freq, duration, type, volume, slideTo) {
  if (!context || muted) return;
  const now = context.currentTime;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, now);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(gain);
  gain.connect(master);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function noiseBurst(duration, volume, filterFreq) {
  if (!context || muted) return;
  const now = context.currentTime;
  const length = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = context.createBufferSource();
  source.buffer = buffer;
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq || 800;
  const gain = context.createGain();
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start(now);
}

/** Play one world event's sound. Called once per event, from the game loop. */
export function playEventSound(event) {
  if (!context || muted) return;
  switch (event.type) {
    case 'footstep':
      noiseBurst(0.07, event.loud ? 0.16 : 0.07, event.loud ? 500 : 320);
      break;
    case 'alarm':
      tone(220, 0.28, 'sawtooth', 0.16, 660);
      tone(330, 0.28, 'square', 0.08, 880);
      break;
    case 'pickup':
      tone(880, 0.12, 'sine', 0.18);
      setTimeout(() => tone(1318, 0.18, 'sine', 0.16), 70);
      break;
    case 'coin-throw':
      noiseBurst(0.08, 0.1, 2400);
      break;
    case 'coin-ring':
      tone(2093, 0.09, 'triangle', 0.14);
      setTimeout(() => tone(2637, 0.14, 'triangle', 0.12), 90);
      break;
    case 'emp':
      tone(1200, 0.5, 'sawtooth', 0.12, 90);
      noiseBurst(0.3, 0.1, 3000);
      break;
    case 'unlock':
      tone(523, 0.1, 'square', 0.1);
      setTimeout(() => tone(784, 0.16, 'square', 0.1), 100);
      break;
    case 'pick-start':
      tone(440, 0.08, 'triangle', 0.08);
      break;
    case 'heard':
      tone(180, 0.12, 'sine', 0.1, 260);
      break;
    case 'level-complete':
      [523, 659, 784, 1047].forEach((freq, i) => setTimeout(() => tone(freq, 0.22, 'triangle', 0.16), i * 110));
      break;
    case 'busted':
      tone(196, 0.7, 'sawtooth', 0.2, 55);
      noiseBurst(0.4, 0.14, 300);
      break;
    default:
      break;
  }
}

/** Short camera beep while a camera is actively spotting the thief. */
export function playCameraBeep() {
  tone(1568, 0.07, 'square', 0.07);
}
