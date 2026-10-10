import { AlertTriangle, Loader2, WifiOff } from 'lucide-react';
import type { ForecastResult } from '../lib/weather';

interface Props {
  result: ForecastResult | null;
  loading: boolean;
  onRetry: () => void;
}

function timeAgo(timestamp: number): string {
  const mins = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
}

/**
 * Shows the state of the weather data above the advisory:
 *  - loading
 *  - saved forecast (network failed, using an older forecast)
 *  - unavailable (nothing to show)
 * Renders nothing when the forecast is fresh, so the normal screen stays clean.
 * Every state pairs an icon with bold text so it is readable without colour.
 */
export function ForecastStatus({ result, loading, onRetry }: Props) {
  if (loading && !result) {
    return (
      <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <strong>Loading forecast…</strong>
      </div>
    );
  }

  if (!result || result.status === 'fresh') return null;

  const retryButton = (
    <button
      type="button"
      onClick={onRetry}
      disabled={loading}
      className="mt-3 min-h-11 rounded-xl border-2 border-current px-5 font-semibold disabled:opacity-50"
    >
      {loading ? 'Trying…' : 'Try again'}
    </button>
  );

  if (result.status === 'stale') {
    return (
      <div role="alert" className="rounded-2xl border-2 border-amber-500/60 bg-amber-500/15 p-4 text-sm text-amber-200">
        <p className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <span>
            <strong>Saved forecast from {timeAgo(result.fetchedAt)}.</strong> We could not get the
            latest data, so check conditions at the shore before you go.
          </span>
        </p>
        {retryButton}
      </div>
    );
  }

  return (
    <div role="alert" className="rounded-2xl border-2 border-red-500/60 bg-red-500/15 p-4 text-sm text-red-200">
      <p className="flex items-start gap-3">
        <WifiOff className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <span>
          <strong>No forecast available.</strong> {result.message} Do not rely on BahariSafe for
          this trip. Check with KMD or your BMU.
        </span>
      </p>
      {retryButton}
    </div>
  );
}
