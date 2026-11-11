import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const sampleRate = 44100;
const duration = 0.92;
const frames = Math.floor(sampleRate * duration);
const buffer = Buffer.alloc(44 + frames * 2);
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + frames * 2, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(1, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * 2, 28);
buffer.writeUInt16LE(2, 32);
buffer.writeUInt16LE(16, 34);
buffer.write('data', 36);
buffer.writeUInt32LE(frames * 2, 40);

const barks = [
  { start: 0.035, length: 0.28, pitch: 178, strength: 0.72 },
  { start: 0.39, length: 0.34, pitch: 158, strength: 0.66 }
];
let noiseState = 0x12345678;
const noise = () => {
  noiseState ^= noiseState << 13;
  noiseState ^= noiseState >>> 17;
  noiseState ^= noiseState << 5;
  return (noiseState >>> 0) / 2147483648 - 1;
};
let lowNoise = 0;
for (let i = 0; i < frames; i++) {
  const t = i / sampleRate;
  let sample = 0;
  for (const bark of barks) {
    const local = t - bark.start;
    if (local < 0 || local > bark.length) continue;
    const p = local / bark.length;
    const attack = Math.min(1, local / 0.018);
    const release = Math.min(1, (bark.length - local) / 0.095);
    const envelope = Math.max(0, Math.min(attack, release));
    const f0 = bark.pitch - 55 * p + 9 * Math.sin(p * Math.PI * 2);
    const phase = 2 * Math.PI * f0 * local;
    let voiced = 0;
    for (let h = 1; h <= 12; h++) {
      const formant = Math.exp(-Math.pow((h * f0 - 720) / 420, 2)) * 0.75
        + Math.exp(-Math.pow((h * f0 - 1320) / 650, 2)) * 0.38;
      voiced += Math.sin(phase * h) * formant / Math.pow(h, 0.72);
    }
    lowNoise = lowNoise * 0.82 + noise() * 0.18;
    const breath = (noise() * 0.55 + lowNoise * 0.45) * Math.exp(-Math.pow((local - 0.035) / 0.055, 2));
    const woofShape = Math.sin(Math.PI * Math.pow(p, 0.72));
    sample += (voiced * 0.42 + breath * 0.28) * envelope * woofShape * bark.strength;
  }
  const fadeIn = Math.min(1, t / 0.012);
  const fadeOut = Math.min(1, (duration - t) / 0.06);
  const limited = Math.max(-0.92, Math.min(0.92, sample * fadeIn * fadeOut));
  buffer.writeInt16LE(Math.round(limited * 32767), 44 + i * 2);
}

const publicDir = join(process.cwd(), 'public', 'sounds');
await mkdir(publicDir, { recursive: true });
await writeFile(join(publicDir, 'pawly-bark.wav'), buffer);
const androidRaw = join(process.cwd(), 'android', 'app', 'src', 'main', 'res', 'raw');
if (existsSync(join(process.cwd(), 'android'))) {
  await mkdir(androidRaw, { recursive: true });
  await writeFile(join(androidRaw, 'pawly_bark.wav'), buffer);
}
console.log('Pawly bark notification sound generated.');
