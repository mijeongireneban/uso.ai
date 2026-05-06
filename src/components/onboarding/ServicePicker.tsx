import { ServiceAvatar } from "@/components/ServiceAvatar";
import { Button } from "@/components/ui/button";
import { SERVICES } from "@/lib/services";

type Props = {
  selected: Set<string>;
  onToggle: (serviceId: string) => void;
  onContinue: () => void;
  onSkip: () => void;
};

export function ServicePicker({ selected, onToggle, onContinue, onSkip }: Props) {
  return (
    <div className="flex flex-col h-full px-6 py-6">
      <div className="space-y-1.5 mb-5">
        <h2 className="text-lg font-semibold">Welcome to uso.ai</h2>
        <p className="text-xs text-muted-foreground">
          Pick the AI services you use. We'll walk you through connecting each one.
        </p>
      </div>

      <div className="space-y-2 flex-1">
        {SERVICES.map((service) => {
          const isOn = selected.has(service.id);
          const displayName = service.id === "chatgpt" ? "ChatGPT" : service.name;
          return (
            <label
              key={service.id}
              className="flex items-center gap-3 p-3 rounded-md border border-border cursor-pointer hover:bg-secondary/40 transition-colors"
            >
              <input
                type="checkbox"
                checked={isOn}
                onChange={() => onToggle(service.id)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <ServiceAvatar name={service.name} size="sm" />
              <span className="text-xs font-medium">{displayName}</span>
            </label>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-5">
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip setup
        </button>
        <Button onClick={onContinue} disabled={selected.size === 0}>
          Continue
        </Button>
      </div>
    </div>
  );
}
