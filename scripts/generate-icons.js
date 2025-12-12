const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];
const iconsDir = path.join(__dirname, '../public/icons');
const sourceImage = path.join(__dirname, '../public/scalegreen1.png');

// Generate icon from scalegreen1.png source
async function generateIcon(size, filename) {
  await sharp(sourceImage)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .png()
    .toFile(path.join(iconsDir, filename));

  console.log(`Generated ${filename}`);
}

async function main() {
  // Ensure icons directory exists
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  // Check if source image exists
  if (!fs.existsSync(sourceImage)) {
    console.error('Source image scalegreen1.png not found in public folder!');
    process.exit(1);
  }

  // Generate all icon sizes
  for (const size of sizes) {
    await generateIcon(size, `icon-${size}x${size}.png`);
  }

  // Generate apple touch icon (180x180)
  await generateIcon(180, 'apple-touch-icon.png');

  // Generate favicons
  await generateIcon(32, 'favicon-32x32.png');
  await generateIcon(16, 'favicon-16x16.png');

  // Copy original as the largest icon reference
  fs.copyFileSync(sourceImage, path.join(iconsDir, 'icon-original.png'));
  console.log('Copied icon-original.png');

  console.log('All icons generated successfully from scalegreen1.png!');
}

main().catch(console.error);
