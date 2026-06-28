import NextAuth from 'next-auth'
import PostgresAdapter from '@auth/pg-adapter'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { getPool } from '@/lib/db/pool'
import type { SessionUser, AccountTier, UserRole } from '@/types'

declare module 'next-auth' {
  interface Session {
    user: SessionUser
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PostgresAdapter(getPool()),
  providers: [
    Google({
      clientId: process.env['GOOGLE_CLIENT_ID']!,
      clientSecret: process.env['GOOGLE_CLIENT_SECRET']!,
    }),
    Credentials({
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const { rows } = await getPool().query(
          `SELECT id, email, name, image, password_hash, tier, role, deleted_at
           FROM users WHERE email = $1`,
          [credentials.email as string]
        )

        const user = rows[0] as {
          id: string
          email: string
          name: string | null
          image: string | null
          password_hash: string | null
          tier: string
          role: string
          deleted_at: Date | null
        } | undefined

        if (!user || !user.password_hash || user.deleted_at) return null

        const valid = await compare(credentials.password as string, user.password_hash)
        if (!valid) return null

        return { id: user.id, email: user.email, name: user.name, image: user.image }
      },
    }),
  ],
  callbacks: {
    session({ session, user }) {
      const dbUser = user as typeof user & {
        tier?: string
        role?: string
        deleted_at?: Date | null
      }
      if (dbUser.deleted_at) throw new Error('Account deleted')
      session.user.id   = dbUser.id
      session.user.tier = (dbUser.tier ?? 'free') as AccountTier
      session.user.role = (dbUser.role ?? 'user') as UserRole
      return session
    },
  },
  pages: { signIn: '/login', newUser: '/onboarding' },
})
