import { LoaderCircle } from 'lucide-react';
import { useGateway } from '../contexts/GatewayContext.jsx';

export default function GatewayWakeNotice() {
  const { waking } = useGateway();
  if (!waking) return null;
  return (
    <div role="status" aria-live="polite" className="glass-card fixed top-3 left-1/2 z-[70] flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-2.5 px-4 py-3 shadow-xl">
      <LoaderCircle size={14} className="shrink-0 animate-spin text-info" aria-hidden="true" />
      <span className="whitespace-nowrap text-[11px] text-ink">Waking up secure gateway…</span>
    </div>
  );
}
