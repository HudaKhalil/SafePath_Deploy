import Link from "next/link";
import { Github } from "lucide-react";

export default function Footer() {

  // Only show footer on desktop/wide screens
  return (
    <footer className="hidden md:flex bg-primary-dark text-white py-8 px-8 border-t border-white/10 w-full items-center justify-between text-base" role="contentinfo">
      {/* Nelson-style horizontal layout */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="SafePath Logo" className="w-14 h-14 object-contain" />
          <span className="font-bold text-2xl tracking-tight">SafePath</span>
        </div>
        <span className="text-gray-400 text-lg font-medium ml-4">Empowering safer journeys through intelligent routing, community insights, and real-time hazard awareness.</span>
      </div>

      <nav aria-label="Footer navigation" className="flex items-center gap-8">
        <Link href="/suggested-routes" className="footer-link">Suggested Routes</Link>
        <Link href="/report-hazards" className="footer-link">Report Hazard</Link>
        <Link href="/findBuddy" className="footer-link">Find Buddy</Link>
        <Link href="#" className="footer-link">Safety Tips</Link>
        <Link href="#" className="footer-link">Privacy Policy</Link>
        <Link href="#" className="footer-link">Terms of Service</Link>
      </nav>

      <div className="flex items-center gap-4">
        <a
          href="https://github.com/KaranJoseph12/SafePath.git"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          className="inline-flex items-center justify-center h-12 w-12 rounded-full text-text-secondary hover:text-[#06d6a0] focus:outline-none focus:ring-2 focus:ring-[#06d6a0]/40 transition"
        >
          <Github className="h-7 w-7" />
        </a>
      </div>

      <style jsx>{`
        .footer-link {
          font-size: 1.15rem;
          font-weight: 500;
          color: #e0e0e0;
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          transition: color 0.2s, background 0.2s;
        }
        .footer-link:hover, .footer-link:focus {
          color: #06d6a0;
          background: rgba(6,214,160,0.08);
          outline: none;
        }
      `}</style>
    </footer>
  );
}
