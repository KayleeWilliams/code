import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import {
  DEFAULT_ATTENTION_NOTIFICATION_SOUND_ID,
  DEFAULT_COMPLETION_NOTIFICATION_SOUND_ID,
  type NotificationSoundAsset,
  type NotificationSoundSettings,
} from "@t3tools/contracts/settings";

export type NotificationSoundKind = "attention" | "completion";

export interface BuiltInNotificationSound {
  readonly id: string;
  readonly label: string;
  readonly source: "builtin";
  readonly url: string;
  readonly mimeType: string;
}

export type NotificationSoundOption = BuiltInNotificationSound | NotificationSoundAsset;

export const MAX_CUSTOM_NOTIFICATION_SOUND_BYTES = 512 * 1024;
export const MAX_CUSTOM_NOTIFICATION_SOUND_COUNT = 8;
export const ACCEPTED_NOTIFICATION_SOUND_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/mp4",
] as const;

export const BUILT_IN_NOTIFICATION_SOUNDS: readonly BuiltInNotificationSound[] = [
  {
    id: DEFAULT_ATTENTION_NOTIFICATION_SOUND_ID,
    label: "Minecrat Click",
    source: "builtin",
    url: "/sounds/minecrat-click.mp3",
    mimeType: "audio/mpeg",
  },
  {
    id: DEFAULT_COMPLETION_NOTIFICATION_SOUND_ID,
    label: "Note Block Pling",
    source: "builtin",
    url: "/sounds/note-block-pling.ogg",
    mimeType: "audio/ogg",
  },
] as const;

const warnedPlaybackFailures = new Set<string>();
const playedNotificationKeys = new Set<string>();

export function listNotificationSoundOptions(
  settings: Pick<NotificationSoundSettings, "customSounds">,
): NotificationSoundOption[] {
  return [...BUILT_IN_NOTIFICATION_SOUNDS, ...settings.customSounds];
}

export function resolveNotificationSound(
  settings: Pick<NotificationSoundSettings, "customSounds">,
  soundId: string,
): NotificationSoundOption {
  return (
    listNotificationSoundOptions(settings).find((sound) => sound.id === soundId) ??
    BUILT_IN_NOTIFICATION_SOUNDS[0]!
  );
}

export function getNotificationSoundSource(sound: NotificationSoundOption): string {
  return sound.source === "custom" ? sound.dataUrl : sound.url;
}

export function getNotificationSoundIdForKind(
  settings: Pick<NotificationSoundSettings, "attentionSoundId" | "completionSoundId">,
  kind: NotificationSoundKind,
): string {
  return kind === "attention" ? settings.attentionSoundId : settings.completionSoundId;
}

export function shouldPlayNotificationSound(input: {
  readonly settings: Pick<NotificationSoundSettings, "enabled" | "playbackPolicy">;
  readonly isActiveVisibleThread: boolean;
  readonly createsUnseenStatus: boolean;
  readonly documentVisibilityState?: DocumentVisibilityState;
}): boolean {
  if (!input.settings.enabled) {
    return false;
  }

  switch (input.settings.playbackPolicy) {
    case "always":
      return true;
    case "unseen":
      return input.createsUnseenStatus;
    case "background":
      return !input.isActiveVisibleThread || input.documentVisibilityState !== "visible";
  }
}

function warnPlaybackFailureOnce(error: unknown): void {
  const key = error instanceof Error ? error.name || error.message : "unknown";
  if (warnedPlaybackFailures.has(key)) {
    return;
  }
  warnedPlaybackFailures.add(key);
  console.warn("[NOTIFICATION_SOUND] Playback failed", error);
}

export function playNotificationSound(input: {
  readonly kind: NotificationSoundKind;
  readonly settings: NotificationSoundSettings;
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly sequence: number;
  readonly isActiveVisibleThread: boolean;
  readonly createsUnseenStatus: boolean;
}): void {
  const documentVisibilityState =
    typeof document === "undefined" ? undefined : document.visibilityState;
  const playbackInput: Parameters<typeof shouldPlayNotificationSound>[0] = {
    settings: input.settings,
    isActiveVisibleThread: input.isActiveVisibleThread,
    createsUnseenStatus: input.createsUnseenStatus,
    ...(documentVisibilityState === undefined ? {} : { documentVisibilityState }),
  };
  if (!shouldPlayNotificationSound(playbackInput)) {
    return;
  }

  const dedupeKey = `${input.environmentId}:${input.threadId}:${input.kind}:${input.sequence}`;
  if (playedNotificationKeys.has(dedupeKey)) {
    return;
  }
  playedNotificationKeys.add(dedupeKey);

  if (typeof Audio === "undefined") {
    return;
  }

  const soundId = getNotificationSoundIdForKind(input.settings, input.kind);
  const sound = resolveNotificationSound(input.settings, soundId);
  const audio = new Audio(getNotificationSoundSource(sound));
  audio.volume = 1;
  const playResult = audio.play();
  if (playResult && typeof playResult.catch === "function") {
    playResult.catch(warnPlaybackFailureOnce);
  }
}

export function playNotificationSoundPreview(
  settings: NotificationSoundSettings,
  kind: NotificationSoundKind,
): void {
  if (typeof Audio === "undefined") {
    return;
  }
  const soundId = getNotificationSoundIdForKind(settings, kind);
  const sound = resolveNotificationSound(settings, soundId);
  const audio = new Audio(getNotificationSoundSource(sound));
  audio.volume = 1;
  const playResult = audio.play();
  if (playResult && typeof playResult.catch === "function") {
    playResult.catch(warnPlaybackFailureOnce);
  }
}

export function validateNotificationSoundUpload(input: {
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly existingCustomSoundCount: number;
}): string | null {
  if (input.existingCustomSoundCount >= MAX_CUSTOM_NOTIFICATION_SOUND_COUNT) {
    return `You can keep up to ${MAX_CUSTOM_NOTIFICATION_SOUND_COUNT} custom sounds.`;
  }

  if (
    !ACCEPTED_NOTIFICATION_SOUND_MIME_TYPES.includes(
      input.mimeType as (typeof ACCEPTED_NOTIFICATION_SOUND_MIME_TYPES)[number],
    )
  ) {
    return "Choose an MP3, OGG, WAV, WebM, or MP4 audio file.";
  }

  if (input.sizeBytes > MAX_CUSTOM_NOTIFICATION_SOUND_BYTES) {
    return "Choose an audio file smaller than 512 KiB.";
  }

  if (input.fileName.trim().length === 0) {
    return "Choose a named audio file.";
  }

  return null;
}

export function createCustomNotificationSoundAsset(input: {
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly dataUrl: string;
  readonly id?: string;
  readonly createdAt?: string;
}): NotificationSoundAsset {
  const baseLabel = input.fileName.replace(/\.[^.]*$/u, "").trim() || "Custom sound";
  return {
    id: input.id ?? `custom-${crypto.randomUUID()}`,
    label: baseLabel.slice(0, 64),
    source: "custom",
    mimeType: input.mimeType,
    dataUrl: input.dataUrl,
    sizeBytes: input.sizeBytes,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function __resetNotificationSoundsForTests(): void {
  warnedPlaybackFailures.clear();
  playedNotificationKeys.clear();
}
