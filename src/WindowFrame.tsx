import { ReactNode } from "react";
import { TitleBar } from "./TitleBar";
import { isMobileHost } from "./platform";

export function WindowFrame({
  title,
  children,
  showBrand = true,
}: {
  title: string;
  children: ReactNode;
  showBrand?: boolean;
}) {
  const mobile = isMobileHost();
  return (
    <div className={`window-frame ${mobile ? "window-frame--mobile" : ""}`}>
      <TitleBar title={title} showBrand={showBrand} />
      <div className="window-body">{children}</div>
    </div>
  );
}
