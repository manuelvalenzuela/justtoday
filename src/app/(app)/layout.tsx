import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { auth } from "@/lib/auth";
import { listPlansForUser } from "@/server/plans";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin");
  }

  const plans = await listPlansForUser(session.user.id);

  return (
    <AppShell user={session.user} plans={plans}>
      {children}
    </AppShell>
  );
}
