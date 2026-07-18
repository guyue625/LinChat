"use client";

import clsx from "clsx";

/** A single LinChat mark is used in every theme and surface. */
export function BrandLogo(props: {
  className?: string;
  width?: number | string;
  height?: number | string;
  alt?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt={props.alt ?? "LinChat"}
      width={props.width ?? 44}
      height={props.height ?? props.width ?? 44}
      className={clsx("no-dark", props.className)}
      draggable={false}
      style={{ objectFit: "contain", display: "block" }}
    />
  );
}
