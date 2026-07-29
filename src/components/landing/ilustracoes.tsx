export function IlustraConectar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      <rect width="120" height="120" rx="28" fill="#0B0B0F" />
      <rect x="18" y="28" width="40" height="40" rx="12" fill="#FFE24B" />
      <rect x="62" y="52" width="40" height="40" rx="12" fill="#FAF9F6" />
      <path d="M48 58 L72 66" stroke="#FF5A5F" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

export function IlustraPalavraChave({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      <rect width="120" height="120" rx="28" fill="#0B0B0F" />
      <rect x="20" y="30" width="80" height="46" rx="14" fill="#FAF9F6" />
      <path d="M40 76 L40 92 L58 76 Z" fill="#FAF9F6" />
      <path d="M66 38 L48 60 H58 L52 72 L72 50 H62 Z" fill="#0B0B0F" />
      <circle cx="92" cy="26" r="8" fill="#FFE24B" />
    </svg>
  );
}

export function IlustraCaixaEntrada({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      <rect width="120" height="120" rx="28" fill="#0B0B0F" />
      <rect x="22" y="30" width="76" height="18" rx="9" fill="#FAF9F6" opacity="0.25" />
      <rect x="22" y="53" width="76" height="18" rx="9" fill="#FFE24B" />
      <rect x="22" y="76" width="76" height="18" rx="9" fill="#FAF9F6" opacity="0.5" />
      <circle cx="34" cy="62" r="5" fill="#0B0B0F" />
      <rect x="46" y="58" width="38" height="8" rx="4" fill="#0B0B0F" opacity="0.35" />
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
