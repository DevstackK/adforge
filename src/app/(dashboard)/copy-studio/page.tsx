import { PageHeading } from "@/components/page-heading";
import { CopyStudio } from "@/features/ai/copy-studio";
export default function Page() {
  return (
    <>
      <PageHeading
        eyebrow="Language forge"
        title="Copy studio"
        description="Generate channel-aware concepts and copy variants grounded in your product, audience and brand voice."
      />
      <CopyStudio />
    </>
  );
}
