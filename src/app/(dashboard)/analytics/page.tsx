import { PageHeading } from "@/components/page-heading";
import { Overview } from "@/features/dashboard/overview";
export default function Page() {
  return (
    <>
      <PageHeading
        eyebrow="Performance intelligence"
        title="Analytics"
        description="Compare channel economics, spot creative leaders and turn delivery signals into the next focused experiment."
      />
      <Overview />
    </>
  );
}
