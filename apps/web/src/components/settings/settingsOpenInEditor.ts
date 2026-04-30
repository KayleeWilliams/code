import { useCallback, useState } from "react";

import { resolveAndPersistPreferredEditor } from "../../editorPreferences";
import { ensureLocalApi } from "../../localApi";
import { useServerAvailableEditors } from "../../rpc/serverState";

export function useOpenServerPathInPreferredEditor() {
  const availableEditors = useServerAvailableEditors();
  const [openingPathByTarget, setOpeningPathByTarget] = useState<Record<string, boolean>>({});
  const [openPathErrorByTarget, setOpenPathErrorByTarget] = useState<Record<string, string | null>>(
    {},
  );

  const openPathInPreferredEditor = useCallback(
    (target: string, path: string | null, failureMessage: string) => {
      if (!path) return;
      setOpenPathErrorByTarget((existing) => ({ ...existing, [target]: null }));
      setOpeningPathByTarget((existing) => ({ ...existing, [target]: true }));

      const editor = resolveAndPersistPreferredEditor(availableEditors);
      if (!editor) {
        setOpenPathErrorByTarget((existing) => ({
          ...existing,
          [target]: "No available editors found.",
        }));
        setOpeningPathByTarget((existing) => ({ ...existing, [target]: false }));
        return;
      }

      void ensureLocalApi()
        .shell.openInEditor(path, editor)
        .catch((error) => {
          setOpenPathErrorByTarget((existing) => ({
            ...existing,
            [target]: error instanceof Error ? error.message : failureMessage,
          }));
        })
        .finally(() => {
          setOpeningPathByTarget((existing) => ({ ...existing, [target]: false }));
        });
    },
    [availableEditors],
  );

  return {
    openPathInPreferredEditor,
    openingPathByTarget,
    openPathErrorByTarget,
  };
}
