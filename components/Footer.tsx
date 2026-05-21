import Link from "next/link";
import {
  FaFacebookF,
  FaInstagram,
  FaYoutube,
  FaTwitch,
} from "react-icons/fa";

export default function Footer() {
  return (
    <footer className="w-full border-t border-white/10 bg-black px-6 py-16 text-sm text-neutral-400">
      <div className="mx-auto max-w-6xl space-y-10">

        {/* IDENTITÉ */}
        <div className="space-y-2 text-center">
          <Link
            href="/"
            className="text-lg font-semibold tracking-widest text-white hover:opacity-80 transition"
          >
            VAGONDYS
          </Link>
          <p className="mx-auto max-w-xl text-xs uppercase tracking-wide text-neutral-500">
            L’Airsoft d’Élite. Vigueur, Compétition, Chaos Maîtrisé.
          </p>
        </div>

        {/* LIENS INSTITUTIONNELS */}
        <div className="flex flex-wrap justify-center gap-6 text-xs">
          <Link href="/mentions-legales" className="hover:text-white transition">
            Mentions légales
          </Link>
          <Link
            href="/politique-de-confidentialite"
            className="hover:text-white transition"
          >
            Politique de confidentialité
          </Link>
          <Link href="/contact" className="hover:text-white transition">
            Contact
          </Link>
        </div>

        {/* RÉSEAUX SOCIAUX */}
        <div className="flex justify-center gap-6">
          <a
            href="#"
            aria-label="Facebook"
            className="opacity-60 hover:opacity-100 transition"
          >
            <FaFacebookF size={16} />
          </a>
          <a
            href="#"
            aria-label="Instagram"
            className="opacity-60 hover:opacity-100 transition"
          >
            <FaInstagram size={16} />
          </a>
          <a
            href="#"
            aria-label="YouTube"
            className="opacity-60 hover:opacity-100 transition"
          >
            <FaYoutube size={16} />
          </a>
          <a
            href="#"
            aria-label="Twitch"
            className="opacity-60 hover:opacity-100 transition"
          >
            <FaTwitch size={16} />
          </a>
        </div>

        {/* COPYRIGHT */}
        <div className="text-center text-[11px] text-neutral-600 uppercase tracking-widest">
          © {new Date().getFullYear()} VAGONDYS. TOUS DROITS RÉSERVÉS.
        </div>
      </div>
    </footer>
  );
}
