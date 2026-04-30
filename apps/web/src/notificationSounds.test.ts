import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { DEFAULT_CLIENT_SETTINGS } from "@t3tools/contracts/settings";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  __resetNotificationSoundsForTests,
  createCustomNotificationSoundAsset,
  playNotificationSound,
  resolveNotificationSound,
  shouldPlayNotificationSound,
  validateNotificationSoundUpload,
} from "./notificationSounds";

const baseSettings = DEFAULT_CLIENT_SETTINGS.notificationSounds;

describe("notificationSounds", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    __resetNotificationSoundsForTests();
  });

  it("resolves built-in and custom sounds", () => {
    expect(resolveNotificationSound(baseSettings, "note-block-pling")).toMatchObject({
      id: "note-block-pling",
      source: "builtin",
      url: "/sounds/note-block-pling.ogg",
    });

    const custom = createCustomNotificationSoundAsset({
      id: "custom-1",
      fileName: "Alert.mp3",
      mimeType: "audio/mpeg",
      sizeBytes: 12,
      dataUrl: "data:audio/mpeg;base64,AAAA",
      createdAt: "2026-04-30T00:00:00.000Z",
    });

    expect(resolveNotificationSound({ customSounds: [custom] }, "custom-1")).toMatchObject({
      id: "custom-1",
      source: "custom",
      dataUrl: "data:audio/mpeg;base64,AAAA",
    });
    expect(resolveNotificationSound({ customSounds: [] }, "missing")).toMatchObject({
      id: "minecrat-click",
    });
  });

  it("applies playback policies", () => {
    expect(
      shouldPlayNotificationSound({
        settings: { enabled: false, playbackPolicy: "always" },
        isActiveVisibleThread: false,
        createsUnseenStatus: true,
      }),
    ).toBe(false);
    expect(
      shouldPlayNotificationSound({
        settings: { enabled: true, playbackPolicy: "background" },
        isActiveVisibleThread: true,
        createsUnseenStatus: true,
        documentVisibilityState: "visible",
      }),
    ).toBe(false);
    expect(
      shouldPlayNotificationSound({
        settings: { enabled: true, playbackPolicy: "background" },
        isActiveVisibleThread: true,
        createsUnseenStatus: true,
        documentVisibilityState: "hidden",
      }),
    ).toBe(true);
    expect(
      shouldPlayNotificationSound({
        settings: { enabled: true, playbackPolicy: "always" },
        isActiveVisibleThread: true,
        createsUnseenStatus: false,
      }),
    ).toBe(true);
    expect(
      shouldPlayNotificationSound({
        settings: { enabled: true, playbackPolicy: "unseen" },
        isActiveVisibleThread: false,
        createsUnseenStatus: false,
      }),
    ).toBe(false);
  });

  it("plays once per thread, kind, and sequence", () => {
    const play = vi.fn(() => Promise.resolve());
    const AudioMock = vi.fn().mockImplementation(function AudioMock() {
      return {
        play,
        volume: 0,
      };
    });
    vi.stubGlobal("Audio", AudioMock);

    const input = {
      kind: "completion" as const,
      settings: { ...baseSettings, playbackPolicy: "always" as const },
      environmentId: EnvironmentId.make("environment-local"),
      threadId: ThreadId.make("thread-1"),
      sequence: 5,
      isActiveVisibleThread: true,
      createsUnseenStatus: false,
    };

    playNotificationSound(input);
    playNotificationSound(input);
    playNotificationSound({ ...input, sequence: 6 });

    expect(AudioMock).toHaveBeenCalledTimes(2);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("validates uploads", () => {
    expect(
      validateNotificationSoundUpload({
        fileName: "sound.mp3",
        mimeType: "audio/mpeg",
        sizeBytes: 512 * 1024,
        existingCustomSoundCount: 0,
      }),
    ).toBeNull();
    expect(
      validateNotificationSoundUpload({
        fileName: "sound.txt",
        mimeType: "text/plain",
        sizeBytes: 1,
        existingCustomSoundCount: 0,
      }),
    ).toContain("MP3");
    expect(
      validateNotificationSoundUpload({
        fileName: "sound.mp3",
        mimeType: "audio/mpeg",
        sizeBytes: 512 * 1024 + 1,
        existingCustomSoundCount: 0,
      }),
    ).toContain("512 KiB");
    expect(
      validateNotificationSoundUpload({
        fileName: "sound.mp3",
        mimeType: "audio/mpeg",
        sizeBytes: 1,
        existingCustomSoundCount: 8,
      }),
    ).toContain("8 custom sounds");
  });
});
