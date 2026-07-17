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
        <div className="bg-amber-50/95 border border-amber-300 rounded-2xl p-3.5 flex items-start gap-3 shadow-xs transition-all">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shrink-0 mt-0.5">
            <WifiOff className="w-4 h-4 animate-pulse" />
          </div>
          <div className="flex-1 text-xs">
            <p className="font-bold text-amber-950 tracking-tight">
              You are offline (Loss of Internet Connection)
            </p>
            <p className="text-amber-900/80 mt-1 leading-relaxed pl-0.5">
              Don&apos;t worry! Your form entries are automatically being protected and saved as a draft on this device.
            </p>
          </div>
        </div>
      )}

      {/* Draft Restoration Card */}
      {hasDraft && (
        <div className="bg-gradient-to-br from-emerald-50/95 via-emerald-50/70 to-teal-50/80 border border-emerald-200/90 rounded-2xl p-4 shadow-xs transition-all">
          {/* Card Header: Icon + Title + Discard Icon at top right */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 shrink-0">
                <Bookmark className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-emerald-950 tracking-tight">
                  {label}
                </h4>
                {draftInfo?.timestamp && (
                  <p className="text-[10px] font-semibold text-emerald-700/80 mt-0.5">
                    Saved on {formatTimestamp(draftInfo.timestamp)}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onDiscard}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50/80 rounded-lg transition-colors cursor-pointer"
              title="Discard saved draft"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Full-width Description Text */}
          <p className="text-xs text-emerald-900/85 leading-relaxed mt-2.5 pl-10.5">
            {description || "We found a draft from your previous session. Would you like to restore your entries?"}
          </p>

          {/* Action Button Bar */}
          <div className="mt-3.5 flex items-center justify-end gap-2 pl-10.5">
            <button
              type="button"
              onClick={onRestore}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs rounded-xl shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restore Progress
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
