import type { OrchestrationEvent, ThreadId } from "@t3tools/contracts";
import type { NotificationSoundKind } from "./notificationSounds";

export interface OrchestrationBatchEffects {
  promoteDraftThreadIds: ThreadId[];
  clearDeletedThreadIds: ThreadId[];
  removeTerminalStateThreadIds: ThreadId[];
  needsProviderInvalidation: boolean;
  notificationSoundEvents: Array<{
    kind: NotificationSoundKind;
    threadId: ThreadId;
    sequence: number;
  }>;
}

export function deriveOrchestrationBatchEffects(
  events: readonly OrchestrationEvent[],
): OrchestrationBatchEffects {
  const threadLifecycleEffects = new Map<
    ThreadId,
    {
      clearPromotedDraft: boolean;
      clearDeletedThread: boolean;
      removeTerminalState: boolean;
    }
  >();
  const notificationSoundEventsByKey = new Map<
    string,
    { kind: NotificationSoundKind; threadId: ThreadId; sequence: number }
  >();
  let needsProviderInvalidation = false;

  const addNotificationSoundEvent = (
    kind: NotificationSoundKind,
    threadId: ThreadId,
    sequence: number,
  ) => {
    const key = `${kind}:${threadId}`;
    const existing = notificationSoundEventsByKey.get(key);
    if (!existing || sequence < existing.sequence) {
      notificationSoundEventsByKey.set(key, { kind, threadId, sequence });
    }
  };

  for (const event of events) {
    switch (event.type) {
      case "thread.turn-diff-completed": {
        addNotificationSoundEvent("completion", event.payload.threadId, event.sequence);
        needsProviderInvalidation = true;
        break;
      }

      case "thread.reverted": {
        needsProviderInvalidation = true;
        break;
      }

      case "thread.created": {
        threadLifecycleEffects.set(event.payload.threadId, {
          clearPromotedDraft: true,
          clearDeletedThread: false,
          removeTerminalState: false,
        });
        break;
      }

      case "thread.deleted": {
        threadLifecycleEffects.set(event.payload.threadId, {
          clearPromotedDraft: false,
          clearDeletedThread: true,
          removeTerminalState: true,
        });
        break;
      }

      case "thread.archived": {
        threadLifecycleEffects.set(event.payload.threadId, {
          clearPromotedDraft: false,
          clearDeletedThread: false,
          removeTerminalState: true,
        });
        break;
      }

      case "thread.unarchived": {
        threadLifecycleEffects.set(event.payload.threadId, {
          clearPromotedDraft: false,
          clearDeletedThread: false,
          removeTerminalState: false,
        });
        break;
      }

      case "thread.activity-appended": {
        if (
          event.payload.activity.kind === "approval.requested" ||
          event.payload.activity.kind === "user-input.requested"
        ) {
          addNotificationSoundEvent("attention", event.payload.threadId, event.sequence);
        }
        break;
      }

      default: {
        break;
      }
    }
  }

  const promoteDraftThreadIds: ThreadId[] = [];
  const clearDeletedThreadIds: ThreadId[] = [];
  const removeTerminalStateThreadIds: ThreadId[] = [];
  for (const [threadId, effect] of threadLifecycleEffects) {
    if (effect.clearPromotedDraft) {
      promoteDraftThreadIds.push(threadId);
    }
    if (effect.clearDeletedThread) {
      clearDeletedThreadIds.push(threadId);
    }
    if (effect.removeTerminalState) {
      removeTerminalStateThreadIds.push(threadId);
    }
  }

  return {
    promoteDraftThreadIds,
    clearDeletedThreadIds,
    removeTerminalStateThreadIds,
    needsProviderInvalidation,
    notificationSoundEvents: Array.from(notificationSoundEventsByKey.values()).toSorted(
      (left, right) => left.sequence - right.sequence,
    ),
  };
}
