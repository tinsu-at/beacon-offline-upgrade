import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Compass } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const searchSchema = z.object({ mode: z.enum(["signin", "signup", "forgot"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<string>(mode ?? "signin");

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-md items-center px-6 py-10">
        <div className="w-full">
          <Link to="/" className="mb-8 flex items-center justify-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl gradient-forest text-primary-foreground">
              <Compass className="h-5 w-5" />
            </div>
            <span className="font-serif text-xl font-semibold">Beacon</span>
          </Link>

          <div className="rounded-3xl border border-border bg-card p-6 shadow-elegant md:p-8">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
                <TabsTrigger value="forgot">Reset</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" className="mt-6">
                <SignInForm />
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  New to Beacon?{" "}
                  <button
                    type="button"
                    onClick={() => setTab("signup")}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Create an account
                  </button>
                </p>
              </TabsContent>
              <TabsContent value="signup" className="mt-6">
                <SignUpForm />
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setTab("signin")}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              </TabsContent>
              <TabsContent value="forgot" className="mt-6">
                <ForgotForm />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    navigate({ to: "/dashboard" });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h2 className="font-serif text-xl font-semibold">Welcome back</h2>
      <div className="space-y-1.5">
        <Label htmlFor="in-email">Email</Label>
        <Input
          id="in-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="in-pass">Password</Label>
        <Input
          id="in-pass"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={busy} className="w-full rounded-full">
        {busy ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}

function ForgotForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("If that email exists, a reset link is on the way");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h2 className="font-serif text-xl font-semibold">Reset your password</h2>
      <p className="text-sm text-muted-foreground">
        Enter your email and we'll send you a link to set a new password.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="fg-email">Email</Label>
        <Input
          id="fg-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={busy} className="w-full rounded-full">
        {busy ? "Sending..." : "Send reset link"}
      </Button>
    </form>
  );
}

function SignUpForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Use at least 8 characters");
    if (password !== confirm) return toast.error("Passwords don't match");
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/onboarding` },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!data.session) {
      setSent(true);
      return toast.success("Check your email to confirm your account");
    }
    toast.success("Welcome to Beacon");
    navigate({ to: "/onboarding" });
  }

  if (sent) {
    return (
      <div className="space-y-3 text-center">
        <h2 className="font-serif text-xl font-semibold">Confirm your email</h2>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to {email}. Open it to finish creating your account.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h2 className="font-serif text-xl font-semibold">Create your account</h2>
      <div className="space-y-1.5">
        <Label htmlFor="up-email">Email</Label>
        <Input
          id="up-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="up-pass">Password</Label>
        <Input
          id="up-pass"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="up-pass2">Confirm password</Label>
        <Input
          id="up-pass2"
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={busy} className="w-full rounded-full">
        {busy ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
