"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#030305] px-6 text-white">
      <section className="max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 text-center shadow-2xl shadow-black/50 backdrop-blur-xl">
        <p className="text-sm uppercase tracking-[0.3em] text-white/40">Temporary data wobble</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">The football internet just took a heavy touch.</h1>
        <p className="mt-4 text-white/60">
          ESPN data did not load cleanly for this refresh. Give it another go — the app is designed to recover on the next request.
        </p>
        <p className="mt-3 text-xs text-white/30">{error.message}</p>
        <button
          className="mt-8 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/85"
          onClick={() => reset()}
        >
          Try again
        </button>
      </section>
    </main>
  );
}
