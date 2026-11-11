import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const sampleRate = 44100;
const duration = 1.05;
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

const notes = [
  { frequency: 659.25, start: 0.00, length: 0.27 },
  { frequency: 783.99, start: 0.17, length: 0.29 },
  { frequency: 987.77, start: 0.36, length: 0.40 }
];
for (let i = 0; i < frames; i++) {
  const t = i / sampleRate;
  let value = 0;
  for (const note of notes) {
    const local = t - note.start;
    if (local < 0 || local > note.length) continue;
    const attack = Math.min(1, local / 0.025);
    const release = Math.min(1, (note.length - local) / 0.11);
    const envelope = Math.max(0, Math.min(attack, release));
    value += Math.sin(2 * Math.PI * note.frequency * local) * envelope * 0.19;
  }
  const limited = Math.max(-1, Math.min(1, value));
  buffer.writeInt16LE(Math.round(limited * 32767), 44 + i * 2);
}

const publicDir = join(process.cwd(), 'public', 'sounds');
await mkdir(publicDir, { recursive: true });
await writeFile(join(publicDir, 'pawly-chime.wav'), buffer);
const androidRaw = join(process.cwd(), 'android', 'app', 'src', 'main', 'res', 'raw');
if (existsSync(join(process.cwd(), 'android'))) {
  await mkdir(androidRaw, { recursive: true });
  await writeFile(join(androidRaw, 'pawly_chime.wav'), buffer);
}
console.log('Pawly chime generated.');
