import { useCallback, useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  CloseSquareIcon,
  MaximizeSquareIcon,
  MinimizeSquareMinimalisticIcon,
} from "@solar-icons/react/linear";
import { AppBrandIcon } from "./icons";
import { isMobileHost } from "./platform";

type TitleBarProps = {
  title: string;
  showBrand?: boolean;
};

const inTauri = isTauri();

export function TitleBar({ title, showBrand = true }: TitleBarProps) {
  const mobile = isMobileHost();
  const showControls = inTauri && !mobile;
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!inTauri) return;
    const win = getCurrentWindow();
  void win.isMaximized().then(setMaximized);
    const unlisten = win.onResized(() => {
      void win.isMaximized().then(setMaximized);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const minimize = useCallback(() => {
    if (!inTauri) return;
    void getCurrentWindow().minimize();
  }, []);

  const toggleMaximize = useCallback(() => {
    if (!inTauri) return;
    void getCurrentWindow().toggleMaximize();
  }, []);

  const close = useCallback(() => {
    if (!inTauri) return;
    void getCurrentWindow().close();
  }, []);

  return (
    <header className={`titlebar ${mobile ? "titlebar--mobile" : ""}`}>
      <div
        className="titlebar-drag"
        {...(!mobile ? { "data-tauri-drag-region": true } : {})}
      >
        {showBrand && (
          <div className="brand-mark">
            <AppBrandIcon size={20} />
          </div>
        )}
        <span
          className="brand-title"
          {...(!mobile ? { "data-tauri-drag-region": true } : {})}
        >
          {title}
        </span>
      </div>
      {showControls && (
        <div className="titlebar-controls">
          <button
            type="button"
            className="titlebar-btn"
            aria-label="Свернуть"
            onClick={minimize}
          >
            <MinimizeSquareMinimalisticIcon size={18} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="titlebar-btn"
            aria-label={maximized ? "Восстановить" : "Развернуть"}
            onClick={toggleMaximize}
          >
            <MaximizeSquareIcon size={18} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="titlebar-btn titlebar-btn-close"
            aria-label="Закрыть"
            onClick={close}
          >
            <CloseSquareIcon size={18} strokeWidth={1.75} />
          </button>
        </div>
      )}
    </header>
  );
}
