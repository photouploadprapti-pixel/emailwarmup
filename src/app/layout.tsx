import type { Metadata } from 'next'
import { Newsreader, Outfit } from 'next/font/google'

import './globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
})

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-newsreader',
})

export const metadata: Metadata = {
  title: 'Hearth — Email warmup',
  description: 'Add your mailboxes and let Hearth warm them in the background.',
}

type RootLayoutProps = {
  children: React.ReactNode
}

/**
 * Root document shell with display fonts and global styles.
 */
const RootLayout = ({ children }: RootLayoutProps) => {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${newsreader.variable} font-sans text-parchment-100 antialiased`}>
        {children}
      </body>
    </html>
  )
}

export default RootLayout
