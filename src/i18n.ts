import type { ColorPalette, ColorScheme } from "./theme";

export type Lang = "ru" | "en";

const LANG_STORAGE_KEY = "csda-lang";

const dict = {
  ru: {
    brand: "Steam Desktop Authenticator",
    unlockTitle: "Разблокировать",
    createTitle: "Создать хранилище",
    unlockHint:
      "Введите пароль шифрования, чтобы открыть локальное хранилище.",
    createHint:
      "Все данные аккаунтов будут храниться только локально в зашифрованном виде. Запомните пароль — восстановить его нельзя.",
    password: "Пароль",
    passwordRepeat: "Повтор пароля",
    enter: "Войти",
    create: "Создать",
    loading: "Загрузка…",
    confirmations: "Подтверждения",
    encryption: "Шифрование",
    recentEvents: "Недавние события",
    noEvents: "Пока нет событий",
    checkUpdates: "Проверить обновления",
    settings: "Настройки",
    accounts: "Аккаунты",
    home: "Главная",
    navLabel: "Навигация",
    noAccount: "Нет аккаунта",
    importMafile: "импортируйте .maFile",
    addAccountHint: "добавьте аккаунт",
    sessionActive: "сессия активна",
    codeOnly: "только код Guard",
    lockVault: "Заблокировать хранилище",
    lockApp: "Заблокировать приложение",
    codeCopied: "Код скопирован",
    copy: "Копировать",
    refresh: "Обновить",
    refreshList: "Обновить список",
    confirm: "Подтвердить",
    deny: "Отклонить",
    addAccount: "Добавить аккаунт",
    pickMafile: "Выбрать .maFile",
    remove: "Удалить",
    cancel: "Отмена",
    back: "Назад",
    save: "Сохранить",
    settingsSaved: "Настройки сохранены",
    showPassword: "Показать пароль",
    hidePassword: "Скрыть пароль",
    passwordMin6: "Пароль должен быть не короче 6 символов",
    passwordsMismatch: "Пароли не совпадают",
    resetAuthenticator: "Сбросить authenticator",
    wipeTitle: "Сбросить хранилище?",
    wipeBody:
      "Будут безвозвратно удалены все аккаунты, секреты и пароль шифрования этого приложения. Steam Guard на самих аккаунтах Steam не снимается автоматически.",
    wiping: "Удаление…",
    wipeConfirm: "Удалить всё",
    noGuardHint: "Добавьте аккаунт, чтобы увидеть Steam Guard код.",
    confirmationsLead: "Нужны identity_secret и активная Steam-сессия.",
    noConfirmations: "Нет ожидающих подтверждений",
    keysLead:
      "Импортируйте .maFile или войдите через Steam, чтобы добавить аккаунт в хранилище.",
    pasteMafile: "Вставить содержимое .maFile",
    importJson: "Импортировать JSON",
    importing: "Импорт…",
    accountList: "Список",
    noAccountsYet: "Аккаунтов пока нет",
    general: "Общие",
    language: "Язык",
    scheme: "Режим",
    palette: "Палитра",
    autoLock: "Автоблокировка (сек, 0 = выкл)",
    encryptionSection: "Шифрование",
    encryptionHint:
      "Хранилище всегда зашифровано (Argon2id + AES-256-GCM). Данные не покидают ваш ПК.",
    currentPassword: "Текущий пароль",
    newPassword: "Новый пароль",
    changePassword: "Сменить пароль",
    onboardTitle: "Добавить аккаунт",
    onboardLead:
      "У вас ещё нет аккаунтов. Импортируйте готовый .maFile или войдите в Steam, чтобы создать authenticator.",
    useMafiles: "Использовать maFiles",
    useMafilesHint: "Импорт существующего .maFile",
    steamLogin: "Войти в аккаунт Steam",
    steamLoginHint:
      "Создать maFile через вход в Steam. При входе может прийти код на email или из приложения; для привязки authenticator нужен телефон (SMS).",
    importMafileTitle: "Импорт maFile",
    orPasteJson: "Или вставьте JSON",
    importAction: "Импортировать",
    steamSignInTitle: "Вход в Steam",
    steamSignInLead:
      "Логин создаст новый Steam Guard authenticator и сохранит maFile в зашифрованное хранилище.",
    steamUsername: "Логин Steam",
    steamPassword: "Пароль Steam",
    signingIn: "Вход…",
    enterSteamLogin: "Введите логин Steam",
    enterSteamPassword: "Введите пароль Steam",
    enterCode: "Введите код",
    code: "Код",
    revocationCode: "Код отзыва",
    setupLeadEmailCode: "Введите код из письма Steam на ваш email.",
    setupLeadDeviceCode:
      "Введите код Steam Guard из мобильного приложения Steam.",
    setupLeadConfirmMobileOrEmail:
      "Подтвердите вход в приложении Steam или по email.",
    setupLeadWaitConfirmContinue:
      "Ожидание подтверждения входа. После подтверждения нажмите «Продолжить».",
    setupLeadSmsLink:
      "Сохраните код отзыва ниже, затем введите SMS-код с привязанного телефона.",
    setupLabelSmsLink: "SMS-код для привязки authenticator",
    setupLeadNoPhone:
      "К аккаунту не привязан телефон. Добавьте номер в Steam и нажмите «Продолжить».",
    setupLeadConfirmSteamEmail:
      "Подтвердите email в Steam, затем нажмите «Продолжить».",
    setupLeadTransferSms:
      "Authenticator уже привязан. Запущен перенос — введите SMS-код.",
    setupLabelSmsTransfer: "SMS-код для переноса authenticator",
    submit: "Отправить",
    continueAction: "Продолжить",
    schemeDark: "Тёмный",
    schemeLight: "Светлый",
    paletteSteam: "Steam (синий)",
    paletteViolet: "Фиолетовый",
    paletteEmerald: "Изумрудный",
    paletteRose: "Розовый",
    paletteAmber: "Янтарный",
    paletteCyan: "Бирюзовый",
    errBadPassword: "Неверный пароль или повреждённый файл",
    errPasswordMin6: "Пароль должен быть не короче 6 символов",
    errNewPasswordMin6: "Новый пароль должен быть не короче 6 символов",
    errVaultNotFound: "Хранилище не найдено",
    errVaultExists: "Хранилище уже существует",
    errCrypto: "Ошибка шифрования",
    errAccountNotFound: "Аккаунт не найден",
    errNoAccounts: "Нет аккаунтов — импортируйте .maFile",
    errNoSteamSession: "Нет активной Steam-сессии",
    errNeedIdentitySecret: "Для подтверждений нужен identity_secret",
    errNoSharedSecret: "В файле нет shared_secret",
    errSharedSecretRequired: "shared_secret обязателен",
    errReadFile: "Не удалось прочитать файл",
    errBadMafileJson: "Неверный JSON .maFile",
    errBadSharedSecret: "Неверный shared_secret",
    errBadCode: "Неверный код",
    errConfirmationsFetch: "Не удалось получить подтверждения",
    errConfirmAccept: "Не удалось подтвердить",
    errConfirmDeny: "Не удалось отклонить",
    errLogin: "Ошибка входа",
    errIo: "Ошибка ввода-вывода",
    errSerde: "Ошибка сериализации",
    errSharedSecretB64: "shared_secret не в формате base64",
    mobile: "Телефон",
    mobileTransferSendTab: "Отправить",
    mobileTransferReceiveTab: "Принять",
    mobileTransferTitle: "Перенос аккаунта",
    mobileTransferLead:
      "Без интернета и сервера: в QR — зашифрованный аккаунт. Покажите QR другому устройству или поделитесь им.",
    mobileTransferAccount: "Аккаунт для переноса",
    mobileTransferCreate: "Создать QR",
    mobileTransferQr: "QR для переноса",
    mobileTransferQrHint:
      "Покажите QR другому телефону/ПК или нажмите «Поделиться». Код подтверждения нужен на принимающем устройстве.",
    mobileTransferShare: "Поделиться QR",
    mobileTransferShareOk: "Отправлено",
    mobileTransferShareCopied: "Ссылка и код скопированы",
    mobileTransferShareFail: "Не удалось поделиться",
    mobileTransferCopyDeepLink: "Скопировать ссылку",
    mobileTransferDeepLinkCopied: "Ссылка скопирована",
    mobileTransferCodeLabel: "Код подтверждения",
    mobileTransferCodeHint:
      "Тот же код введите на принимающем устройстве и здесь (для проверки).",
    mobileTransferConfirmDesktop: "Проверить код на этом устройстве",
    mobileTransferConfirmBtn: "Код совпадает",
    mobileTransferExpired: "QR устарел — создайте новый",
    mobileTransferExpires: "Действует ещё",
    mobileTransferCodeOk: "Код совпадает — на другом устройстве можно завершить импорт",
    mobileTransferShareText: "Custom SDA — код подтверждения",
    errMobileTransferQrTooBig:
      "Не удалось поместить данные в QR — попробуйте снова или импортируйте .maFile вручную",
    mobileTransferReceiveTitle: "Принять аккаунт",
    mobileTransferReceiveLead:
      "Сфотографируйте QR с другого устройства или выберите фото из галереи.",
    mobileTransferReceiveActiveLead: "Введите код с устройства-отправителя и импортируйте аккаунт.",
    mobileTransferReceiveCodeHint:
      "Шестизначный код показан под QR на устройстве, с которого делятся.",
    mobileTransferReceiveWaiting:
      "Ожидание QR… На другом устройстве откройте «Отправить» и создайте QR.",
    mobileTransferReceiveIdleHint:
      "Можно также открыть ссылку из QR — откроется этот экран.",
    mobileTransferImportBtn: "Импортировать",
    mobileTransferImportOk: "Аккаунт добавлен",
    mobileTransferUnknownAccount: "Аккаунт из QR",
    mobileSetupTitle: "Добро пожаловать",
    mobileSetupLead: "Как вы хотите начать на этом телефоне?",
    mobileSetupQr: "Импортировать через QR с ПК",
    mobileSetupQrHint:
      "На компьютере создайте QR в «Перенос на телефон», затем сфотографируйте его в приложении.",
    mobileSetupFresh: "Настроить с нуля",
    mobileSetupFreshHint: "Импорт .maFile или вход через Steam — как на компьютере.",
    mobileVaultCreateQr:
      "QR принят. Придумайте пароль — он зашифрует аккаунт на этом телефоне.",
    mobileVaultCreateFresh:
      "Придумайте пароль для локального зашифрованного хранилища.",
    mobileSetupBack: "Назад",
    mobileScannerTitle: "Сканирование QR",
    mobileScannerLead:
      "Сфотографируйте QR с экрана ПК обычной камерой телефона или выберите фото из галереи.",
    mobileScannerInvalid: "Это не QR переноса Custom SDA",
    mobileScannerOpen: "Сканировать QR",
    mobileScannerTakePhoto: "Сделать фото QR",
    mobileScannerFromPhoto: "Выбрать из галереи",
  },
  en: {
    brand: "Steam Desktop Authenticator",
    unlockTitle: "Unlock",
    createTitle: "Create vault",
    unlockHint: "Enter your encryption password to unlock the local vault.",
    createHint:
      "Account data stays encrypted on this device only. Remember the password — it cannot be recovered.",
    password: "Password",
    passwordRepeat: "Repeat password",
    enter: "Unlock",
    create: "Create",
    loading: "Loading…",
    confirmations: "Confirmations",
    encryption: "Encryption",
    recentEvents: "Recent events",
    noEvents: "No events yet",
    checkUpdates: "Check for updates",
    settings: "Settings",
    accounts: "Accounts",
    home: "Home",
    navLabel: "Navigation",
    noAccount: "No account",
    importMafile: "import a .maFile",
    addAccountHint: "add an account",
    sessionActive: "session active",
    codeOnly: "Guard code only",
    lockVault: "Lock vault",
    lockApp: "Lock application",
    codeCopied: "Code copied",
    copy: "Copy",
    refresh: "Refresh",
    refreshList: "Refresh list",
    confirm: "Accept",
    deny: "Deny",
    addAccount: "Add account",
    pickMafile: "Choose .maFile",
    remove: "Remove",
    cancel: "Cancel",
    back: "Back",
    save: "Save",
    settingsSaved: "Settings saved",
    showPassword: "Show password",
    hidePassword: "Hide password",
    passwordMin6: "Password must be at least 6 characters",
    passwordsMismatch: "Passwords do not match",
    resetAuthenticator: "Reset authenticator",
    wipeTitle: "Reset vault?",
    wipeBody:
      "All accounts, secrets, and the encryption password for this app will be permanently deleted. Steam Guard on your Steam accounts is not removed automatically.",
    wiping: "Deleting…",
    wipeConfirm: "Delete everything",
    noGuardHint: "Add an account to see your Steam Guard code.",
    confirmationsLead: "Requires identity_secret and an active Steam session.",
    noConfirmations: "No pending confirmations",
    keysLead:
      "Import a .maFile or sign in with Steam to add an account to the vault.",
    pasteMafile: "Paste .maFile contents",
    importJson: "Import JSON",
    importing: "Importing…",
    accountList: "Accounts",
    noAccountsYet: "No accounts yet",
    general: "General",
    language: "Language",
    scheme: "Appearance",
    palette: "Palette",
    autoLock: "Auto-lock (sec, 0 = off)",
    encryptionSection: "Encryption",
    encryptionHint:
      "The vault is always encrypted (Argon2id + AES-256-GCM). Data never leaves your PC.",
    currentPassword: "Current password",
    newPassword: "New password",
    changePassword: "Change password",
    onboardTitle: "Add account",
    onboardLead:
      "You have no accounts yet. Import an existing .maFile or sign in with Steam to create an authenticator.",
    useMafiles: "Use maFiles",
    useMafilesHint: "Import an existing .maFile",
    steamLogin: "Sign in to Steam",
    steamLoginHint:
      "Create a maFile via Steam sign-in. Login may ask for an email or app code; linking the authenticator requires a verified phone (SMS).",
    importMafileTitle: "Import maFile",
    orPasteJson: "Or paste JSON",
    importAction: "Import",
    steamSignInTitle: "Steam sign-in",
    steamSignInLead:
      "Sign-in creates a new Steam Guard authenticator and saves the maFile in the encrypted vault.",
    steamUsername: "Steam username",
    steamPassword: "Steam password",
    signingIn: "Signing in…",
    enterSteamLogin: "Enter Steam username",
    enterSteamPassword: "Enter Steam password",
    enterCode: "Enter the code",
    code: "Code",
    revocationCode: "Revocation code",
    setupLeadEmailCode: "Enter the code from the Steam email sent to your address.",
    setupLeadDeviceCode: "Enter the Steam Guard code from the Steam mobile app.",
    setupLeadConfirmMobileOrEmail:
      "Approve sign-in in the Steam app or via email.",
    setupLeadWaitConfirmContinue:
      "Waiting for sign-in approval. After you approve, press Continue.",
    setupLeadSmsLink:
      "Save the revocation code below, then enter the SMS code from your phone.",
    setupLabelSmsLink: "SMS code to link the authenticator",
    setupLeadNoPhone:
      "No phone is linked to this account. Add one in Steam, then press Continue.",
    setupLeadConfirmSteamEmail:
      "Confirm your Steam email, then press Continue.",
    setupLeadTransferSms:
      "An authenticator is already linked. Transfer started — enter the SMS code.",
    setupLabelSmsTransfer: "SMS code to transfer the authenticator",
    submit: "Submit",
    continueAction: "Continue",
    schemeDark: "Dark",
    schemeLight: "Light",
    paletteSteam: "Steam (blue)",
    paletteViolet: "Violet",
    paletteEmerald: "Emerald",
    paletteRose: "Rose",
    paletteAmber: "Amber",
    paletteCyan: "Cyan",
    errBadPassword: "Incorrect password or corrupted vault file",
    errPasswordMin6: "Password must be at least 6 characters",
    errNewPasswordMin6: "New password must be at least 6 characters",
    errVaultNotFound: "Vault not found",
    errVaultExists: "Vault already exists",
    errCrypto: "Encryption error",
    errAccountNotFound: "Account not found",
    errNoAccounts: "No accounts — import a .maFile",
    errNoSteamSession: "No active Steam session",
    errNeedIdentitySecret: "identity_secret is required for confirmations",
    errNoSharedSecret: "shared_secret missing in file",
    errSharedSecretRequired: "shared_secret is required",
    errReadFile: "Could not read file",
    errBadMafileJson: "Invalid .maFile JSON",
    errBadSharedSecret: "Invalid shared_secret",
    errBadCode: "Invalid code",
    errConfirmationsFetch: "Could not fetch confirmations",
    errConfirmAccept: "Could not accept confirmation",
    errConfirmDeny: "Could not deny confirmation",
    errLogin: "Sign-in error",
    errIo: "I/O error",
    errSerde: "Serialization error",
    errSharedSecretB64: "shared_secret is not valid base64",
    mobile: "Phone",
    mobileTransferSendTab: "Send",
    mobileTransferReceiveTab: "Receive",
    mobileTransferTitle: "Transfer account",
    mobileTransferLead:
      "No internet or server: the QR holds an encrypted account. Show it on another device or share it.",
    mobileTransferAccount: "Account to transfer",
    mobileTransferCreate: "Create QR",
    mobileTransferQr: "Transfer QR",
    mobileTransferQrHint:
      "Show this QR on another phone/PC, or tap Share. The confirmation code is required on the receiving device.",
    mobileTransferShare: "Share QR",
    mobileTransferShareOk: "Shared",
    mobileTransferShareCopied: "Link and code copied",
    mobileTransferShareFail: "Could not share",
    mobileTransferCopyDeepLink: "Copy link",
    mobileTransferDeepLinkCopied: "Link copied",
    mobileTransferCodeLabel: "Confirmation code",
    mobileTransferCodeHint:
      "Enter the same code on the receiving device and here to verify.",
    mobileTransferConfirmDesktop: "Verify code on this device",
    mobileTransferConfirmBtn: "Code matches",
    mobileTransferExpired: "QR expired — create a new one",
    mobileTransferExpires: "Valid for",
    mobileTransferCodeOk: "Code matches — finish import on the other device",
    mobileTransferShareText: "Custom SDA — confirmation code",
    errMobileTransferQrTooBig:
      "Could not fit data in a QR — try again or import the .maFile manually",
    mobileTransferReceiveTitle: "Receive account",
    mobileTransferReceiveLead:
      "Take a photo of the QR from another device, or pick a photo from the gallery.",
    mobileTransferReceiveActiveLead: "Enter the code from the sending device and import the account.",
    mobileTransferReceiveCodeHint:
      "The six-digit code is shown under the QR on the device that is sharing.",
    mobileTransferReceiveWaiting:
      "Waiting for QR… On the other device open Send and create a QR.",
    mobileTransferReceiveIdleHint:
      "You can also open the QR link to reach this screen.",
    mobileTransferImportBtn: "Import",
    mobileTransferImportOk: "Account added",
    mobileTransferUnknownAccount: "Account from QR",
    mobileSetupTitle: "Welcome",
    mobileSetupLead: "How do you want to start on this phone?",
    mobileSetupQr: "Import via QR from PC",
    mobileSetupQrHint:
      "On your PC, create a QR under Mobile transfer, then photograph it in the app.",
    mobileSetupFresh: "Set up from scratch",
    mobileSetupFreshHint: "Import a .maFile or sign in with Steam, like on desktop.",
    mobileVaultCreateQr:
      "QR captured. Choose a password to encrypt the account on this phone.",
    mobileVaultCreateFresh:
      "Choose a password for your local encrypted vault.",
    mobileSetupBack: "Back",
    mobileScannerTitle: "Scan QR code",
    mobileScannerLead:
      "Take a photo of the QR on your PC with the phone camera, or pick a photo from the gallery.",
    mobileScannerInvalid: "Not a Custom SDA transfer QR",
    mobileScannerOpen: "Scan QR",
    mobileScannerTakePhoto: "Take QR photo",
    mobileScannerFromPhoto: "Choose photo from gallery",
  },
} as const;

