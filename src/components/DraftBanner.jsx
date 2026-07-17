import { Bookmark, WifiOff, Trash2, RotateCcw } from 'lucide-react';
import { formatTimestamp } from '../utils/formatTimestamp';

/**
 * Reusable banner that prompts user to restore or discard an unsaved draft,
 * and warns the user when the browser detects loss of internet connection.
 */
export default function DraftBanner({
  hasDraft,
  draftInfo,
  onRestore,
  onDiscard,
  isOffline,
  label = "Unsaved Draft Available",
  description,
}) {
  if (!hasDraft && !isOffline) return null;

  return (
    <div className="space-y-2 mb-4">
      {/* Offline Alert Banner */}
      {isOffline && (
        <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-3 flex items-start gap-2.5 shadow-sm transition-all">
          <WifiOff className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
          <div className="flex-1 text-xs">
            <p className="font-semibold text-amber-900">
              You are offline (Loss of Internet Connection)
            </p>
            <p className="text-amber-800/90 mt-0.5">
              Don&apos;t worry! Your form entries are automatically being protected and saved as a draft on this device.
            </p>
          </div>
        </div>
      )}

      {/* Draft Restoration Banner */}
      {hasDraft && (
        <div className="bg-emerald-50/90 border border-emerald-300 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm transition-all">
          <div className="flex items-start gap-2.5">
            <Bookmark className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-emerald-900">
                {label}
              </p>
              <p className="text-emerald-800/90 mt-0.5">
                {description || `We found a draft saved on ${formatTimestamp(draftInfo?.timestamp)}. Would you like to restore your previous entries?`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={onRestore}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium text-xs rounded-lg transition shadow-xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restore Draft
            </button>
            <button
              type="button"
              onClick={onDiscard}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 font-medium text-xs border border-slate-200 hover:border-rose-300 rounded-lg transition cursor-pointer"
              title="Discard saved draft"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
