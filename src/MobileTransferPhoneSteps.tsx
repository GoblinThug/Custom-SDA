import { Lang, t } from "./i18n";

export function MobileTransferPhoneSteps({
  lang,
  mode,
}: {
  lang: Lang;
  mode: "send" | "receive";
}) {
  const keys =
    mode === "send"
      ? (["mobilePhoneSendStep1", "mobilePhoneSendStep2", "mobilePhoneSendStep3"] as const)
      : (["mobilePhoneRecvStep1", "mobilePhoneRecvStep2", "mobilePhoneRecvStep3"] as const);

  return (
    <ol className="transfer-phone-steps muted card-hint">
      {keys.map((key) => (
        <li key={key}>{t(lang, key)}</li>
      ))}
    </ol>
  );
}
