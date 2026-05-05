import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { GUIDES, type CredentialGuideContent } from "@/lib/onboarding/guides";

type Props = {
  serviceId: string;
};

export function CredentialGuide({ serviceId }: Props) {
  const guide: CredentialGuideContent | undefined = GUIDES[serviceId];
  if (!guide) return null;

  return (
    <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
      <p className="text-foreground">{guide.intro}</p>

      <ol className="list-decimal pl-4 space-y-2">
        {guide.steps.map((step, i) => (
          <li key={i}>
            <span>{step.text}</span>
            {step.code && (
              <CopyableCode className="mt-1.5">{step.code}</CopyableCode>
            )}
          </li>
        ))}
      </ol>

      {guide.screenshot && (
        <figure className="space-y-1.5">
          <img
            src={guide.screenshot}
            alt={guide.screenshotCaption ?? `${serviceId} setup screenshot`}
            className="rounded-md border border-border w-full"
          />
          {guide.screenshotCaption && (
            <figcaption className="text-[11px] italic">
              {guide.screenshotCaption}
            </figcaption>
          )}
        </figure>
      )}

      {guide.inlineCode && !guide.screenshot && (
        <pre className="bg-muted text-foreground rounded-md p-2 text-[11px] font-mono whitespace-pre-wrap">
          {guide.inlineCode}
        </pre>
      )}

      {guide.troubleshooting && (
        <p className="italic">{guide.troubleshooting}</p>
      )}
    </div>
  );
}

function CopyableCode({ children, className }: { children: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={`flex items-center gap-2 bg-muted rounded-md px-2 py-1.5 font-mono text-[11px] text-foreground ${className ?? ""}`}>
      <code className="flex-1 truncate">{children}</code>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(children);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        className="text-muted-foreground hover:text-foreground transition-colors"
        title="Copy"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  );
}
