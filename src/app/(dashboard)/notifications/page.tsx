import { PageHeading } from "@/components/page-heading";
import { NotificationList } from "@/features/notifications/notification-list";
export default function Page() {
  return (
    <>
      <PageHeading
        eyebrow="Activity"
        title="Notifications"
        description="Generation, campaign, billing and team events that need your attention."
      />
      <NotificationList />
    </>
  );
}
