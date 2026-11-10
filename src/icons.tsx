import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRightToBracket,
  faArrowsRotate,
  faCopy,
  faEye,
  faEyeSlash,
  faFileImport,
  faFingerprint,
  faGear,
  faHouse,
  faKey,
  faLock,
  faMobileScreen,
  faShieldHalved,
} from "@fortawesome/free-solid-svg-icons";

export function AppBrandIcon({ size = 24 }: { size?: number }) {
  return (
    <img
      className="app-brand-icon"
      src="/icon.png"
      width={size}
      height={size}
      alt=""
      draggable={false}
    />
  );
}

export function SteamLogo({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M1.92725 15.0202C3.22531 19.3473 7.24067 22.5 11.9929 22.5C17.7955 22.5 22.4996 17.7989 22.4996 12C22.4996 6.20102 17.7955 1.5 11.9929 1.5C6.42475 1.5 1.86863 5.82879 1.50879 11.3024C1.50879 12.875 1.50879 13.5313 1.92725 15.0202Z"
        fill="url(#paint0_linear_steam)"
      />
      <path
        d="M11.453 9.42217L8.88197 13.1546C8.27589 13.1271 7.66577 13.2985 7.15931 13.6314L1.51374 11.3088C1.51374 11.3088 1.3831 13.4566 1.92751 15.0572L5.91862 16.703C6.11901 17.598 6.73336 18.383 7.63974 18.7607C9.12264 19.3799 10.8325 18.6741 11.4494 17.1915C11.6099 16.8039 11.6848 16.3975 11.6739 15.9919L15.4428 13.3664C17.6443 13.3664 19.4336 11.5729 19.4336 9.37028C19.4336 7.16755 17.6443 5.37561 15.4428 5.37561C13.3165 5.37561 11.3338 7.23095 11.453 9.42217ZM10.8352 16.9337C10.3577 18.0793 9.04052 18.6227 7.89549 18.1459C7.36728 17.926 6.96848 17.5231 6.73841 17.0428L8.03754 17.5808C8.88197 17.9323 9.85074 17.5322 10.2017 16.6885C10.5539 15.8441 10.1544 14.8743 9.31044 14.5228L7.96749 13.9667C8.48567 13.7702 9.07479 13.763 9.62522 13.9919C10.1801 14.2226 10.6106 14.6571 10.8388 15.2123C11.067 15.7675 11.0661 16.3803 10.8352 16.9337ZM15.4428 12.0325C13.9773 12.0325 12.7841 10.8383 12.7841 9.37028C12.7841 7.90343 13.9773 6.70889 15.4428 6.70889C16.9093 6.70889 18.1024 7.90343 18.1024 9.37028C18.1024 10.8383 16.9093 12.0325 15.4428 12.0325ZM13.4506 9.36623C13.4506 8.26193 14.3453 7.36619 15.4473 7.36619C16.5503 7.36619 17.4449 8.26193 17.4449 9.36623C17.4449 10.4707 16.5503 11.3656 15.4473 11.3656C14.3453 11.3656 13.4506 10.4707 13.4506 9.36623Z"
        fill="white"
      />
      <defs>
        <linearGradient
          id="paint0_linear_steam"
          x1="12.0042"
          y1="1.5"
          x2="12.0042"
          y2="22.5"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#111D2E" />
          <stop offset="0.21248" stopColor="#051839" />
          <stop offset="0.40695" stopColor="#0A1B48" />
          <stop offset="0.5811" stopColor="#132E62" />
          <stop offset="0.7376" stopColor="#144B7E" />
          <stop offset="0.87279" stopColor="#136497" />
          <stop offset="1" stopColor="#1387B8" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export const IconHome = () => <FontAwesomeIcon icon={faHouse} />;
export const IconKey = () => <FontAwesomeIcon icon={faKey} />;
export const IconShield = () => <FontAwesomeIcon icon={faShieldHalved} />;
export const IconGear = () => <FontAwesomeIcon icon={faGear} />;
export const IconCopy = () => <FontAwesomeIcon icon={faCopy} />;
export const IconRefresh = () => <FontAwesomeIcon icon={faArrowsRotate} />;
export const IconEye = () => <FontAwesomeIcon icon={faEye} />;
export const IconEyeSlash = () => <FontAwesomeIcon icon={faEyeSlash} />;
export const IconLock = () => <FontAwesomeIcon icon={faLock} />;
export const IconMobile = () => <FontAwesomeIcon icon={faMobileScreen} />;
export const IconFingerprint = () => <FontAwesomeIcon icon={faFingerprint} />;
export const IconImport = () => <FontAwesomeIcon icon={faFileImport} />;
export const IconLogin = () => <FontAwesomeIcon icon={faArrowRightToBracket} />;

export function IconEventSuccess({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M18.3334 10C18.3334 14.6024 14.6024 18.3333 10 18.3333C5.39765 18.3333 1.66669 14.6024 1.66669 10C1.66669 5.39763 5.39765 1.66667 10 1.66667C14.6024 1.66667 18.3334 5.39763 18.3334 10ZM13.3586 7.47473C13.6027 7.71881 13.6027 8.11454 13.3586 8.35861L9.19196 12.5253C8.94788 12.7694 8.55216 12.7694 8.30808 12.5253L6.64141 10.8586C6.39733 10.6145 6.39733 10.2188 6.64141 9.97473C6.88549 9.73065 7.28122 9.73065 7.5253 9.97473L8.75002 11.1995L10.6124 9.33709L12.4747 7.47473C12.7188 7.23065 13.1146 7.23065 13.3586 7.47473Z"
        fill="#28FB28"
      />
    </svg>
  );
}

export function IconEventFailure({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M18.3334 10C18.3334 14.6024 14.6024 18.3333 10 18.3333C5.39765 18.3333 1.66669 14.6024 1.66669 10C1.66669 5.39763 5.39765 1.66667 10 1.66667C14.6024 1.66667 18.3334 5.39763 18.3334 10ZM7.47473 7.47473C7.71881 7.23065 8.11454 7.23065 8.35861 7.47473L10 9.11612L11.6414 7.47473C11.8855 7.23065 12.2812 7.23065 12.5253 7.47473C12.7694 7.71881 12.7694 8.11454 12.5253 8.35861L10.8839 10L12.5253 11.6414C12.7694 11.8855 12.7694 12.2812 12.5253 12.5253C12.2812 12.7694 11.8855 12.7694 11.6414 12.5253L10 10.8839L8.35861 12.5253C8.11454 12.7694 7.71881 12.7694 7.47473 12.5253C7.23065 12.2812 7.23065 11.8855 7.47473 11.6414L9.11612 10L7.47473 8.35861C7.23065 8.11454 7.23065 7.71881 7.47473 7.47473Z"
        fill="#FB4B4B"
      />
    </svg>
  );
}

/** Event list status icon — green/red rounded square (same for every event type). */
export function EventStatusMark({ success }: { success: boolean }) {
  return (
    <div
      className={`event-icon ${success ? "event-icon--ok" : "event-icon--bad"}`}
      aria-hidden="true"
    >
      {success ? <IconEventSuccess /> : <IconEventFailure />}
    </div>
  );
}

export function IconChevronDown({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M19 9L12 15L5 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
