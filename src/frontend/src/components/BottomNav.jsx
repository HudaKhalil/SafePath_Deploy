
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Map, AlertTriangle, ParkingCircle, Users2 } from "lucide-react";

function Item({ icon: Icon, label, href, active }) {
  return (
    <Link
      href={href}
      className={[
        "flex flex-col items-center justify-center gap-1 px-2 py-1",
        "text-[11px] md:text-sm leading-none",
        active ? "text-sp-title" : "text-slate-500 hover:text-sp-title/80",
        "transition-colors"
      ].join(" ")}
      aria-current={active ? "page" : undefined}
      aria-label={label}
    >
      <Icon className="h-5 w-5 md:h-6 md:w-6" />
      <span className="mt-0.5">{label}</span>
    </Link>
  );
}

export default function BottomNav() {
  const pathname = usePathname();

  const isActive = (href) => {
    if (href === "/") return pathname === "/";
    // treat "/routes" active also on nested paths like "/routes/123"
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (

    return (
      <nav className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-md shadow-lg border-t border-gray-200 z-1002 flex md:hidden justify-around items-center py-3" role="navigation" aria-label="Bottom navigation">
        <Link href="/" className="nav-btn" aria-label="Home">
          <HomeIcon className="w-7 h-7" aria-hidden="true" />
          <span className="text-[13px]">Home</span>
        </Link>
        <Link href="/suggested-routes" className="nav-btn" aria-label="Suggested Routes">
          <MapIcon className="w-7 h-7" aria-hidden="true" />
          <span className="text-[13px]">Routes</span>
        </Link>
        <Link href="/report-hazards" className="nav-btn" aria-label="Report Hazards">
          <AlertTriangleIcon className="w-7 h-7" aria-hidden="true" />
          <span className="text-[13px]">Hazards</span>
        </Link>
        <Link href="/findBuddy" className="nav-btn" aria-label="Find Buddy">
          <UsersIcon className="w-7 h-7" aria-hidden="true" />
          <span className="text-[13px]">Buddy</span>
        </Link>
        <style jsx>{`
          .nav-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.25rem;
            font-size: 0.85rem;
            color: #333;
            padding: 0.75rem 1.25rem;
            border-radius: 0.75rem;
            min-width: 44px;
            min-height: 44px;
            transition: color 0.2s, background 0.2s;
          }
          .nav-btn:hover, .nav-btn:focus {
            color: #06d6a0;
            background: rgba(6,214,160,0.08);
            outline: none;
          }
        `}</style>
      </nav>
    )
  }
