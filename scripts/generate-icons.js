const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];
const iconsDir = path.join(__dirname, '../public/icons');

// Create a simple icon with gradient background and S letter
async function generateIcon(size, filename) {
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#3b82f6"/>
          <stop offset="100%" style="stop-color:#9333ea"/>
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="96" fill="url(#bgGradient)"/>
      <text x="256" y="360" text-anchor="middle" font-family="Arial, sans-serif" font-size="340" font-weight="bold" fill="white">S</text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(path.join(iconsDir, filename));

  console.log(`Generated ${filename}`);
}

async function main() {
  // Ensure icons directory exists
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
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

  console.log('All icons generated successfully!');
}

main().catch(console.error);
