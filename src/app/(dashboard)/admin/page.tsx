import { PageHeading } from "@/components/page-heading";
import { AdminSummary } from "@/features/admin/admin-summary";
import { AdminResources } from "@/features/admin/admin-resources";
import { AdminMonitoring } from "@/features/admin/admin-monitoring";
export default function Page() {
  return (
    <>
      <PageHeading
        eyebrow="Platform operations"
        title="Administration"
        description="Monitor tenant growth, recurring revenue, feature rollout, support demand and audit activity."
      />
      <AdminSummary />
      <AdminMonitoring />
      <AdminResources />
    </>
  );
}