export type I18nKey = keyof (typeof dict)["ru"];

export function parseLang(value?: string | null): Lang {
  return value === "en" ? "en" : "ru";
}

export function loadStoredLang(): Lang {
  try {
    const raw = localStorage.getItem(LANG_STORAGE_KEY);
    if (raw === "en" || raw === "ru") {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return "ru";
}

export function persistLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = lang;
}

export function t(lang: Lang, key: I18nKey): string {
  return dict[lang][key] ?? dict.ru[key];
}

const PALETTE_KEYS: Record<ColorPalette, I18nKey> = {
  steam: "paletteSteam",
  violet: "paletteViolet",
  emerald: "paletteEmerald",
  rose: "paletteRose",
  amber: "paletteAmber",
  cyan: "paletteCyan",
};

const SCHEME_KEYS: Record<ColorScheme, I18nKey> = {
  dark: "schemeDark",
  light: "schemeLight",
};

export function paletteLabel(lang: Lang, palette: ColorPalette): string {
  return t(lang, PALETTE_KEYS[palette]);
}

export function schemeLabel(lang: Lang, scheme: ColorScheme): string {
  return t(lang, SCHEME_KEYS[scheme]);
}

const BACKEND_ERROR_KEYS: Record<string, I18nKey> = {
  "неверный пароль или повреждённый файл": "errBadPassword",
  "пароль должен быть не короче 6 символов": "errPasswordMin6",
  "новый пароль должен быть не короче 6 символов": "errNewPasswordMin6",
  "хранилище не найдено": "errVaultNotFound",
  "хранилище уже существует": "errVaultExists",
  "ошибка шифрования": "errCrypto",
  "аккаунт не найден": "errAccountNotFound",
  "нет аккаунтов — импортируйте .maFile": "errNoAccounts",
  "нет активной Steam-сессии": "errNoSteamSession",
  "для подтверждений нужен identity_secret": "errNeedIdentitySecret",
  "в файле нет shared_secret": "errNoSharedSecret",
  "shared_secret обязателен": "errSharedSecretRequired",
  "данные аккаунта слишком большие для одного QR — сессия Steam не переносится; если ошибка повторяется, экспортируйте maFile вручную":
    "errMobileTransferQrTooBig",
};

const BACKEND_ERROR_PREFIXES: { prefix: string; key: I18nKey }[] = [
  { prefix: "не удалось прочитать файл:", key: "errReadFile" },
  { prefix: "неверный JSON .maFile:", key: "errBadMafileJson" },
  { prefix: "неверный shared_secret:", key: "errBadSharedSecret" },
  { prefix: "неверный код:", key: "errBadCode" },
  { prefix: "не удалось получить подтверждения:", key: "errConfirmationsFetch" },
  { prefix: "не удалось подтвердить:", key: "errConfirmAccept" },
  { prefix: "не удалось отклонить:", key: "errConfirmDeny" },
  { prefix: "ошибка входа:", key: "errLogin" },
  { prefix: "ошибка ввода-вывода:", key: "errIo" },
  { prefix: "ошибка сериализации:", key: "errSerde" },
  { prefix: "shared_secret не base64:", key: "errSharedSecretB64" },
];

function appendDetail(base: string, raw: string, prefix: string) {
  const detail = raw.slice(prefix.length).trim();
  return detail ? `${base}: ${detail}` : base;
}

/** Переводит известные сообщения об ошибках с бэкенда (они на русском). */
export function localizeErrorMessage(message: string, lang: Lang): string {
  const raw = message.trim();
  if (lang === "ru") {
    return raw;
  }
  const exact = BACKEND_ERROR_KEYS[raw];
  if (exact) {
    return t(lang, exact);
  }
  for (const { prefix, key } of BACKEND_ERROR_PREFIXES) {
    if (raw.toLowerCase().startsWith(prefix)) {
      return appendDetail(t(lang, key), raw, prefix);
    }
  }
  return raw;
}
