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
      
      // Configuration de protection MAXIMALE
      const obfuscated = JavaScriptObfuscator.obfuscate(code, {
        // Compactage
        compact: true,
        
        // Complexification du flux
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 1,
        
        // Code mort pour embrouiller
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.5,
        
        // Anti-débogage (désactivé pour éviter les erreurs)
        // debugProtection: true,
        // debugProtectionInterval: true,
        
        // Supprime les console.log
        disableConsoleOutput: true,
        
        // Rend les noms de variables illisibles
        identifierNamesGenerator: 'mangled',
        renameGlobals: true,
        renameProperties: false,
        
        // Auto-défense
        selfDefending: true,
        
        // Protection des strings
        stringArray: true,
        stringArrayEncoding: ['rc4'],
        stringArrayThreshold: 1,
        
        // Transformations avancées
        transformObjectKeys: true,
        unicodeEscapeSequence: true,
        
        // Empêche la beautification
        splitStrings: true,
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
