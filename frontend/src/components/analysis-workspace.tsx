"use client";

import { InspectorProfile } from "@/components/inspector-profile";
import { WorkspaceShell } from "@/components/workspace-shell";

export function AnalysisWorkspace() {
  return (
    <>
      <WorkspaceShell />
      <InspectorProfile />
    </>
  );
}
