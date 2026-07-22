/** @jest-environment node */

import type { NextRequest, NextResponse } from "next/server";
import { jest } from "@jest/globals";

import { setSessionCookie } from "./_shared";

describe("account session cookie transport security", () => {
  function cookieFor(request: NextRequest) {
    const set = jest.fn();
    const response = { cookies: { set } } as unknown as NextResponse;
    setSessionCookie(response, "session-token", request);
    return set.mock.calls[0]?.[2] as { secure?: boolean };
  }

  test("does not mark a plain HTTP session cookie as Secure in production", () => {
    const cookie = cookieFor({
      nextUrl: { protocol: "http:" },
      headers: new Headers(),
    } as unknown as NextRequest);

    expect(cookie.secure).toBe(false);
  });

  test("marks an HTTPS session cookie as Secure in production", () => {
    const cookie = cookieFor({
      nextUrl: { protocol: "https:" },
      headers: new Headers(),
    } as unknown as NextRequest);

    expect(cookie.secure).toBe(true);
  });

  test("recognizes HTTPS terminated by a reverse proxy", () => {
    const cookie = cookieFor({
      nextUrl: { protocol: "http:" },
      headers: new Headers({ "x-forwarded-proto": "https" }),
    } as unknown as NextRequest);

    expect(cookie.secure).toBe(true);
  });
});
