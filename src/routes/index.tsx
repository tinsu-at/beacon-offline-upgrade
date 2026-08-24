import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Compass, Flame, Target, Sparkles, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* ambient floating orbs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="animate-float-slow absolute -top-24 -left-16 h-72 w-72 rounded-full bg-rose/50 blur-3xl" />
        <div className="animate-float absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="animate-float-slow absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-rose/40 blur-3xl" />
      </div>

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-forest text-primary-foreground shadow-soft">
            <Compass className="h-5 w-5" />
          </div>
          <span className="font-serif text-xl font-semibold tracking-tight">Beacon</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" className="rounded-full">
            <Link to="/pricing">Pricing</Link>
          </Button>
          <Button asChild className="rounded-full">
            <Link to="/auth">Sign in</Link>
          </Button>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="pb-16 pt-10 md:pb-24 md:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="animate-fade-up mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />A quiet, disciplined space for
              personal growth
            </div>
            <h1
              className="animate-fade-up font-serif text-4xl font-semibold leading-[1.05] text-foreground md:text-6xl lg:text-7xl"
              style={{ animationDelay: "80ms" }}
            >
              Become someone a child would be{" "}
              <span className="bg-gradient-to-r from-primary to-rose-foreground bg-clip-text text-transparent">
                proud to imitate.
              </span>
            </h1>
            <p
              className="animate-fade-up mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg"
              style={{ animationDelay: "160ms" }}
            >
              Beacon is your coach, mentor, and accountability partner. Build discipline,
              confidence, and daily habits — one honest reflection at a time.
            </p>
            <div
              className="animate-fade-up mt-10 flex flex-wrap items-center justify-center gap-3"
              style={{ animationDelay: "240ms" }}
            >
              <Button
                asChild
                size="lg"
                className="rounded-full px-6 shadow-elegant transition-transform hover:-translate-y-0.5"
              >
                <Link to="/auth">
                  Enter Beacon <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full px-6">
                <Link to="/auth">Reset password</Link>
              </Button>
            </div>
          </div>

          <div
            className="animate-fade-up mt-20 grid gap-4 md:grid-cols-3"
            style={{ animationDelay: "320ms" }}
          >
            {[
              {
                icon: Target,
                title: "Daily focus",
                body: "Plan tasks, set priorities, and know exactly what matters today.",
              },
              {
                icon: Flame,
                title: "Habits that stick",
                body: "Track streaks across study, exercise, prayer, sleep and your own habits.",
              },
              {
                icon: Sparkles,
                title: "Confidence, built daily",
                body: "A small confidence challenge every day. Small reps, real growth.",
              },
            ].map((f) => (
              <div key={f.title} className="hover-lift glass-panel rounded-3xl p-6">
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-rose text-primary shadow-soft">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-serif text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Beacon. Lead by example.
        </footer>
      </main>
    </div>
  );
}
