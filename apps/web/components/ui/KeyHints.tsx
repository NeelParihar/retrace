export function KeyHints({ hints }: { hints: [string[], string][] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
      {hints.map(([keys, label]) => (
        <span key={label} className="inline-flex items-center gap-1">
          {keys.map((k) => (
            <kbd key={k} className="kbd">{k}</kbd>
          ))}
          <span className="ml-1">{label}</span>
        </span>
      ))}
    </div>
  );
}
