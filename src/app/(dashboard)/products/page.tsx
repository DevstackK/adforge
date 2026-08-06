import { PageHeading } from "@/components/page-heading";
import { ProductList } from "@/features/products/product-list";
import { ProjectCreate } from "@/features/projects/project-create";
export default function Page() {
  return (
    <>
      <PageHeading
        eyebrow="Source library"
        title="Products"
        description="Bring product truth into AdForge once, then reuse it across copy, creative and campaign workflows."
      />
      <ProjectCreate />
      <ProductList />
    </>
  );
}
