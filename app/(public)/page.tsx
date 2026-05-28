
import Image from "next/image";
import Link from "next/link";
import { User } from "lucide-react";

export default function HomePage() {
  // Liste des joueurs pour l'affichage dynamique (Carte de visite)
  const leaders = [
    { id: 1, slug: "cible-alpha", name: "CIBLE-ALPHA", rank: "OR" },
    { id: 2, slug: "spectre-01", name: "SPECTRE-01", rank: "ARGENT" },
    { id: 3, slug: "phantom-v", name: "PHANTOM-V", rank: "OR" },
    { id: 4, slug: "titan-k", name: "TITAN-K", rank: "OR" },
    { id: 5, slug: "vortex-9", name: "VORTEX-9", rank: "ARGENT" },
    { id: 6, slug: "raptor-x", name: "RAPTOR-X", rank: "DIAMANT" },
    { id: 7, slug: "shadow-s", name: "SHADOW-S", rank: "OR" },
    { id: 8, slug: "apex-0", name: "APEX-0", rank: "BRONZE" },
    { id: 9, slug: "omega-z", name: "OMEGA-Z", rank: "ARGENT" },
    { id: 10, slug: "kobra-1", name: "KOBRA-1", rank: "DIAMANT" },
    { id: 11, slug: "ghost-r", name: "GHOST-R", rank: "ARGENT" },
    { id: 12, slug: "nova-x", name: "NOVA-X", rank: "OR" },
    { id: 13, slug: "zenith-p", name: "ZENITH-P", rank: "OR" },
    { id: 14, slug: "hunter-f", name: "HUNTER-F", rank: "ARGENT" },
    { id: 15, slug: "glitch-y", name: "GLITCH-Y", rank: "OR" },
    { id: 16, slug: "blade-m", name: "BLADE-M", rank: "OR" }
  ];

  // Liste des liens institutionnels (triée par ordre alphabétique ou logique)
  const institutionalLinks = [
    { label: "Maison VAGONDYS", href: "/maison", category: "institution" },
    { label: "La Ligue", href: "/la-ligue", category: "institution", highlight: true },
    { label: "Classements", href: "/classements", category: "ranking" },
    { label: "Joueurs", href: "/joueurs", category: "ranking" },
    { label: "Leaders", href: "/leaders", category: "ranking" },
    { label: "Tournois", href: "/tournois", category: "events" },
    { label: "Événementiels", href: "/evenementiels", category: "events" },
    { label: "Sponsors", href: "/sponsors", category: "partners" },
    { label: "Réservations", href: "/reservations", category: "booking" },
    { label: "Communication", href: "/communication", category: "contact" },
    { label: "Contact", href: "/contact", category: "contact" },
    { label: "Espace Joueur", href: "/espace-joueur", category: "auth" },
    { label: "Mentions légales", href: "/mentions-legales", category: "legal" },
    { label: "Confidentialité", href: "/politique-de-confidentialite", category: "legal" }
  ];

  return (
    <div className="flex flex-col items-center bg-black text-neutral-100">

      {/* ===================== */}
      {/* HERO — LA MAISON      */}
      {/* ===================== */}
      <header className="w-full max-w-6xl px-6 pt-24 pb-28 text-center min-h-[500px] flex flex-col items-center justify-center">
        <div className="flex justify-center mb-10 h-[180px] w-[180px] relative">
          <Image
            src="/logo/vagondys-mark.png"
            alt="VAGONDYS"
            width={180}
            height={180}
            priority
            className="object-contain"
          />
        </div>

        <h1 className="text-6xl font-bold tracking-wide text-red-500 min-h-[60px]">
          VAGONDYS
        </h1>

        <p className="mt-6 text-lg md:text-xl text-neutral-300 max-w-2xl mx-auto">
          Maison d&apos;élite d&apos;airsoft. Discipline, compétition et maîtrise du chaos.
        </p>

        <p className="mt-10 text-xs uppercase tracking-[0.4em] text-neutral-400">
          Saison 2025 — Cycle Officiel
        </p>
      </header>

      {/* ===================== */}
      {/* ÉTAT DE LA SAISON     */}
      {/* ===================== */}
      <section className="w-full border-t border-neutral-800 bg-neutral-950 min-h-[180px]">
        <div className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
          <div className="flex flex-col justify-center">
            <p className="text-xs uppercase tracking-widest text-neutral-500 mb-3">
              Saison
            </p>
            <p className="text-2xl font-semibold">Active</p>
            <p className="text-sm text-neutral-500 mt-1">
              Cycle en cours
            </p>
          </div>

          <div className="flex flex-col justify-center">
            <p className="text-xs uppercase tracking-widest text-neutral-500 mb-3">
              Classements
            </p>
            <p className="text-2xl font-semibold">Officiels</p>
            <p className="text-sm text-neutral-500 mt-1">
              Données validées
            </p>
          </div>

          <div className="flex flex-col justify-center">
            <p className="text-xs uppercase tracking-widest text-neutral-500 mb-3">
              Compétitions
            </p>
            <p className="text-2xl font-semibold">En cours</p>
            <p className="text-sm text-neutral-500 mt-1">
              Phase active
            </p>
          </div>
        </div>
      </section>

      {/* ===================== */}
      {/* LE SOMMET — LES 16    */}
      {/* ===================== */}
      <section className="w-full max-w-6xl px-6 py-28">
        <h2 className="text-sm uppercase tracking-[0.35em] text-neutral-400 text-center mb-14">
          Les 16 Leaders — Saison 2025
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-6">
          {Array.from({ length: 16 }).map((_, i) => {
            const player = leaders[i];
            
            if (player) {
              return (
                <Link
                  key={`player-${player.id}`}
                  href={`/joueurs/${player.slug}`}
                  className="aspect-square border border-red-900/50 bg-neutral-950 rounded-lg flex flex-col items-center justify-center p-2 group hover:border-red-500 transition-all overflow-hidden"
                >
                  <div className="h-5 w-5 mb-2 flex items-center justify-center">
                    <User className="w-full h-full text-red-500 group-hover:scale-110 transition-transform" />
                  </div>
                  <span className="text-[9px] font-bold uppercase text-white text-center leading-none truncate w-full block h-[9px]">
                    {player.name}
                  </span>
                  <span className="text-[7px] text-red-500 font-bold mt-1 tracking-tighter block h-[7px]">
                    {player.rank}
                  </span>
                </Link>
              );
            }

            return (
              <div
                key={`empty-${i}`} 
                className="aspect-square border border-neutral-800 rounded-lg flex items-center justify-center text-neutral-600 text-sm hover:border-neutral-500 transition"
              >
                #{i + 1}
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/leaders"
            className="text-sm uppercase tracking-widest text-neutral-400 hover:text-white transition"
          >
            Voir la hiérarchie complète
          </Link>
        </div>
      </section>

      {/* ===================== */}
      {/* ACCÈS INSTITUTIONNELS */}
      {/* ===================== */}
      <section className="w-full max-w-6xl px-6 pb-28">
        <h2 className="text-sm uppercase tracking-[0.35em] text-neutral-400 text-center mb-16">
          Accès institutionnels
        </h2>

        <nav className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {institutionalLinks.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`group border rounded-xl p-8 hover:border-neutral-500 transition min-h-[120px] flex flex-col justify-center ${
                item.highlight ? "border-red-900/50 bg-neutral-950" : "border-neutral-800"
              }`}
            >
              <p className={`text-lg font-medium group-hover:text-white transition ${
                item.highlight ? "text-red-500" : ""
              }`}>
                {item.label}
              </p>
              <p className="text-sm text-neutral-500 mt-2">
                {item.category === "institution" && "Accès officiel"}
                {item.category === "ranking" && "Classements & palmarès"}
                {item.category === "events" && "Programme & inscriptions"}
                {item.category === "partners" && "Partenaires officiels"}
                {item.category === "booking" && "Réservation en ligne"}
                {item.category === "contact" && "Nous contacter"}
                {item.category === "auth" && "Espace sécurisé"}
                {item.category === "legal" && "Informations légales"}
              </p>
            </Link>
          ))}
        </nav>
      </section>

      {/* ===================== */}
      {/* PILIERS               */}
      {/* ===================== */}
      <section className="w-full border-t border-neutral-800 bg-neutral-950">
        <div className="max-w-6xl mx-auto px-6 py-28">
          <h2 className="text-sm uppercase tracking-[0.35em] text-neutral-400 text-center mb-20">
            Les piliers de la Maison
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 text-center">
            <div className="flex flex-col items-center">
              <p className="text-xl font-semibold mb-4">Compétition</p>
              <p className="text-neutral-500">
                Structurée. Mesurée. Sans compromis.
              </p>
            </div>

            <div className="flex flex-col items-center">
              <p className="text-xl font-semibold mb-4">Classement</p>
              <p className="text-neutral-500">
                Vivant. Évolutif. Jamais acquis.
              </p>
            </div>

            <div className="flex flex-col items-center">
              <p className="text-xl font-semibold mb-4">Temporalité</p>
              <p className="text-neutral-500">
                Rien n&apos;est éternel. Tout se mérite.
              </p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
