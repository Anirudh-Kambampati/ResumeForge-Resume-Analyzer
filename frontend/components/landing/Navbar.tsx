export default function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto mt-3 flex h-14 w-[92%] max-w-7xl items-center justify-between rounded-2xl border border-white/5 bg-black/50 px-6 shadow-[0_10px_40px_rgba(0,0,0,.35)] backdrop-blur-2xl">
        {/* Logo */}

        <a
          href="#hero"
          className="text-lg font-semibold tracking-tight transition-colors duration-300 hover:text-blue-400"
        >
          ResumeForge
        </a>

        {/* Navigation */}

        <nav className="flex items-center gap-2">
          <a
            href="#features"
            className="rounded-lg px-4 py-2 text-sm text-zinc-400 transition-colors duration-300 hover:bg-white/5 hover:text-white"
          >
            Features
          </a>

          <a
            href="#about"
            className="rounded-lg px-4 py-2 text-sm text-zinc-400 transition-colors duration-300 hover:bg-white/5 hover:text-white"
          >
            About
          </a>

          <a
            href="#contact"
            className="rounded-lg px-4 py-2 text-sm text-zinc-400 transition-colors duration-300 hover:bg-white/5 hover:text-white"
          >
            Contact
          </a>

          <div className="mx-1 h-5 w-px bg-white/10" />

          <a
            href="https://github.com/Anirudh-Kambampati/ResumeForge-Resume-Analyzer"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm transition-all duration-300 hover:border-blue-500/40 hover:bg-white/[0.05]"
          >
            GitHub ↗
          </a>
        </nav>
      </div>
    </header>
  );
}