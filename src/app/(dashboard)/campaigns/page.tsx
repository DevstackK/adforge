import { CampaignList } from "@/features/campaigns/campaign-list";
import { CampaignBuilder } from "@/features/campaigns/campaign-builder";
import { PageHeading } from "@/components/page-heading";
export default function Page() {
  return (
    <>
      <PageHeading
        eyebrow="Distribution"
        title="Campaigns"
        description="Assemble channel-ready campaigns, validate account requirements, publish safely and monitor delivery state."
      />
      <CampaignBuilder />
      <CampaignList />
    </>
  );
}
