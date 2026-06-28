import { describe, it, expectTypeOf } from 'vitest'
import type { SessionUser, AccountTier, UserRole, ApiResponse } from '@/types'

describe('shared types', () => {
  it('AccountTier is free | premium', () => {
    expectTypeOf<AccountTier>().toEqualTypeOf<'free' | 'premium'>()
  })

  it('UserRole is user | admin', () => {
    expectTypeOf<UserRole>().toEqualTypeOf<'user' | 'admin'>()
  })

  it('SessionUser has id, tier, role', () => {
    expectTypeOf<SessionUser>().toHaveProperty('id')
    expectTypeOf<SessionUser>().toHaveProperty('tier')
    expectTypeOf<SessionUser>().toHaveProperty('role')
  })

  it('ApiResponse has success, data, error', () => {
    expectTypeOf<ApiResponse<string>>().toHaveProperty('success')
    expectTypeOf<ApiResponse<string>>().toHaveProperty('data')
    expectTypeOf<ApiResponse<string>>().toHaveProperty('error')
  })
})
