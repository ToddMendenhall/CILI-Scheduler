import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrimaryOrgMembership } from "@/lib/org";

// Serves the single-file scheduler (scheduler/index.html), which loads and
// saves the org's schedule through /api/schedule. /dashboard shows it in a
// frame under the app header. next.config.js traces the HTML file into this
// route's serverless bundle.

const SCHEDULER_FILE = path.join(process.cwd(), "scheduler", "index.html");

let cached: string | null = null;

async function schedulerHtml() {
  // Re-read on every request in dev so edits to the file show on reload.
  if (cached && process.env.NODE_ENV === "production") return cached;
  cached = await readFile(SCHEDULER_FILE, "utf8");
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
