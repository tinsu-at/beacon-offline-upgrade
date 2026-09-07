import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useFeatures } from "@/lib/features";

type Props = {
  feature: "developerMode" | "telegramEnabled";
  title: string;
  description: string;
  children: React.ReactNode;
};

/** Shows a page only when the signed-in account has that feature switched on. */
export function FeatureGate({ feature, title, description, children }: Props) {
  const features = useFeatures();
  if (features.isLoading) return null;
  if (features[feature]) return <>{children}</>;
  return (
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 py-16 text-center">
      <h1 className="font-serif text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
      <Button asChild className="rounded-full">
        <Link to="/settings">Open settings</Link>
      </Button>
    </div>
  );
}
