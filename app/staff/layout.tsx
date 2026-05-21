import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | Staff VAGONDYS",
    default: "Tableau de Bord | Staff VAGONDYS",
  },
  // Sécurité maximale : aucune indexation des pages admin
  robots: {
    index: false,
    follow: false,
    nocache: true, // Ajout pour éviter que Google ne mette en cache des données sensibles
  },
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    // Utilisation de font-sans pour hériter de la police Geist configurée à la racine
    // flex flex-col assure une base stable pour le futur contenu
    <div className="relative flex min-h-screen flex-col bg-black font-sans text-white antialiased">
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
