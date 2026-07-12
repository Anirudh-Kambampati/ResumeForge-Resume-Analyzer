import { FaGithub, FaLinkedin } from "react-icons/fa";
import { HiOutlineMail } from "react-icons/hi";

export default function Footer() {
  return (
    <footer
      id="contact"
      className="relative flex h-screen snap-start items-center justify-center overflow-hidden border-t border-white/10 px-6"
    >
      {/* Glow - smaller and positioned lower */}
      <div className="absolute left-1/2 top-1/3 -z-10 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[120px]" />

      <div className="mx-auto w-full max-w-7xl text-center">
        {/* Heading */}
        <div className="mx-auto max-w-3xl">
          <div className="inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm text-blue-300 backdrop-blur-xl">
            ✨ Let&apos;s Connect
          </div>

          <h2 className="mt-5 text-4xl font-bold tracking-tight md:text-5xl">
            Ready to land
            <br />
            your next opportunity?
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
            Whether you&apos;ve found a bug, have a feature request, or simply
            want to connect, I&apos;d love to hear from you.
          </p>
        </div>

        {/* Socials */}
        <div className="mt-12 flex justify-center gap-4">
          <a
            href="mailto:YOUR_EMAIL@gmail.com"
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/40 hover:bg-white/[0.05]"
          >
            <HiOutlineMail size={22} />
          </a>

          <a
            href="https://github.com/Anirudh-Kambampati"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/40 hover:bg-white/[0.05]"
          >
            <FaGithub size={22} />
          </a>

          <a
            href="https://linkedin.com/in/anirudh-kambampati"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/40 hover:bg-white/[0.05]"
          >
            <FaLinkedin size={22} />
          </a>
        </div>

        {/* Divider */}
        <div className="mx-auto my-16 h-px max-w-xl bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Bottom */}
        <div className="flex flex-col items-center justify-between gap-6 text-sm text-zinc-500 md:flex-row">
          <div className="text-center md:text-left">
            <h3 className="text-xl font-semibold text-white">
              ResumeForge
            </h3>

            <p className="mt-2 max-w-md leading-7">
              AI-powered resume building and ATS optimization for modern
              job seekers.
            </p>
          </div>

          <div className="text-center md:text-right">
            <p>© 2026 ResumeForge</p>

            <p className="mt-2">
              Designed & Developed with ❤️ by{" "}
              <span className="text-white">
                Anirudh Kambampati
              </span>
            </p>

            <p className="mt-2 text-zinc-600">
              Next.js • Tailwind CSS • FastAPI
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}