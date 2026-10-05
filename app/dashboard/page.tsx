// The scheduler itself, served by app/scheduler/route.ts. It's framed rather
// than rendered as React because phase 1 runs the existing single-file app
// unchanged; later phases replace it view by view with React pages.
export default function SchedulePage() {
  return <iframe src="/scheduler" title="CILI Scheduler" className="h-full w-full flex-1 border-0" />;
}
