import { createHash } from "crypto";
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

let cached: { html: string; policy: string } | null = null;

// The page's own inline script, and nothing else, may run: the policy names it by
// its SHA-256 hash, worked out from the file as served. So text drawn into the page
// as markup by mistake (a stored script in a job name, say) could not run, and the
// page cannot send data anywhere but this app. It needs no inline event handlers,
// eval or outside scripts; its styles are inline, and its typeface comes from Google.
function policyFor(html: string) {
  const hashes: string[] = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (/\bsrc\s*=/i.test(m[1])) continue;
    // browsers hash the script as parsed, with CRLF line endings (a Windows checkout) already made LF
    const text = m[2].replace(/\r\n?/g, "\n");
    hashes.push(`'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`);
  }
  return [
    "default-src 'self'",
    `script-src ${hashes.join(" ") || "'none'"}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; ");
}

async function scheduler() {
  // Re-read on every request in dev so edits to the file show on reload.
  if (cached && process.env.NODE_ENV === "production") return cached;
  const html = await readFile(SCHEDULER_FILE, "utf8");
  cached = { html, policy: policyFor(html) };
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

  const page = await scheduler();
  return new NextResponse(page.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      // Only this app may frame it, and only the page's own script may run in it.
      "Content-Security-Policy": page.policy,
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
