import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const res = join(root, 'android/app/src/main/res');
const source = await (await import('node:fs/promises')).readFile(join(root, 'pawly-icon.svg'));
const sizes = { mdpi:48, hdpi:72, xhdpi:96, xxhdpi:144, xxxhdpi:192 };
for (const [density, size] of Object.entries(sizes)) {
  const dir = join(res, `mipmap-${density}`);
  await mkdir(dir, { recursive: true });
  const png = await sharp(source).resize(size, size).png().toBuffer();
  await writeFile(join(dir, 'ic_launcher.png'), png);
  await writeFile(join(dir, 'ic_launcher_round.png'), png);
}
const foregroundSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="432" height="432" viewBox="0 0 128 128"><g fill="#fff" transform="translate(0 2)"><ellipse cx="64" cy="78" rx="25" ry="20"/><ellipse cx="36" cy="49" rx="11" ry="15" transform="rotate(-28 36 49)"/><ellipse cx="57" cy="36" rx="11" ry="15" transform="rotate(-8 57 36)"/><ellipse cx="79" cy="38" rx="11" ry="15" transform="rotate(12 79 38)"/><ellipse cx="97" cy="54" rx="11" ry="15" transform="rotate(32 97 54)"/></g></svg>`);
const drawable = join(res, 'drawable');
await mkdir(drawable, { recursive: true });
await sharp(foregroundSvg).resize(432,432).png().toFile(join(drawable,'ic_launcher_foreground.png'));
const anydpi = join(res,'mipmap-anydpi-v26');
await mkdir(anydpi,{recursive:true});
const adaptive = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/ic_launcher_background"/><foreground android:drawable="@drawable/ic_launcher_foreground"/></adaptive-icon>\n';
await writeFile(join(anydpi,'ic_launcher.xml'),adaptive);
await writeFile(join(anydpi,'ic_launcher_round.xml'),adaptive);
const values=join(res,'values');
await mkdir(values,{recursive:true});
await writeFile(join(values,'ic_launcher_background.xml'),'<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="ic_launcher_background">#668875</color></resources>\n');
console.log('Pawly Pocket Android launcher icons generated.');
