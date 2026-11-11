import { useLayoutEffect, useRef } from "react";

const CODE_FONT_MAX = 42;
const CODE_FONT_MIN = 17;
/** Extra inset so glyph / letter-spacing does not touch the copy button. */
const CODE_FIT_MARGIN = 14;

function formatCode(code: string) {
  return code.split("").join(" ");
}

export function fitCodeFontSize(wrap: HTMLElement, text: HTMLElement) {
  const budget = Math.max(0, wrap.clientWidth - CODE_FIT_MARGIN);
  text.style.fontSize = `${CODE_FONT_MAX}px`;
  if (budget <= 0 || text.scrollWidth <= budget) {
    return;
  }
  let lo = CODE_FONT_MIN;
  let hi = CODE_FONT_MAX;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    text.style.fontSize = `${mid}px`;
    if (text.scrollWidth > budget) {
      hi = mid - 1;
    } else {
      lo = mid;
    }
  }
  text.style.fontSize = `${lo}px`;
}

export function GuardCodeDigits({ code }: { code: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const display = formatCode(code);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const text = textRef.current;
    if (!wrap || !text) {
      return;
    }
    const fit = () => fitCodeFontSize(wrap, text);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [display]);

  return (
    <div className="code-digits-wrap" ref={wrapRef}>
      <div className="code-digits" ref={textRef}>
        {display}
      </div>
    </div>
  );
}
