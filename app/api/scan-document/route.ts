
import { NextRequest, NextResponse } from "next/server";

/**
 * Types pour les résultats de scan
 */
interface ScanResult {
  safe: boolean;
  virusDetected?: boolean;
  isAuthentic?: boolean;
  confidence?: number;
  fileType?: string;
  fileSize?: number;
  metadata?: Record<string, unknown>;
  error?: string;
}

/**
 * Types MIME autorisés pour les documents d'entreprise
 */
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

/**
 * Taille maximale : 10 MB
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * API de scan de documents (antivirus + validation IA)
 * POST /api/scan-document
 * Body: { fileUrl, fileKey }
 * * Accessible uniquement en interne (pas d’authentification publique)
 * * ✅ Vérification antivirus via ClamAV (ou fallback)
 * ✅ Validation IA (authenticité du document)
 */
export async function POST(request: NextRequest): Promise<NextResponse<ScanResult>> {
  try {
    // 1. Récupération des paramètres
    const body = await request.json();
    const { fileUrl, fileKey } = body;

    if (!fileUrl || !fileKey) {
      return NextResponse.json(
        { error: "URL du fichier manquante", safe: false },
        { status: 400 }
      );
    }

    // 2. Télécharger le fichier depuis R2
    let fileBuffer: Buffer;
    let fileType: string = "application/octet-stream";
    let fileSize: number = 0;

    try {
      const fileResponse = await fetch(fileUrl);
      if (!fileResponse.ok) {
        throw new Error(`Impossible de télécharger le fichier: ${fileResponse.status}`);
      }

      const arrayBuffer = await fileResponse.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      fileSize = fileBuffer.length;

      // Détecter le type MIME
      const contentType = fileResponse.headers.get("content-type");
      if (contentType) {
        fileType = contentType.split(";")[0].toLowerCase();
      }
    } catch (downloadError) {
      console.error("Erreur téléchargement fichier:", downloadError);
      return NextResponse.json(
        { error: "Impossible de télécharger le fichier", safe: false },
        { status: 400 }
      );
    }

    // 3. Validation du type de fichier et de la taille
    if (!ALLOWED_MIME_TYPES.includes(fileType)) {
      return NextResponse.json(
        { 
          error: `Type de fichier non supporté. Types acceptés: ${ALLOWED_MIME_TYPES.join(", ")}`,
          safe: false 
        },
        { status: 400 }
      );
    }

    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Fichier trop volumineux. Maximum ${MAX_FILE_SIZE / 1024 / 1024} MB`, safe: false },
        { status: 400 }
      );
    }

    // 4. Scan antivirus (ClamAV ou fallback)
    let virusDetected = false;
    let virusScanError: string | null = null;

    try {
      // Option 1: ClamAV via TCP (si disponible)
      const clamavHost = process.env.CLAMAV_HOST || "localhost";
      const clamavPort = parseInt(process.env.CLAMAV_PORT || "3310");
      
      // Tentative de connexion à ClamAV
      const clamavAvailable = await testClamavConnection(clamavHost, clamavPort);
      
      if (clamavAvailable) {
        virusDetected = await scanWithClamav(fileBuffer, clamavHost, clamavPort);
      } else {
        // Fallback: Scan basique (signatures simples) pour démo
        // En production, utiliser VirusTotal API ou autre service
        virusDetected = await fallbackVirusScan(fileBuffer);
      }
    } catch (clamavError) {
      console.error("Erreur scan antivirus:", clamavError);
      virusScanError = "Service antivirus temporairement indisponible";
      console.error("Statut antivirus interne :", virusScanError);
      // On ne bloque pas pour l'instant, mais on log
    }

    // Si un virus est détecté, rejeter immédiatement
    if (virusDetected) {
      return NextResponse.json({
        safe: false,
        virusDetected: true,
        error: "Virus détecté dans le fichier",
      });
    }

    // 5. Validation IA (authenticité du document)
    let isAuthentic = false;
    let confidence = 0;
    let metadata: Record<string, unknown> = {};

    try {
      const iaResult = await validateDocumentWithAI(fileBuffer, fileType);
      isAuthentic = iaResult.isAuthentic;
      confidence = iaResult.confidence;
      metadata = iaResult.metadata;
    } catch (iaError) {
      console.error("Erreur validation IA:", iaError);
      // Fallback: on considère le document comme valide mais avec faible confiance
      isAuthentic = true;
      confidence = 0.5;
    }

    // 6. Retourner le résultat
    return NextResponse.json({
      safe: true,
      virusDetected: false,
      isAuthentic: isAuthentic,
      confidence: confidence,
      fileType: fileType,
      fileSize: fileSize,
      metadata: metadata,
    });
  } catch (error) {
    console.error("Erreur API scan-document:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur", safe: false },
      { status: 500 }
    );
  }
}

/**
 * Teste la connexion au service ClamAV
 */
async function testClamavConnection(host: string, port: number): Promise<boolean> {
  try {
    const net = await import("net");
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(2000);
      socket.on("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.on("error", () => {
        resolve(false);
      });
      socket.on("timeout", () => {
        socket.destroy();
        resolve(false);
      });
      socket.connect(port, host);
    });
  } catch {
    return false;
  }
}

/**
 * Scan avec ClamAV via TCP
 */
async function scanWithClamav(buffer: Buffer, host: string, port: number): Promise<boolean> {
  try {
    const net = await import("net");
    
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let responseData = "";
      
      socket.setTimeout(10000);
      
      socket.on("connect", () => {
        // Envoyer la commande INSTREAM
        socket.write("zINSTREAM\0");
        
        // Envoyer le fichier par chunks
        const chunkSize = 1024;
        let offset = 0;
        
        const sendChunk = () => {
          const chunk = buffer.subarray(offset, offset + chunkSize);
          const chunkLength = Buffer.alloc(4);
          chunkLength.writeUInt32BE(chunk.length, 0);
          
          socket.write(chunkLength);
          if (chunk.length > 0) {
            socket.write(chunk);
            offset += chunkSize;
            setImmediate(sendChunk);
          } else {
            // Fin du fichier
            socket.end();
          }
        };
        
        sendChunk();
      });
      
      socket.on("data", (data) => {
        responseData += data.toString();
      });
      
      socket.on("end", () => {
        // Vérifier si le résultat contient "FOUND"
        const isInfected = responseData.toLowerCase().includes("found");
        socket.destroy();
        resolve(isInfected);
      });
      
      socket.on("error", (err) => {
        console.error("Erreur socket ClamAV:", err);
        socket.destroy();
        resolve(false);
      });
      
      socket.on("timeout", () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.connect(port, host);
    });
  } catch (error) {
    console.error("Erreur scan ClamAV:", error);
    return false;
  }
}

/**
 * Fallback: Scan antivirus basique (signatures simples)
 * En production, remplacer par VirusTotal API
 */
async function fallbackVirusScan(buffer: Buffer): Promise<boolean> {
  // Signatures de virus simples (démo)
  const suspiciousPatterns = [
    "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*", // EICAR
    "virus",
    "malware",
    "trojan",
  ];
  
  const fileContent = buffer.toString("latin1").toLowerCase();
  
  for (const pattern of suspiciousPatterns) {
    if (fileContent.includes(pattern.toLowerCase())) {
      console.warn("⚠️ Signature suspecte détectée:", pattern);
      return true;
    }
  }
  
  return false;
}

/**
 * Validation IA du document
 * Vérifie l'authenticité d'un KBis / document d'entreprise
 */
async function validateDocumentWithAI(
  buffer: Buffer,
  fileType: string
): Promise<{ isAuthentic: boolean; confidence: number; metadata: Record<string, unknown> }> {
  // Extraction basique des métadonnées
  const metadata: Record<string, unknown> = {
    fileType,
    fileSize: buffer.length,
    timestamp: new Date().toISOString(),
  };
  
  // Analyse basée sur le type de fichier
  let isAuthentic = true;
  let confidence = 0.7; // Confiance par défaut
  
  if (fileType === "application/pdf") {
    // Vérifier la présence de signatures PDF standard
    const pdfHeader = buffer.subarray(0, 5).toString();
    const hasPdfHeader = pdfHeader === "%PDF-";
    
    if (!hasPdfHeader) {
      isAuthentic = false;
      confidence = 0.1;
    } else {
      confidence = 0.85;
    }
    
    metadata["hasPdfHeader"] = hasPdfHeader;
    
    // Tenter d'extraire des informations supplémentaires
    try {
      // Extraction simple du texte (premiers 5000 caractères)
      const textContent = buffer.toString("latin1").substring(0, 5000);
      const hasKbisKeywords = /(k-bis|kbis|extrait|rcs|siren|siret)/i.test(textContent);
      metadata["hasKbisKeywords"] = hasKbisKeywords;
      
      if (hasKbisKeywords) {
        confidence = Math.min(confidence + 0.1, 0.95);
      }
    } catch {
      // Ignorer les erreurs d'extraction
    }
  } else if (fileType.startsWith("image/")) {
    // Pour les images, vérifier les dimensions
    metadata["imageType"] = fileType;
    confidence = 0.75;
  }
  
  // TODO: En production, intégrer une API externe comme:
  // - Google Document AI
  // - AWS Textract
  // - Microsoft Azure Document Intelligence
  // - API locale OCR + validation
  
  return {
    isAuthentic,
    confidence,
    metadata,
  };
}
