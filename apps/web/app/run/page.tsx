import { RunConsole } from "@/components/run/RunConsole";
import { liveAvailable } from "@/lib/agent/select";
import { PRESET_TASKS } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default function RunPage() {
  return <RunConsole presets={PRESET_TASKS} liveAvailable={liveAvailable()} />;
}
