import Link from "next/link";
import ThemeToggle from "@/components/ui/ThemeToggle";

export interface NavLink {
  href: string;
  label: string;
  /** Small sticker after the label, e.g. "new" */
  sticker?: string;
}

const HOME_LINKS: NavLink[] = [
  { href: "#features", label: "Features" },
  { href: "/business", label: "For businesses", sticker: "new" },
  { href: "#about", label: "About" },
  { href: "#contact", label: "Contact" },
];

interface NavbarProps {
  links?: NavLink[];
  logoHref?: string;
  /** Small label after the logo, e.g. "for Businesses" */
  badge?: string;
  /** Optional primary action shown instead of the GitHub link */
  cta?: NavLink;
}

export default function Navbar({ links = HOME_LINKS, logoHref = "#hero", badge, cta }: NavbarProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b-2 border-line bg-app/90 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href={logoHref}
          className="flex items-baseline gap-2 font-serif text-[28px] leading-none text-white transition-colors hover:text-pencil"
        >
          <span>
            Resume<em>Forge</em>
          </span>
          {badge && <span className="hidden font-hand text-xl font-bold text-pencil sm:inline">{badge}</span>}
        </Link>

        <nav aria-label="Main" className="flex items-center gap-1.5">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hidden items-center gap-2 rounded-xl px-3.5 py-2.5 text-[15px] font-semibold text-zinc-200 transition-colors hover:bg-white/[0.05] hover:text-white lg:inline-flex"
            >
              {link.label}
              {link.sticker && (
                <span className="rf-sticker -rotate-[4deg] px-2 py-px text-[10px] uppercase tracking-wide">
                  {link.sticker}
                </span>
              )}
            </Link>
          ))}

          <div className="mx-1.5 hidden h-6 w-0.5 bg-zinc-800 lg:block" />

          <ThemeToggle />

          {cta ? (
            <Link href={cta.href} className="rf-btn rf-btn-primary ml-1 text-sm">
              {cta.label}
            </Link>
          ) : (
            <a
              href="https://github.com/Anirudh-Kambampati/ResumeForge-Resume-Analyzer"
              target="_blank"
              rel="noopener noreferrer"
              className="rf-btn ml-1 text-sm"
            >
              GitHub ↗
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
