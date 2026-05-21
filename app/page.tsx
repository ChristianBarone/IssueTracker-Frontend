export default function Home() {
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,rgba(47,147,184,0.12),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(93,197,181,0.10),transparent_24%),linear-gradient(180deg,#f6f9fc_0%,#eef4f8_100%)] px-4 text-slate-700">
      <div className="max-w-xl rounded-3xl border border-slate-200/80 bg-white/80 px-8 py-10 text-center shadow-[0_20px_50px_rgba(15,23,42,0.1)] backdrop-blur">
        <div className="inline-flex rounded-full border border-[#2f93b8]/20 bg-[#2f93b8]/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-[#2f93b8]">
          Issue Tracker
        </div>
        <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-900">
          Pick a user to start working.
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          The login gate appears before any issue routes load, so the selected user is available throughout the app.
        </p>
      </div>
    </main>
  );
}
