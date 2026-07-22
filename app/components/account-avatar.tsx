import { useEffect, useState } from "react";
import clsx from "clsx";
import { accountInitial } from "./account-utils";
import styles from "./account-avatar.module.scss";

export function AccountAvatar(props: {
  avatar?: string;
  name: string;
  size?: number;
  className?: string;
}) {
  const { avatar, className, name, size = 40 } = props;
  const [failed, setFailed] = useState(false);
  const initialSize = Math.max(12, Math.round(size * 0.38));

  useEffect(() => setFailed(false), [avatar]);

  return (
    <span
      className={clsx(styles.avatar, className)}
      style={
        {
          width: size,
          height: size,
          "--avatar-font-size": `${initialSize}px`,
        } as React.CSSProperties
      }
      aria-hidden="true"
    >
      {avatar && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- user avatars can be arbitrary remote or data URLs.
        <img
          src={avatar}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{accountInitial(name)}</span>
      )}
    </span>
  );
}
