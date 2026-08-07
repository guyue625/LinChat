import { NextRequest, NextResponse } from "next/server";
import { AccountAuthError } from "@/app/lib/account-auth";
import {
  getAccountAuthService,
  isAccountAuthEnabled,
} from "@/app/lib/account-auth-server";
import {
  CorruptSyncSnapshotError,
  InvalidSyncStateError,
  SyncConflictError,
} from "@/app/lib/account-sync/repository";
import { getAccountSyncRepository } from "@/app/lib/account-sync/server";
import {
  MAX_ACCOUNT_SYNC_BYTES,
  validateSyncState,
} from "@/app/lib/account-sync/state";
import {
  ACCOUNT_SESSION_COOKIE,
  accountErrorResponse,
} from "../account/_shared";
import {
  readRequestBodyWithLimit,
  SyncPayloadTooLargeError,
} from "./read-body";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function requireCurrentUser(request: NextRequest) {
  if (!isAccountAuthEnabled()) {
    throw new AccountAuthError(
      "ACCOUNT_AUTH_DISABLED",
      "账号登录功能未启用",
      503,
    );
  }
  const service = await getAccountAuthService();
  const token = request.cookies.get(ACCOUNT_SESSION_COOKIE)?.value ?? "";
  const user = await service.getUserBySession(token);
  if (!user) {
    throw new AccountAuthError("UNAUTHORIZED", "请先登录", 401);
  }
  return user;
}

function noStore(response: NextResponse) {
  response.headers.set("cache-control", "private, no-store");
  return response;
}

function syncErrorResponse(error: unknown) {
  if (error instanceof SyncPayloadTooLargeError) {
    return noStore(
      NextResponse.json(
        {
          error: "同步数据超出大小限制，请减少聊天记录中的大文件",
          code: "SYNC_PAYLOAD_TOO_LARGE",
        },
        { status: 413 },
      ),
    );
  }
  if (error instanceof SyncConflictError) {
    const current = error.current;
    return noStore(
      NextResponse.json(
        {
          code: "SYNC_CONFLICT",
          state: current?.state ?? null,
          revision: current?.revision ?? 0,
          updatedAt: current?.updatedAt ?? null,
        },
        { status: 409 },
      ),
    );
  }
  if (error instanceof InvalidSyncStateError) {
    return noStore(
      NextResponse.json(
        { error: error.message, code: "INVALID_SYNC_PAYLOAD" },
        { status: 400 },
      ),
    );
  }
  if (error instanceof AccountAuthError) {
    return noStore(accountErrorResponse(error));
  }
  if (!(error instanceof CorruptSyncSnapshotError)) {
    console.error("[AccountSync]", error);
  }
  return noStore(
    NextResponse.json(
      { error: "账号同步服务暂时不可用", code: "SYNC_SERVICE_UNAVAILABLE" },
      { status: 503 },
    ),
  );
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const repository = await getAccountSyncRepository();
    const snapshot = await repository.readWithLegacyMigration(user.id);
    return noStore(
      NextResponse.json(
        snapshot ?? { state: null, revision: 0, updatedAt: null },
      ),
    );
  } catch (error) {
    return syncErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    const revisionHeader = request.headers.get("x-sync-revision");
    if (!revisionHeader || !/^\d+$/.test(revisionHeader)) {
      throw new AccountAuthError(
        "INVALID_SYNC_REVISION",
        "同步版本格式错误",
        400,
      );
    }
    const expectedRevision = Number(revisionHeader);
    if (!Number.isSafeInteger(expectedRevision)) {
      throw new AccountAuthError(
        "INVALID_SYNC_REVISION",
        "同步版本格式错误",
        400,
      );
    }

    const rawBody = await readRequestBodyWithLimit(
      request,
      MAX_ACCOUNT_SYNC_BYTES,
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      throw new AccountAuthError(
        "INVALID_SYNC_PAYLOAD",
        "同步数据格式错误",
        400,
      );
    }
    const validation = validateSyncState(parsed);
    if (!validation.ok) {
      throw new AccountAuthError(
        "INVALID_SYNC_PAYLOAD",
        validation.reason,
        400,
      );
    }

    const repository = await getAccountSyncRepository();
    const snapshot = repository.write(
      user.id,
      validation.state,
      expectedRevision,
    );
    return noStore(
      NextResponse.json({
        ok: true,
        revision: snapshot.revision,
        updatedAt: snapshot.updatedAt,
      }),
    );
  } catch (error) {
    return syncErrorResponse(error);
  }
}
