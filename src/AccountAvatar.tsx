import { useEffect, useState } from "react";

function normalizeAvatarSrc(url: string | null | undefined): string | null {
  const raw = url?.trim();
  if (!raw) {
    return null;
  }
  if (raw.startsWith("http://")) {
    return `https://${raw.slice("http://".length)}`;
  }
  return raw;
}

export function AccountAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const [broken, setBroken] = useState(false);
  const src = normalizeAvatarSrc(avatarUrl);
  useEffect(() => {
    setBroken(false);
  }, [src]);
  return (
    <div className="avatar">
      {src && !broken ? (
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : (
        (name[0] ?? "?").toUpperCase()
      )}
    </div>
  );
}
