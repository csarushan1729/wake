import { createFileRoute } from "@tanstack/react-router";
import { Desk } from "@/components/wake/desk";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Desk />
    </main>
  );
}
