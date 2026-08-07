import { ModelProvider } from "@/app/constant";
import { prettyObject } from "@/app/utils/format";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "./auth";
import { requestOpenai } from "./common";
import { getRuntimeServerSideConfig } from "@/app/lib/provider-config/runtime";

export async function handle(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  console.log("[Azure Route] params ", params);

  if (req.method === "OPTIONS") {
    return NextResponse.json({ body: "OK" }, { status: 200 });
  }

  const subpath = params.path.join("/");

  const serverConfig = await getRuntimeServerSideConfig();
  const authResult = await auth(req, ModelProvider.GPT, serverConfig);
  if (authResult.error) {
    return NextResponse.json(authResult, {
      status: authResult.status ?? 401,
    });
  }

  try {
    return await requestOpenai(req, serverConfig);
  } catch (e) {
    console.error("[Azure] ", e);
    return NextResponse.json(prettyObject(e));
  }
}
