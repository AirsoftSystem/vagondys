
// scripts/obfuscate-build.js
import JavaScriptObfuscator from 'javascript-obfuscator';
import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';

async function obfuscateBuild() {
  console.log('🔒 Début de la protection du code...');
  
  // Vérifier que le dossier .next existe
  if (!fs.existsSync(path.join(process.cwd(), '.next'))) {
    console.log('❌ Dossier .next introuvable. Avez-vous fait "npm run build" ?');
    return;
  }
  
  // Récupère UNIQUEMENT les fichiers statiques (ceux qui vont en prod)
  const files = await glob('.next/static/**/*.js', {
    ignore: [
      '**/*.nft.json',
      '**/polyfills*.js',
      '**/webpack*.js'
    ]
  });
  
  console.log(`📦 ${files.length} fichiers statiques à protéger...`);
  
  let protectedCount = 0;
  
  for (const file of files) {
    try {
      console.log(`→ Protection de ${file}`);
      
      const code = await fs.readFile(file, 'utf8');
      
      // ✅ CONFIGURATION ULTRA-STABLE (100% compatible Turbopack)
      const obfuscated = JavaScriptObfuscator.obfuscate(code, {
        // Formatage uniquement
        compact: true,
        
        // ✅ TOUS les transforms désactivés (cause des conflits)
        controlFlowFlattening: false,
        deadCodeInjection: false,
        selfDefending: false,
        splitStrings: false,
        unicodeEscapeSequence: false,
        transformObjectKeys: false,
        
        // ✅ Protection des noms (suffisant)
        identifierNamesGenerator: 'mangled',
        renameGlobals: false,
        renameProperties: false,
        
        // ✅ String array désactivé (cause des conflits)
        stringArray: false,                    // ← MODIFIÉ (true → false)
        stringArrayEncoding: [],
        stringArrayThreshold: 0,
        
        // ✅ Suppression des logs conservée
        disableConsoleOutput: true,
      });
      
      await fs.writeFile(file, obfuscated.getObfuscatedCode());
      protectedCount++;
      
    } catch (err) {
      console.log(`⚠️ Erreur sur ${file}: ${err.message}`);
    }
  }
  
  console.log(`✅ ${protectedCount}/${files.length} fichiers statiques protégés avec succès !`);
  console.log('🔐 Code obfusqué (mode ultra-stable)');
}

obfuscateBuild().catch(console.error);
