/**
 * Generates all required Expo icon assets from a single source icon.png
 *
 * Source: assets/images/icon.png  (must be at least 1024x1024, square, transparent bg)
 *
 * Outputs:
 *   favicon.png                  – 48×48  (web tab icon)
 *   splash-icon.png              – 1024×1024 (splash screen center image)
 *   android-icon-foreground.png  – 1024×1024 with safe-zone padding (~18% each side)
 *   android-icon-background.png  – 1024×1024 solid fill (#E6F4FE from app.json)
 *   android-icon-monochrome.png  – 1024×1024 white-on-transparent (for themed icons)
 */

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(__dirname, '../assets/images');
const SRC = path.join(ASSETS, 'icon.png');

// Android adaptive icon background colour (must match app.json backgroundColor)
const ANDROID_BG = '#E6F4FE';

async function main() {
  console.log('Generating icon assets from', SRC, '...\n');

  // 1. favicon.png – 48×48
  await sharp(SRC)
    .resize(48, 48)
    .png()
    .toFile(path.join(ASSETS, 'favicon.png'));
  console.log('✓ favicon.png  (48×48)');

  // 2. splash-icon.png – 1024×1024 (same source, square)
  await sharp(SRC)
    .resize(1024, 1024, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(ASSETS, 'splash-icon.png'));
  console.log('✓ splash-icon.png  (1024×1024)');

  // 3. android-icon-foreground.png
  //    Expo safe zone = inner 66 % of canvas → ~18 % padding each side on 1024 px = ~186 px
  const CANVAS = 1024;
  const PADDING_RATIO = 0.18;
  const padding = Math.round(CANVAS * PADDING_RATIO);
  const innerSize = CANVAS - padding * 2;

  const resizedForFg = await sharp(SRC)
    .resize(innerSize, innerSize)
    .png()
    .toBuffer();

  await sharp({
    create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: resizedForFg, top: padding, left: padding }])
    .png()
    .toFile(path.join(ASSETS, 'android-icon-foreground.png'));
  console.log(`✓ android-icon-foreground.png  (${CANVAS}×${CANVAS}, inner ${innerSize}px with ${padding}px padding)`);

  // 4. android-icon-background.png – solid colour
  const bgHex = ANDROID_BG.replace('#', '');
  const r = parseInt(bgHex.slice(0, 2), 16);
  const g = parseInt(bgHex.slice(2, 4), 16);
  const b = parseInt(bgHex.slice(4, 6), 16);

  await sharp({
    create: { width: CANVAS, height: CANVAS, channels: 3, background: { r, g, b } },
  })
    .png()
    .toFile(path.join(ASSETS, 'android-icon-background.png'));
  console.log(`✓ android-icon-background.png  (${CANVAS}×${CANVAS}, fill ${ANDROID_BG})`);

  // 5. android-icon-monochrome.png – white silhouette on transparent background
  //    Uses the alpha channel of the source as a white mask
  const { data, info } = await sharp(SRC)
    .resize(CANVAS, CANVAS)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    data[i] = 255;     // R
    data[i + 1] = 255; // G
    data[i + 2] = 255; // B
    data[i + 3] = alpha; // keep original alpha
  }

  await sharp(Buffer.from(data), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(path.join(ASSETS, 'android-icon-monochrome.png'));
  console.log(`✓ android-icon-monochrome.png  (${CANVAS}×${CANVAS}, white silhouette)`);

  console.log('\nAll assets generated successfully.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
