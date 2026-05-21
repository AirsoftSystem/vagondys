
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
      '**/polyfills*.js'
    ]
  });
  
  console.log(`📦 ${files.length} fichiers statiques à protéger...`);
  
  let protectedCount = 0;
  
  for (const file of files) {
    try {
      console.log(`→ Protection de ${file}`);
      
      const code = await fs.readFile(file, 'utf8');
      
      // ✅ CONFIGURATION STABLE FINALE (100% compatible)
      const obfuscated = JavaScriptObfuscator.obfuscate(code, {
        // Formatage
        compact: true,
        
        // ✅ TOUTES les options instables sont DÉSACTIVÉES
        controlFlowFlattening: false,
        deadCodeInjection: false,
        selfDefending: false,
        splitStrings: false,
        unicodeEscapeSequence: false,
        transformObjectKeys: false,
        
        // ✅ Protection des noms uniquement
        identifierNamesGenerator: 'mangled',
        renameGlobals: false,
        renameProperties: false,
        
        // ✅ Protection des strings minimale
        stringArray: true,
        stringArrayEncoding: [],           // Pas d'encodage (stable)
        stringArrayThreshold: 0.3,         // Seuil bas pour stabilité
        
        // ✅ Suppression des logs
        disableConsoleOutput: true,
      });
      
      await fs.writeFile(file, obfuscated.getObfuscatedCode());
      protectedCount++;
      
    } catch (err) {
      console.log(`⚠️ Erreur sur ${file}: ${err.message}`);
    }
  }
  
  console.log(`✅ ${protectedCount}/${files.length} fichiers statiques protégés avec succès !`);
  console.log('🔐 Code obfusqué (mode stable)');
}

obfuscateBuild().catch(console.error);
