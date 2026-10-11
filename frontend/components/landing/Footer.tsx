import { FaGithub, FaLinkedin } from "react-icons/fa";
import { HiOutlineMail } from "react-icons/hi";

export default function Footer() {
  return (
    <footer
      id="contact"
      className="relative flex h-screen snap-start items-center justify-center overflow-hidden border-t-2 border-line px-6"
    >
      {/* Glow - smaller and positioned lower */}

      <div className="mx-auto w-full max-w-7xl text-center">
        {/* Heading */}
        <div className="mx-auto max-w-3xl">
          <div className="rf-sticker px-4 py-1.5 text-sm">
            ✨ Let&apos;s Connect
          </div>

          <h2 className="mt-6 font-serif text-5xl font-normal leading-[1.02] md:text-6xl">
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
            aria-label="Email"
            href="mailto:anirudhkambampati@gmail.com"
            className="rf-btn h-14 w-14 p-0"
          >
            <HiOutlineMail size={22} />
          </a>

          <a
            aria-label="GitHub"
            href="https://github.com/Anirudh-Kambampati"
            target="_blank"
            rel="noopener noreferrer"
            className="rf-btn h-14 w-14 p-0"
          >
            <FaGithub size={22} />
          </a>

          <a
            aria-label="LinkedIn"
            href="https://linkedin.com/in/anirudh-kambampati"
            target="_blank"
            rel="noopener noreferrer"
            className="rf-btn h-14 w-14 p-0"
          >
            <FaLinkedin size={22} />
          </a>
        </div>

        {/* Divider */}
        <div className="mx-auto my-16 max-w-xl border-t-2 border-dashed border-zinc-700" />

        {/* Bottom */}
        <div className="flex flex-col items-center justify-between gap-6 text-sm text-zinc-500 md:flex-row">
          <div className="text-center md:text-left">
            <h3 className="font-serif text-3xl font-normal text-white">
              ResumeForge
            </h3>

            <p className="mt-2 max-w-md leading-7">
              AI-powered resume building and ATS optimization for modern
              job seekers, and candidate screening for the teams hiring them.
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