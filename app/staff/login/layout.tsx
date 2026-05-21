import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connexion | Staff VAGONDYS",
  description: "Portail sécurisé de la Maison VAGONDYS. Accès réservé au personnel.",
  
  // On reste discret sur le login pour la sécurité
  robots: {
    index: false, // Je recommande false pour éviter que des robots cherchent à brute-force
    follow: false,
  },

  openGraph: {
    title: "Staff VAGONDYS",
    description: "Espace administration.",
    url: "https://vagondys.com/staff/login", // Correction URL pour correspondre à ton arborescence
    siteName: "VAGONDYS",
    type: "website",
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  // Données structurées propres
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Staff VAGONDYS Login",
    "description": "Page de connexion administrative de la Maison VAGONDYS",
    "publisher": {
      "@type": "Organization",
      "name": "VAGONDYS"
    }
  };

  return (
    <section className="min-h-screen bg-black flex items-center justify-center p-4">
      {/* Insertion propre du JSON-LD via une balise script standard */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      {/* Conteneur pour stabiliser l'affichage du formulaire de login */}
      <div className="w-full max-w-md">
        {children}
      </div>
    </section>
  );
}
