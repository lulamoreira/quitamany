export function IlustraConectar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      <rect x="8" y="24" width="48" height="48" rx="14" fill="#FFE24B" />
      <rect x="64" y="48" width="48" height="48" rx="14" fill="#0B0B0F" />
      <circle cx="32" cy="48" r="10" stroke="#0B0B0F" strokeWidth="5" />
      <circle cx="88" cy="72" r="10" stroke="#FFE24B" strokeWidth="5" />
      <path d="M44 58 L76 62" stroke="#FF5A5F" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

export function IlustraPalavraChave({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      <rect x="10" y="26" width="100" height="60" rx="16" fill="#FFE24B" />
      <path d="M36 86 L36 106 L58 86 Z" fill="#FFE24B" />
      <path d="M66 38 L46 64 H58 L52 82 L74 56 H62 Z" fill="#0B0B0F" />
    </svg>
  );
}

export function IlustraCaixaEntrada({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      <rect x="14" y="20" width="92" height="24" rx="8" fill="#0B0B0F" opacity="0.15" />
      <rect x="14" y="48" width="92" height="24" rx="8" fill="#FF5A5F" />
      <rect x="14" y="76" width="92" height="24" rx="8" fill="#0B0B0F" />
      <circle cx="28" cy="60" r="6" fill="#FAF9F6" />
      <rect x="42" y="56" width="46" height="8" rx="4" fill="#FAF9F6" opacity="0.85" />
      <circle cx="28" cy="88" r="6" fill="#FFE24B" />
      <rect x="42" y="84" width="34" height="8" rx="4" fill="#FFE24B" opacity="0.6" />
    </svg>
  );
}

export function IlustraPrivacidade({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      <path d="M60 12 L102 28 V62 C102 88 84 102 60 108 C36 102 18 88 18 62 V28 Z" fill="#FFE24B" />
      <rect x="30" y="50" width="60" height="22" rx="11" fill="#0B0B0F" />
      <text x="60" y="65" textAnchor="middle" fontSize="12" fontWeight="800" fill="#FFE24B">PARAR</text>
    </svg>
  );
}
