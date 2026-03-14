import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getServiceByName } from "@/lib/services";

type Props = {
  name: string;
  size?: "sm" | "md";
};

export function ServiceAvatar({ name, size = "md" }: Props) {
  const service = getServiceByName(name);
  const sizeClass = size === "sm" ? "w-4 h-4" : "w-5 h-5";

  return (
    <Avatar className={`${sizeClass} rounded-md`}>
      <AvatarImage src={service?.logo} alt={name} className="object-contain p-0.5" />
      <AvatarFallback
        className="rounded-md text-white text-xs font-bold"
        style={{ backgroundColor: service?.color ?? "#888" }}
      >
        {name[0]}
      </AvatarFallback>
    </Avatar>
  );
}
