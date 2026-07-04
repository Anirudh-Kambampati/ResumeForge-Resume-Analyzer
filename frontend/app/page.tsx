import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import About from "@/components/landing/About";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <>
      <Navbar />

      <main
        className="
          h-screen
          overflow-y-auto
          snap-y
          snap-mandatory
          scroll-smooth
          pt-20
        "
      >
        <Hero />
        <Features />
        <About />
        <Footer />
      </main>
    </>
  );
}