// scripts/optimize-images.js
import sharp from 'sharp';
import path from 'path';
import { glob } from 'glob';

async function optimizeImages() {
  console.log('🖼️ Optimisation des images...');
  
  const images = await glob('public/**/*.{png,jpg,jpeg}');
  let optimizedCount = 0;
  
  for (const image of images) {
    const ext = path.extname(image);
    const output = image.replace(ext, '.webp');
    
    // Convertir en WebP (qualité 80 = excellent équilibre)
    await sharp(image)
      .webp({ quality: 80 })
      .toFile(output);
    
    console.log(`→ ${image} → ${output}`);
    optimizedCount++;
  }
  
  console.log(`✅ ${optimizedCount} images optimisées en WebP !`);
}

optimizeImages().catch(console.error);
