"use client";
// Everything that floats above the page: model settings, the command palette, the conversation dock.
import { SettingsDialog } from "@/components/harness/SettingsDialog";
import { AskDock } from "@/components/ask/AskDock";
import { CommandPalette } from "./CommandPalette";
import { ui, useUi } from "@/lib/client/ui-store";

export function Overlays() {
  const { settings } = useUi();
  return (
    <>
      <AskDock />
      <CommandPalette />
      {settings && <SettingsDialog onClose={ui.closeSettings} />}
    </>
  );
}
