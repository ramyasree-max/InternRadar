import { AlertTriangle, CheckCircle2, Clock, HelpCircle, XCircle } from 'lucide-react';

export function StatusText({ status }: { status: string }) {
  const normalized = status || 'Unverified';

  if (normalized === 'Verified Open' || normalized === 'Operational' || normalized === 'Connected') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F9D78] whitespace-nowrap shrink-0">
        <CheckCircle2 className="w-3.5 h-3.5 text-[#0F9D78] shrink-0" />
        <span>{normalized}</span>
      </span>
    );
  }

  if (
    normalized === 'Closing Soon' ||
    normalized === 'Temporarily Unavailable' ||
    normalized === 'Source Temporarily Unavailable' ||
    normalized === 'Verification Required'
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D69E36] whitespace-nowrap shrink-0">
        <Clock className="w-3.5 h-3.5 text-[#D69E36] shrink-0" />
        <span>{normalized}</span>
      </span>
    );
  }

  if (normalized === 'Closed' || normalized === 'Expired' || normalized === 'Collection Failed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 whitespace-nowrap shrink-0">
        {normalized === 'Collection Failed' ? (
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <XCircle className="w-3.5 h-3.5 shrink-0" />
        )}
        <span>{normalized}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#64748B] whitespace-nowrap shrink-0">
      <HelpCircle className="w-3.5 h-3.5 shrink-0" />
      <span>{normalized}</span>
    </span>
  );
}
