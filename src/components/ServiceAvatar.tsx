import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getServiceByName } from "@/lib/services";

type Props = {
  name: string;
  size?: "sm" | "md";
};

export function ServiceAvatar({ name, size = "md" }: Props) {
  const service = getServiceByName(name);
  const sizeClass = size === "sm" ? "w-4 h-4" : "w-5 h-5";

  // Two AvatarImage layers when a darkLogo is set: light shows in light mode,
  // dark shows in dark mode. Tailwind's `dark:` modifier hides whichever
  // doesn't apply. Using shadcn's AvatarImage on both means the fallback
  // logic still triggers if BOTH fail to load.
  const hasDark = !!service?.darkLogo;
  return (
    <Avatar className={`${sizeClass} rounded-md`}>
      <AvatarImage
        src={service?.logo}
        alt={name}
        className={`object-contain p-0.5 ${hasDark ? "dark:hidden" : ""}`}
      />
      {hasDark && (
        <AvatarImage
          src={service.darkLogo}
          alt={name}
          className="object-contain p-0.5 hidden dark:block"
        />
      )}
      <AvatarFallback
        className="rounded-md text-white text-xs font-bold"
        style={{ backgroundColor: service?.color ?? "#888" }}
      >
        {name[0]}
      </AvatarFallback>
    </Avatar>
  );
}
