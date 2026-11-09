import { useEffect, useId, useRef, useState } from "react";
import { IconChevronDown } from "./icons";

export type SelectOption = {
  value: string;
  label: string;
};

export function SelectMenu({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div className="select-menu" ref={rootRef}>
      {label ? <div className="label">{label}</div> : null}
      <button
        type="button"
        className="select-trigger"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        <span className="select-value">{selected?.label ?? "—"}</span>
        <span className={`chevron ${open ? "is-open" : ""}`}>
          <IconChevronDown size={20} />
        </span>
      </button>
      <div
        id={listId}
        role="listbox"
        className={`dropdown menu-dropdown${open ? " is-open" : ""}`}
        aria-hidden={!open}
        inert={!open ? true : undefined}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={option.value === value}
            className={option.value === value ? "active" : ""}
            onClick={() => {
              onChange(option.value);
              setOpen(false);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
