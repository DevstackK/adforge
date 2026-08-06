import { PageHeading } from "@/components/page-heading";
import { TeamList } from "@/features/team/team-list";
import { InviteForm } from "@/features/team/invite-form";
export default function Page() {
  return (
    <>
      <PageHeading
        eyebrow="Organization"
        title="Team"
        description="Collaborate with role-based access to projects, creative, publishing and analytics."
      />
      <InviteForm />
      <TeamList />
    </>
  );
}
