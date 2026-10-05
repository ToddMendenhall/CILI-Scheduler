import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrimaryOrgMembership } from "@/lib/org";

// Serves the single-file scheduler — the same file the desktop app ships
// (desktop/app/index.html) — with the server storage bridge loaded ahead of
// its own script, so it saves to this org's row in Postgres instead of the
// browser or a data file. /dashboard shows it in a frame under the app header.
// next.config.js traces the HTML file into this route's serverless bundle.

const SCHEDULER_FILE = path.join(process.cwd(), "desktop", "app", "index.html");
const BRIDGE_TAG = '<script src="/scheduler/server-store.js"></script>';

let cached: string | null = null;

async function schedulerHtml() {
  // Re-read on every request in dev so edits to the file show on reload.
  if (cached && process.env.NODE_ENV === "production") return cached;
  const html = await readFile(SCHEDULER_FILE, "utf8");
  if (!html.includes("</head>")) throw new Error("scheduler HTML has no </head> to load the storage bridge into");
  cached = html.replace("</head>", BRIDGE_TAG + "</head>");
  return cached;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login?callbackUrl=%2Fdashboard", request.url));
  }
  if (!(await getPrimaryOrgMembership(session.user.id))) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return new NextResponse(await schedulerHtml(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      // Only this app may frame it.
      "Content-Security-Policy": "frame-ancestors 'self'",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
