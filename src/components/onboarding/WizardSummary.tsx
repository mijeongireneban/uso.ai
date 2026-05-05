import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  connectedCount: number;
  totalSelected: number;
  onOpenDashboard: () => void;
  onOpenSettings: () => void;
};

export function WizardSummary({
  connectedCount,
  totalSelected,
  onOpenDashboard,
  onOpenSettings,
}: Props) {
  const allConnected = connectedCount === totalSelected;
  return (
    <div className="flex flex-col h-full items-center justify-center text-center px-6 py-8 space-y-4">
      <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
        <CheckCircle2 size={24} className="text-primary" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">You're set up.</h2>
        <p className="text-xs text-muted-foreground">
          {allConnected
            ? `${connectedCount} ${connectedCount === 1 ? "service" : "services"} connected.`
            : `${connectedCount} of ${totalSelected} connected. You can finish the rest in Settings whenever.`}
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs pt-2">
        <Button onClick={onOpenDashboard} className="w-full">
          Open Dashboard
        </Button>
        <Button variant="outline" onClick={onOpenSettings} className="w-full">
          Add more in Settings
        </Button>
      </div>
    </div>
  );
}
