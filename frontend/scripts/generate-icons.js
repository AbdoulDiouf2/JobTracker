const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
// Logo is located at ../../public/Logo.png relative to this script (frontend/scripts/generate-icons.js)
// Wait, if script is in frontend/scripts, ../ is frontend, ../../ is JobTracker root.
// Let's verify paths.
// USER SAID: @[public/Logo.png] -> c:\Users\Abdoul Ahad M Diouf\Desktop\MAADEC\JobTracker\JobTracker\public\Logo.png
// Script will be in: c:\Users\Abdoul Ahad M Diouf\Desktop\MAADEC\JobTracker\JobTracker\frontend\scripts\generate-icons.js
// So input path should be path.join(__dirname, '../../public/Logo.png')

const inputPath = path.resolve(__dirname, '../../public/Logo.png');
const outputDir = path.resolve(__dirname, '../public/icons');

// Helper to ensure directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function generateIcons() {
    if (!fs.existsSync(inputPath)) {
        console.error(`Error: Source image not found at ${inputPath}`);
        process.exit(1);
    }

    console.log(`Generating icons from ${inputPath}...`);

    for (const size of sizes) {
        const fileName = `icon-${size}x${size}.png`;
        const outputPath = path.join(outputDir, fileName);

        try {
            await sharp(inputPath)
                .resize(size, size)
                .toFile(outputPath);
            console.log(`Generated: ${fileName}`);
        } catch (error) {
            console.error(`Error generating ${fileName}:`, error);
        }
    }

    console.log('Icon generation complete!');
}

generateIcons();
