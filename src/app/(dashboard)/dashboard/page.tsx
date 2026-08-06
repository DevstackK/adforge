import Link from "next/link";
import { Plus, WandSparkles } from "lucide-react";
import { Overview } from "@/features/dashboard/overview";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { UsageCard } from "@/features/billing/usage-card";
export default function Page() {
  return (
    <>
      <PageHeading
        eyebrow="Workspace pulse"
        title="Good morning, creator."
        description="See what is moving, what is learning, and where your next iteration can win."
        action={
          <div className="flex gap-2">
            <Button asChild variant="secondary">
              <Link href="/products">
                <Plus size={16} />
                Import product
              </Link>
            </Button>
            <Button asChild>
              <Link href="/copy-studio">
                <WandSparkles size={16} />
                Create with AI
              </Link>
            </Button>
          </div>
        }
      />
      <UsageCard />
      <Overview />
    </>
  );
}
