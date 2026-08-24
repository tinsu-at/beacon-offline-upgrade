import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Sparkles, ArrowLeft } from "lucide-react";

// Pricing is static, bundled data — no network call — so this screen renders
// instantly and works exactly the same with the device offline.
const PLANS = [
  {
    name: "Starter",
    price: "Free",
    cadence: "forever",
    blurb: "The daily essentials to build momentum.",
    features: [
      "Tasks, habits & journal",
      "Daily Beacon principle",
      "Offline mode",
      "Local reminders",
    ],
    cta: "Get started",
    featured: false,
  },
  {
    name: "Companion",
    price: "$12",
    cadence: "per month",
    blurb: "The full AI companion with long-term memory.",
    features: [
      "Everything in Starter",
      "Unlimited Beacon chat",
      "Long-term semantic memory",
      "Morning briefings & evening reflection",
      "Voice conversations",
      "Push notifications",
    ],
    cta: "Start Companion",
    featured: true,
  },
  {
    name: "Lighthouse",
    price: "$29",
    cadence: "per month",
    blurb: "For deep accountability and coaching workflows.",
    features: [
      "Everything in Companion",
      "Telegram assistant integration",
      "Advanced progress analytics",
      "Custom coaching playbooks",
      "Priority model access",
    ],
    cta: "Go Lighthouse",
    featured: false,
  },
] as const;

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Beacon Pricing — Plans for your growth companion" },
      {
        name: "description",
        content:
          "Simple Beacon pricing: start free, or unlock unlimited AI chat, long-term memory, voice and Telegram with Companion and Lighthouse.",
      },
      { property: "og:title", content: "Beacon Pricing — Plans for your growth companion" },
      {
        property: "og:description",
        content:
          "Start free, or unlock unlimited AI chat, long-term memory, voice and Telegram with Beacon Companion and Lighthouse.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pricing,
});

function Pricing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0E1220] text-[#EDF1F7]">
      {/* soft ambient glow — two static gradients, no animation cost */}
      <div className="pointer-events-none absolute -top-40 -left-32 h-96 w-96 rounded-full bg-[#28469E]/35 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-[#CAE8E8]/15 blur-3xl" />

      <div className="safe-top relative mx-auto w-full max-w-6xl px-5 pb-24 pt-8 md:pt-14">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center gap-2 text-sm text-[#A9B6CE] transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <header className="mt-8 max-w-2xl animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-[#CAE8E8]">
            <Sparkles className="h-3.5 w-3.5" />
            Pricing
          </span>
          <h1 className="mt-5 font-serif text-4xl font-semibold leading-tight md:text-5xl">
            Invest in the person you're becoming
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#A9B6CE]">
            Every plan works offline, keeps your data private, and syncs the moment you're back
            online. Cancel any time.
          </p>
        </header>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PLANS.map((plan, i) => (
            <div
              key={plan.name}
              className="animate-fade-up"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <div
                className={`flex h-full flex-col rounded-3xl border p-6 transition-transform duration-300 will-change-transform hover:-translate-y-1 ${
                  plan.featured
                    ? "border-[#CAE8E8]/40 bg-gradient-to-b from-[#1B2444] to-[#141A2E] shadow-[0_24px_60px_-24px_rgba(40,70,158,0.85)]"
                    : "border-white/10 bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-serif text-xl font-semibold">{plan.name}</h2>
                  {plan.featured && (
                    <span className="rounded-full bg-[#CAE8E8] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#0E1220]">
                      Most popular
                    </span>
                  )}
                </div>

                <p className="mt-2 text-sm text-[#A9B6CE]">{plan.blurb}</p>

                <div className="mt-6 flex items-baseline gap-2">
                  <span className="font-serif text-4xl font-semibold">{plan.price}</span>
                  <span className="text-sm text-[#A9B6CE]">{plan.cadence}</span>
                </div>

                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <Check
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          plan.featured ? "text-[#CAE8E8]" : "text-[#7C8DB5]"
                        }`}
                      />
                      <span className="text-[#DCE3F0]">{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to="/auth"
                  className={`mt-8 inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-semibold transition-opacity hover:opacity-90 ${
                    plan.featured
                      ? "bg-[#CAE8E8] text-[#0E1220]"
                      : "border border-white/20 bg-white/5 text-white"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-[#8494B4]">
          Prices shown are cached on your device, so this page stays readable offline.
        </p>
      </div>
    </div>
  );
}
