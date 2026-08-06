import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Clapperboard,
  ImageIcon,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: WandSparkles,
    title: "Copy that understands the brief",
    body: "Turn product truth and brand voice into channel-ready hooks, headlines and full campaigns.",
  },
  {
    icon: ImageIcon,
    title: "Creative built for every placement",
    body: "Compose on-brand square, portrait, landscape, story and carousel assets in one studio.",
  },
  {
    icon: Clapperboard,
    title: "Video without the production drag",
    body: "Script, sequence, caption, voice and render product stories through a scene-based workflow.",
  },
  {
    icon: BarChart3,
    title: "Learning that closes the loop",
    body: "Unify spend, conversion and creative signals into practical recommendations for the next iteration.",
  },
];
export default function Home() {
  return (
    <div className="min-h-screen bg-[#fbfaf8]">
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <Brand />
        <div className="hidden items-center gap-8 text-sm font-semibold text-[#5f636c] md:flex">
          <a href="#workflow">Workflow</a>
          <a href="#studio">Studios</a>
          <a href="#pricing">Pricing</a>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/sign-up">
              Start forging <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
      </nav>
      <main>
        <section className="dot-grid relative overflow-hidden border-y border-[#ebe7e1] px-6 py-24 md:py-32">
          <div className="absolute left-1/2 top-[-220px] h-[520px] w-[700px] -translate-x-1/2 rounded-full bg-[#ff8865]/20 blur-[110px]" />
          <div className="relative mx-auto max-w-5xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#eadfd8] bg-white px-4 py-2 text-xs font-bold text-[#6e4d43] shadow-sm">
              <Sparkles size={14} className="text-[#ff5a36]" /> One workspace
              from product page to published campaign
            </div>
            <h1 className="mx-auto max-w-4xl text-5xl font-black leading-[.97] tracking-[-.055em] text-[#14161c] md:text-7xl">
              Forge advertising that gets{" "}
              <span className="text-gradient">better with every launch.</span>
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-[#626771]">
              AdForge brings product ingestion, brand intelligence, generative
              studios, campaign publishing and performance learning into one
              focused operating system.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/sign-up">
                  Build your first campaign <ArrowRight size={18} />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="#workflow">See how it works</Link>
              </Button>
            </div>
          </div>
        </section>
        <section id="workflow" className="mx-auto max-w-7xl px-6 py-24">
          <div className="mb-12 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#ff5a36]">
              A connected creative loop
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-[-.04em]">
              From source material to signal.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {features.map(({ icon: Icon, title, body }, index) => (
              <div
                key={title}
                className="panel group p-7 transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="mb-8 flex items-center justify-between">
                  <span className="grid size-12 place-items-center rounded-2xl bg-[#fff0eb] text-[#e84928]">
                    <Icon size={23} />
                  </span>
                  <span className="text-sm font-black text-[#c7c8ce]">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="text-xl font-black tracking-[-.025em]">
                  {title}
                </h3>
                <p className="mt-2 leading-7 text-[#6a6e78]">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-[#e6e2dc] px-6 py-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Brand />
          <p className="text-xs text-[#858891]">
            © 2026 AdForge AI. Built for responsible growth.
          </p>
        </div>
      </footer>
    </div>
  );
}
