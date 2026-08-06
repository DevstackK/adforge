import { SignUp } from "@clerk/nextjs";
export default function Page() {
  return (
    <main className="dot-grid grid min-h-screen place-items-center p-6">
      <SignUp forceRedirectUrl="/onboarding" />
    </main>
  );
}
