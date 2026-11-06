export function BrandMark({
  className = "w-8 h-8",
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect width="64" height="64" rx="18" fill="#f4a7b9" />
      <path
        d="M17 44V22l15 14 15-14v22"
        fill="none"
        stroke="#ffffff"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-sans font-bold tracking-tight text-stone-800 ${className}`}
    >
      My<span className="text-rose-500">Term</span>
    </span>
  );
}

export function BrandLockup({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const markSize =
    size === "lg" ? "w-14 h-14" : size === "md" ? "w-10 h-10" : "w-8 h-8";
  const textSize =
    size === "lg" ? "text-4xl" : size === "md" ? "text-2xl" : "text-xl";

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <BrandMark className={`${markSize} flex-shrink-0`} />
      <BrandWordmark className={textSize} />
    </div>
  );
}
