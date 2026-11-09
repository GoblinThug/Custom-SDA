import {
  faCircleCheck,
  faCircleExclamation,
  faCircleInfo,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { type Lang, localizeErrorMessage, loadStoredLang } from "./i18n";

export type ToastKind = "error" | "success" | "info";

type ToastItem = {
  id: number;
  message: string;
  kind: ToastKind;
};

let pushToast: ((message: string, kind?: ToastKind) => void) | null = null;
let toastLang: Lang = loadStoredLang();

export function setToastLang(lang: Lang) {
  toastLang = lang;
}

export function showToast(message: string, kind: ToastKind = "error") {
  const text =
    kind === "error" ? localizeErrorMessage(message, toastLang) : message;
  pushToast?.(text, kind);
}

export function notifyError(message: string | null | undefined) {
  if (message) {
    showToast(message, "error");
  }
}

const TOAST_MS = 4800;

function ToastGlyph({ kind }: { kind: ToastKind }) {
  const icon =
    kind === "success"
      ? faCircleCheck
      : kind === "error"
        ? faCircleExclamation
        : faCircleInfo;
  return <FontAwesomeIcon icon={icon} />;
}

export function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    pushToast = (message, kind = "error") => {
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev, { id, message, kind }]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, TOAST_MS);
    };
    return () => {
      pushToast = null;
    };
  }, []);

  if (!items.length) {
    return null;
  }

  return createPortal(
    <div className="toast-viewport" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`} role="status">
          <span className="toast-icon" aria-hidden="true">
            <ToastGlyph kind={t.kind} />
          </span>
          <span className="toast-text">{t.message}</span>
        </div>
      ))}
    </div>,
    document.body,
  );
}
