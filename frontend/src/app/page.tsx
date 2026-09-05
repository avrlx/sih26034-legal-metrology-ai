import { redirect } from "next/navigation";

import { AnalysisWorkspace } from "@/components/analysis-workspace";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <AnalysisWorkspace />;
}
