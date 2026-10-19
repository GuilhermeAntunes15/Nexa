import { redirect } from "next/navigation";

import AppNavigation from "@/components/AppNavigation";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed,account_status")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  if (profile.account_status !== "active") {
    redirect("/entrar?status=indisponivel");
  }

  return (
    <div className="app-shell">
      {children}
      <AppNavigation />
    </div>
  );
}
