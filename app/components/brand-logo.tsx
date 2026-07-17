"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

/**
 * LinChat brand logo — only two assets:
 * - /logo-dark.png  : dark-colored mark for light backgrounds
 * - /logo-light.png : light-colored mark for dark backgrounds
 *
 * Theme is resolved from document.body class / system preference,
 * intentionally NOT via useAppConfig to avoid circular store init
 * (home → BrandLogo → config store → chat/mask → useAppConfig TDZ).
 *
 * variant:
 * - "auto"  → follow app/body theme (default)
 * - "dark"  → always /logo-dark.png
 * - "light" → always /logo-light.png
 */
export function BrandLogo(props: {
  className?: string;
  width?: number | string;
  height?: number | string;
  alt?: string;
  variant?: "auto" | "light" | "dark";
}) {
  const [preferDarkUi, setPreferDarkUi] = useState(false);

  useEffect(() => {
    if (props.variant && props.variant !== "auto") return;

    const resolve = () => {
      const body = document.body;
      if (body.classList.contains("dark")) {
        setPreferDarkUi(true);
        return;
      }
      if (body.classList.contains("light")) {
        setPreferDarkUi(false);
        return;
      }
      setPreferDarkUi(
        window.matchMedia("(prefers-color-scheme: dark)").matches,
      );
    };

    resolve();

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onMq = () => resolve();
    mq.addEventListener("change", onMq);

    // Observe body class changes when user switches theme in settings
    const observer = new MutationObserver(resolve);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      mq.removeEventListener("change", onMq);
      observer.disconnect();
    };
  }, [props.variant]);

  // Dark UI → light logo; Light UI → dark logo
  let src = "/logo-dark.png";
  if (props.variant === "light") {
    src = "/logo-light.png";
  } else if (props.variant === "dark") {
    src = "/logo-dark.png";
  } else {
    src = preferDarkUi ? "/logo-light.png" : "/logo-dark.png";
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={props.alt ?? "LinChat"}
      width={props.width ?? 44}
      height={props.height ?? 47}
      className={clsx("no-dark", props.className)}
      draggable={false}
      style={{ objectFit: "contain", display: "block" }}
    />
  );
}
