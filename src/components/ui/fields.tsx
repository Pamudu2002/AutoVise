import { ChevronDown, Search } from "lucide-react";
import type { SelectHTMLAttributes, InputHTMLAttributes } from "react";

export function Select({ children, className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="select-wrap">
      <select className={`select ${className ?? ""}`} {...props}>
        {children}
      </select>
      <ChevronDown size={16} aria-hidden />
    </div>
  );
}

export function SearchInput({ className, iconSize = 16, ...props }: InputHTMLAttributes<HTMLInputElement> & { iconSize?: number }) {
  return (
    <div className="input-icon">
      <Search size={iconSize} aria-hidden />
      <input className={`input ${className ?? ""}`} type="search" {...props} />
    </div>
  );
}

export function Switch({ on, onChange, labelledBy, describedBy, disabled }: { on: boolean; onChange: (v: boolean) => void; labelledBy?: string; describedBy?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      className={`switch${on ? " on" : ""}`}
      role="switch"
      aria-checked={on}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!on)}
    />
  );
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <span className="err" role="alert">
      {children}
    </span>
  );
}
