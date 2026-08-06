import { PageHeading } from "@/components/page-heading";
import { BillingPortal, Plans } from "@/features/billing/plans";
import { ConnectionList } from "@/features/connections/connection-list";
import {
  DeveloperSettings,
  SupportForm,
} from "@/features/settings/developer-settings";
export default function Page() {
  return (
    <>
      <PageHeading
        eyebrow="Workspace controls"
        title="Settings & billing"
        description="Manage plan capacity, credit allowances, advertising connections and operational settings."
      />
      <BillingPortal />
      <Plans />
      <ConnectionList />
      <DeveloperSettings />
      <SupportForm />
    </>
  );
}
