import { scopedThreadKey } from "@t3tools/client-runtime";
import type { ScopedThreadRef } from "@t3tools/contracts";

let activeVisibleThreadKey: string | null = null;

export function setActiveVisibleThread(ref: ScopedThreadRef | null): void {
  activeVisibleThreadKey = ref ? scopedThreadKey(ref) : null;
}

export function getActiveVisibleThreadKey(): string | null {
  return activeVisibleThreadKey;
}

export function __resetActiveThreadViewForTests(): void {
  activeVisibleThreadKey = null;
}
