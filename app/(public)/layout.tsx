import Footer from "@/components/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VAGONDYS",
  description: "Maison d’élite d’airsoft",
  // AJOUTE CETTE SECTION ICI :
  openGraph: {
    title: "VAGONDYS",
    description: "Maison d’élite d’airsoft",
    images: ["/logo/vagondys.png"], // Utilise EXACTEMENT le même fichier que pour leaders
  },
  icons: {
    icon: "/logo/vagondys.png", 
    shortcut: "/logo/vagondys.png",
    apple: "/logo/vagondyspng",
  },
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-black">
      {/* 1. NAVBAR SUPPRIMÉE : 
          Le bandeau "VAGONDYS" a été retiré pour épurer le design.
          L'espace est maintenant libéré pour le contenu des pages.
      */}

      {/* 2. MAIN AVEC RÉSERVE : 
          Le flex-1 garantit que le footer reste en bas même si la page est courte,
          ce qui est essentiel pour la stabilité visuelle (CLS).
      */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6">
        {children}
      </main>

      {/* 3. FOOTER ISOLÉ :
          On conserve la hauteur minimale stable pour éviter les sauts de page.
      */}
      <footer className="w-full min-h-[200px] border-t border-white/5 bg-neutral-950">
        <Footer />
      </footer>
    </div>
  );
}
