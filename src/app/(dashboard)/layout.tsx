import { ClerkProvider } from "@clerk/nextjs";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <Topbar />
          <main className="mx-auto max-w-[1500px] p-5 md:p-8">{children}</main>
        </div>
      </div>
    </ClerkProvider>
  );
}
