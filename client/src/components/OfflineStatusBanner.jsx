import React, { useEffect, useMemo, useRef, useState } from "react";
import { connectionManager, offlineQueue, useOfflineQueue, useOnlineStatus } from "../utils/offline";
import {
  ArrowPathIcon,
  SignalSlashIcon,
  TrashIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

const pluralize = (n, word) => (n === 1 ? `${n} ${word}` : `${n} ${word}s`);

export default function OfflineStatusBanner() {
  const isOnline = useOnlineStatus();
  const queueStatus = useOfflineQueue();
  const prev = useRef({ isOnline, count: queueStatus.count, processing: queueStatus.processing });
  const [showJustSynced, setShowJustSynced] = useState(false);

  // Show a short "synced" confirmation when queue drains while online.
  useEffect(() => {
    const prevCount = prev.current.count;
    const nowCount = queueStatus.count;

    if (isOnline && prevCount > 0 && nowCount === 0) {
      setShowJustSynced(true);
      const t = setTimeout(() => setShowJustSynced(false), 3000);
      return () => clearTimeout(t);
    }
  }, [isOnline, queueStatus.count]);

  useEffect(() => {
    prev.current = { isOnline, count: queueStatus.count, processing: queueStatus.processing };
  }, [isOnline, queueStatus.count, queueStatus.processing]);

  const visible = !isOnline || queueStatus.count > 0 || queueStatus.processing || showJustSynced;

  const tone = useMemo(() => {
    if (!isOnline) return "offline";
    if (queueStatus.processing) return "syncing";
    if (queueStatus.count > 0) return "queued";
    if (showJustSynced) return "synced";
    return "hidden";
  }, [isOnline, queueStatus.processing, queueStatus.count, showJustSynced]);

  if (!visible) return null;

  const styleByTone = {
    offline: {
      wrapper: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
      text: "text-amber-900 dark:text-amber-100",
      subtext: "text-amber-700 dark:text-amber-200/80",
      Icon: SignalSlashIcon,
      title: "Offline",
      message: "Changes will be queued and synced when you’re back online.",
    },
    syncing: {
      wrapper: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
      text: "text-blue-900 dark:text-blue-100",
      subtext: "text-blue-700 dark:text-blue-200/80",
      Icon: ArrowPathIcon,
      title: "Syncing",
      message: `Processing ${pluralize(queueStatus.count, "queued change")}…`,
    },
    queued: {
      wrapper: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
      text: "text-blue-900 dark:text-blue-100",
      subtext: "text-blue-700 dark:text-blue-200/80",
      Icon: ArrowPathIcon,
      title: "Queued",
      message: `${pluralize(queueStatus.count, "change")} pending sync.`,
    },
    synced: {
      wrapper: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
      text: "text-green-900 dark:text-green-100",
      subtext: "text-green-700 dark:text-green-200/80",
      Icon: CheckCircleIcon,
      title: "Synced",
      message: "All queued changes have been processed.",
    },
  };

  const cfg = styleByTone[tone] || styleByTone.queued;
  const Icon = cfg.Icon;

  const onRetrySync = async () => {
    try {
      const online = await connectionManager.checkConnection?.();
      if (online === false) return;
    } catch {
      // ignore
    }
    offlineQueue.processQueue?.();
  };

  const onClearQueue = () => {
    const ok = window.confirm(
      "Clear the offline queue?\n\nAny queued changes that haven't been sent yet will be lost.",
    );
    if (!ok) return;
    offlineQueue.clear();
  };

  return (
    <div className={`sticky top-0 z-40 border-b ${cfg.wrapper}`}>
      <div className="mx-auto max-w-7xl px-4 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <Icon className={`h-5 w-5 mt-0.5 ${cfg.text} ${tone === "syncing" ? "animate-spin" : ""}`} />
            <div className="min-w-0">
              <div className={`text-sm font-semibold ${cfg.text}`}>
                {cfg.title}
                {(queueStatus.count > 0 || queueStatus.processing) && (
                  <span className={`ml-2 text-xs font-medium ${cfg.subtext}`}>
                    {pluralize(queueStatus.count, "queued change")}
                  </span>
                )}
              </div>
              <div className={`text-xs ${cfg.subtext}`}>{cfg.message}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(queueStatus.count > 0 || queueStatus.processing) && (
              <button
                type="button"
                onClick={onRetrySync}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/30 px-2 py-1 text-xs text-gray-800 dark:text-gray-100 hover:bg-white dark:hover:bg-gray-900/50 transition-colors"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Retry sync
              </button>
            )}
            {queueStatus.count > 0 && (
              <button
                type="button"
                onClick={onClearQueue}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/30 px-2 py-1 text-xs text-gray-800 dark:text-gray-100 hover:bg-white dark:hover:bg-gray-900/50 transition-colors"
              >
                <TrashIcon className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


