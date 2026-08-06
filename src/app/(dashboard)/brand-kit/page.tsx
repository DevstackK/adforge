import { PageHeading } from "@/components/page-heading";
import { BrandKitForm } from "@/features/brand/brand-kit-form";
export default function Page() {
  return (
    <>
      <PageHeading
        eyebrow="Creative governance"
        title="Brand kit"
        description="Keep colors, typography, approved claims and tone consistent across every generated output."
      />
      <BrandKitForm />
    </>
  );
}
