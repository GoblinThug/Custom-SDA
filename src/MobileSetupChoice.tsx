import { AppBrandIcon } from "./icons";
import { Lang, t } from "./i18n";
import type { MobileSetupMode } from "./mobileSetup";

export function MobileSetupChoice({
  lang,
  onChoose,
}: {
  lang: Lang;
  onChoose: (mode: MobileSetupMode) => void;
}) {
  return (
    <div className="auth-screen">
      <div className="auth-card mobile-setup-choice">
        <div className="auth-heading">
          <div className="brand-mark">
            <AppBrandIcon size={28} />
          </div>
          <h1>{t(lang, "mobileSetupTitle")}</h1>
        </div>
        <p className="muted">{t(lang, "mobileSetupLead")}</p>
        <div className="mobile-setup-actions stack">
          <button
            type="button"
            className="primary-btn"
            onClick={() => onChoose("qr")}
          >
            {t(lang, "mobileSetupQr")}
          </button>
          <p className="muted card-hint">{t(lang, "mobileSetupQrHint")}</p>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => onChoose("fresh")}
          >
            {t(lang, "mobileSetupFresh")}
          </button>
          <p className="muted card-hint">{t(lang, "mobileSetupFreshHint")}</p>
        </div>
      </div>
    </div>
  );
}
