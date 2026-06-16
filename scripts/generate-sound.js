
// scripts/generate-sound.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Génère un son BIP en WAV
 * Fréquence : 880 Hz (La3)
 * Durée : 1 seconde
 * Échantillonnage : 44100 Hz
 * Format : 8-bit PCM
 */
function generateBipWav() {
  const sampleRate = 44100;
  const duration = 1.0; // 1 seconde
  const frequency = 880; // La3
  const numSamples = Math.floor(sampleRate * duration);
  
  // En-tête WAV
  const headerSize = 44;
  const dataSize = numSamples;
  const fileSize = headerSize + dataSize;
  
  const buffer = Buffer.alloc(fileSize);
  let offset = 0;
  
  // RIFF header
  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(fileSize - 8, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;
  
  // fmt chunk
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4; // chunk size
  buffer.writeUInt16LE(1, offset); offset += 2; // audio format (PCM)
  buffer.writeUInt16LE(1, offset); offset += 2; // channels (mono)
  buffer.writeUInt32LE(sampleRate, offset); offset += 4; // sample rate
  buffer.writeUInt32LE(sampleRate, offset); offset += 4; // byte rate
  buffer.writeUInt16LE(1, offset); offset += 2; // block align
  buffer.writeUInt16LE(8, offset); offset += 2; // bits per sample (8-bit)
  
  // data chunk
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;
  
  // Générer les données audio (onde sinusoïdale 880Hz)
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Onde sinusoïdale
    const value = Math.sin(2 * Math.PI * frequency * t);
    // Convertir en 8-bit PCM (0-255)
    const sample = Math.floor((value * 0.5 + 0.5) * 255);
    buffer.writeUInt8(sample, offset + i);
  }
  
  return buffer;
}

// Créer le dossier public/sounds s'il n'existe pas
const soundsDir = path.join(__dirname, '..', 'public', 'sounds');
if (!fs.existsSync(soundsDir)) {
  fs.mkdirSync(soundsDir, { recursive: true });
}

// Générer et sauvegarder le fichier
const wavBuffer = generateBipWav();
const filePath = path.join(soundsDir, 'notification-bip.wav');
fs.writeFileSync(filePath, wavBuffer);

console.log(`✅ Fichier son créé : ${filePath}`);
console.log(`📊 Taille : ${wavBuffer.length} bytes`);
console.log(`🎵 Fréquence : 880 Hz (La3)`);
console.log(`⏱️  Durée : 1 seconde`);
console.log(`📁 Emplacement : public/sounds/notification-bip.wav`);
