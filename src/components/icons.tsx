export function PlayIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function SunIcon({
  filled,
  className = "w-3.5 h-3.5",
}: {
  filled?: boolean;
  className?: string;
}) {
  return filled ? (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2a1 1 0 011 1v2a1 1 0 11-2 0V3a1 1 0 011-1zm0 15a5 5 0 110-10 5 5 0 010 10zM11 20a1 1 0 112 0v1a1 1 0 11-2 0v-1zM3 11a1 1 0 110 2H2a1 1 0 110-2h1zm19 0a1 1 0 110 2h-1a1 1 0 110-2h1zM5.636 4.222a1 1 0 011.414 0l.707.707A1 1 0 016.343 6.343l-.707-.707a1 1 0 010-1.414zm12.021 12.021a1 1 0 011.414 0l.707.707a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 010-1.414zM18.95 5.636a1 1 0 010-1.414 1 1 0 011.414 0l.707.707a1 1 0 01-1.414 1.414l-.707-.707zM6.343 17.657a1 1 0 010 1.414l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 0z" />
    </svg>
  ) : (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="5" />
      <path strokeLinecap="round" d="M12 2v2m0 16v2M4.2 4.2l1.4 1.4m12.8 12.8l1.4 1.4M2 12h2m16 0h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </svg>
  );
}
