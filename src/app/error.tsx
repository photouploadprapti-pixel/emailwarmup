'use client'

import { AppShell } from '@/components/app-shell'

type ErrorPageProps = {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Visible fallback when a server render fails.
 */
export const ErrorPage = ({ reset }: ErrorPageProps) => {
  return (
    <AppShell>
      <section className="rounded-[2rem] border border-white/5 bg-ink-900/70 px-8 py-16 text-center">
        <h1 className="font-display text-4xl text-parchment-50">Something went wrong.</h1>
        <p className="mt-3 text-parchment-400">
          Try again. If this is a fresh Vercel deploy, wait a few seconds and refresh.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 inline-flex rounded-full bg-ember-500 px-5 py-2.5 text-sm font-medium text-ink-950"
        >
          Try again
        </button>
      </section>
    </AppShell>
  )
}

export default ErrorPage
