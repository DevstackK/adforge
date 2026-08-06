import { CreateOrganization } from "@clerk/nextjs";
import { Brand } from "@/components/layout/brand";

export default function Page() {
  return (
    <main className="dot-grid grid min-h-screen place-items-center p-6">
      <div className="space-y-6">
        <div className="flex justify-center">
          <Brand />
        </div>
        <CreateOrganization
          afterCreateOrganizationUrl="/dashboard"
          skipInvitationScreen={false}
        />
      </div>
    </main>
  );
}
