
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
      
      // ✅ CONFIGURATION DE PROTECTION OPTIMISÉE (compatible Next.js/Turbopack)
      const obfuscated = JavaScriptObfuscator.obfuscate(code, {
        // Compactage - CONSERVÉ
        compact: true,
        
        // ✅ Complexification du flux - Réduit pour compatibilité
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.5,     // ← MODIFIÉ (1 → 0.5)
        
        // ✅ Code mort - Réduit pour compatibilité
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.3,         // ← MODIFIÉ (0.5 → 0.3)
        
        // Anti-débogage (désactivé pour éviter les erreurs) - CONSERVÉ
        // debugProtection: true,
        // debugProtectionInterval: true,
        
        // Supprime les console.log - CONSERVÉ
        disableConsoleOutput: true,
        
        // Rend les noms de variables illisibles - CONSERVÉ
        identifierNamesGenerator: 'mangled',
        
        // ✅ CRITIQUE : renameGlobals false pour éviter conflits avec Next.js
        renameGlobals: false,                    // ← MODIFIÉ (true → false)
        
        renameProperties: false,                 // CONSERVÉ
        
        // ✅ Auto-défense - DÉSACTIVÉ (incompatible avec Next.js)
        selfDefending: false,                    // ← MODIFIÉ (true → false)
        
        // Protection des strings - CONSERVÉ
        stringArray: true,
        stringArrayEncoding: ['rc4'],
        stringArrayThreshold: 0.8,               // ← MODIFIÉ (1 → 0.8)
        
        // Transformations avancées - CONSERVÉ
        transformObjectKeys: true,
        
        // ✅ Unicode - DÉSACTIVÉ (évite les erreurs de parsing)
        unicodeEscapeSequence: false,            // ← MODIFIÉ (true → false)
        
        // ✅ Split strings - DÉSACTIVÉ (cause des conflits de variables)
        splitStrings: false,                     // ← MODIFIÉ (true → false)
        splitStringsChunkLength: 10              // CONSERVÉ (mais splitStrings false)
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
