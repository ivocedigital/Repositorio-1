import { writeFileSync } from 'node:fs';

// Pista funk original: bajo sincopado, guitarra corta, batería y whooshes.
// Síntesis determinista; no utiliza grabaciones ni servicios externos.
const rate = 44100;
const duration = 30;
const frames = duration * rate;
const pcm = new Int16Array(frames * 2);
const bpm = 112;
const beat = 60 / bpm;
const bar = beat * 4;
const roots = [55, 65.406, 73.416, 61.735, 55, 82.407, 73.416, 65.406];
let seed = 42177;
const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const note = (frequency, time) => Math.sin(2 * Math.PI * frequency * time);
const burst = (t, start, length, fn) => {
  const d = t - start;
  return d >= 0 && d < length ? fn(d, d / length) : 0;
};

const bassPattern = [
  [0, 1], [.75, 1.5], [1.5, 1], [2, 1], [2.75, 2], [3.5, 1.5],
];
const whooshes = [1.20, 1.48, 1.82, 5.78, 7.15, 9.55, 11.95, 14.35, 16.78, 18.12, 18.28, 22.78, 24.08, 24.35, 24.62, 24.85, 25.48];
const accents = [2.92, 6.05, 8.92, 11.34, 13.76, 17.05, 18.83, 20.72, 23.05, 26.17, 26.45, 26.73];

for (let i = 0; i < frames; i++) {
  const t = i / rate;
  const barIndex = Math.floor(t / bar);
  const barTime = t - barIndex * bar;
  const root = roots[barIndex % roots.length];
  const beatIndex = Math.floor(t / beat);
  const beatTime = t - beatIndex * beat;
  const subTime = t - Math.floor(t / (beat / 2)) * beat / 2;

  // Bajo eléctrico sintético: fundamental y armónicos con ataque corto.
  let bass = 0;
  for (const [step, multiplier] of bassPattern) {
    const d = barTime - step * beat;
    if (d >= 0 && d < .34) {
      const env = (1 - Math.exp(-d * 120)) * Math.exp(-d * 11);
      const f = root * multiplier;
      bass += (note(f, d) + .30 * note(f * 2, d) + .12 * note(f * 3, d)) * env * .23;
    }
  }

  // Guitarra corta en los contratiempos.
  let chop = 0;
  for (const step of [.5, 1.5, 2.5, 3.5]) {
    const d = barTime - step * beat;
    if (d >= 0 && d < .17) {
      const env = Math.exp(-d * 30) * (1 - Math.exp(-d * 180));
      chop += (note(root * 4, d) + .7 * note(root * 5, d) + .4 * note(root * 6, d)) * env * .055;
    }
  }

  const kickBeat = beatIndex % 4;
  const kick = (kickBeat === 0 || kickBeat === 2)
    ? note(55 + 90 * Math.exp(-beatTime * 28), beatTime) * Math.exp(-beatTime * 24) * .28
    : 0;
  const snare = (kickBeat === 1 || kickBeat === 3)
    ? (random() * .65 + note(190, beatTime) * .35) * Math.exp(-beatTime * 32) * .16
    : 0;
  const hat = random() * Math.exp(-subTime * 90) * (Math.floor(t / (beat / 2)) % 2 ? .072 : .052);

  // Barridos audibles sincronizados con productos y cambios de escena.
  let whoosh = 0;
  for (const start of whooshes) {
    whoosh += burst(t, start, .32, (d, u) => {
      const shape = Math.sin(Math.PI * u);
      const rising = note(420 + 1900 * u, d);
      return (random() * .14 + rising * .045) * shape;
    });
  }
  let hit = 0;
  for (const start of accents) {
    hit += burst(t, start, .17, (d, u) =>
      (note(120 - 50 * u, d) * .15 + random() * .055) * Math.exp(-u * 5)
    );
  }

  const intro = Math.min(1, t / .24);
  const outro = Math.min(1, (duration - t) / .8);
  const mix = Math.tanh((bass + chop + kick + snare + hat + whoosh + hit) * 1.28) * .82 * Math.max(0, intro * outro);
  const pan = Math.sin(t * .9) * .035;
  pcm[i * 2] = Math.round(Math.max(-1, Math.min(1, mix * (1 - pan))) * 32767);
  pcm[i * 2 + 1] = Math.round(Math.max(-1, Math.min(1, mix * (1 + pan))) * 32767);
}

const bytes = pcm.byteLength;
const buffer = new ArrayBuffer(44 + bytes);
const view = new DataView(buffer);
const str = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
str(0, 'RIFF'); view.setUint32(4, 36 + bytes, true); str(8, 'WAVE'); str(12, 'fmt ');
view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true);
view.setUint32(24, rate, true); view.setUint32(28, rate * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true);
str(36, 'data'); view.setUint32(40, bytes, true); new Int16Array(buffer, 44).set(pcm);
writeFileSync(new URL('../assets/soundtrack.wav', import.meta.url), new Uint8Array(buffer));
