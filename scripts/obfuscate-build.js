
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
      
      // ✅ CONFIGURATION ULTRA-COMPATIBLE (élimine toutes les erreurs de conflit)
      const obfuscated = JavaScriptObfuscator.obfuscate(code, {
        // Compactage
        compact: true,
        
        // ✅ DÉSACTIVÉS pour compatibilité Turbopack
        controlFlowFlattening: false,           // ← DÉSACTIVÉ (cause des conflits)
        deadCodeInjection: false,               // ← DÉSACTIVÉ (cause des conflits)
        
        // Anti-débogage (désactivé)
        // debugProtection: true,
        // debugProtectionInterval: true,
        
        // Supprime les console.log
        disableConsoleOutput: true,
        
        // Protection des noms de variables
        identifierNamesGenerator: 'mangled-shuffled',  // ← AMÉLIORÉ
        
        // ✅ CRITIQUE - doit être false
        renameGlobals: false,
        
        renameProperties: false,
        
        // ✅ Désactivé pour compatibilité
        selfDefending: false,
        
        // Protection des strings - MODÉRÉE
        stringArray: true,
        stringArrayEncoding: ['base64'],        // ← CHANGÉ (rc4 → base64)
        stringArrayThreshold: 1,
        stringArrayIndexShift: true,
        rotateStringArray: true,
        shuffleStringArray: true,
        
        // Transformations avancées - CONSERVÉES
        transformObjectKeys: true,
        
        // ✅ DÉSACTIVÉS pour compatibilité
        unicodeEscapeSequence: false,
        splitStrings: false,
        splitStringsChunkLength: 10
      });
      
      await fs.writeFile(file, obfuscated.getObfuscatedCode());
      protectedCount++;
      
    } catch (err) {
      console.log(`⚠️ Erreur sur ${file}: ${err.message}`);
    }
  }
  
  console.log(`✅ ${protectedCount}/${files.length} fichiers statiques protégés avec succès !`);
  console.log('🔐 Votre code est maintenant ILLISIBLE dans F12');
}

obfuscateBuild().catch(console.error);
