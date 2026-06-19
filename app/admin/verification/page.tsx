
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw } from "lucide-react";

/**
 * Page de vérification Admin (Master)
 * URL : /admin/verification
 * 
 * ✅ CORRECTION : Redirection automatique vers /admin/login
 * Cette page est obsolète et n'est plus utilisée dans le flux de connexion.
 * Elle redirige désormais vers la page de connexion principale.
 */
export default function AdminVerificationPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirection automatique vers la page de connexion
    router.push("/admin/login");
  }, [router]);

  // Affichage d'un écran de chargement pendant la redirection
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <RefreshCcw className="w-6 h-6 text-red-600 animate-spin" />
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
          Redirection vers la page de connexion...
        </p>
      </div>
    </div>
  );
}
