import Link from 'next/link'
import { Flame } from 'lucide-react'

type AppShellProps = {
  children: React.ReactNode
  action?: React.ReactNode
}

/**
 * Shared page chrome with the Hearth wordmark.
 */
export const AppShell = ({ children, action }: AppShellProps) => {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="group flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ember-500/15 text-ember-400 shadow-glow">
            <Flame className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-display text-2xl leading-none text-parchment-50">
              Hearth
            </span>
            <span className="block text-xs tracking-[0.18em] text-parchment-500 uppercase">
              Email warmup
            </span>
          </span>
        </Link>
        {action}
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 pb-16">{children}</main>
    </div>
  )
}
