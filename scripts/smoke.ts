/**
 * Authenticated smoke test with privacy leak detection
 * Tests: sign in, profile upsert, listing CRUD, RLS privacy
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database.generated'

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
const testEmail = process.env.TEST_USER_EMAIL
const testPassword = process.env.TEST_USER_PASSWORD

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

if (!testEmail || !testPassword) {
  console.error('❌ Missing TEST_USER_EMAIL or TEST_USER_PASSWORD')
  process.exit(1)
}

const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

async function runSmokeTests() {
  console.log('🧪 Running authenticated smoke tests...\n')
  let passed = 0
  let failed = 0

  let userId: string | undefined
  let testListingId: string | undefined
  let authed: ReturnType<typeof createClient<Database>>
  let profilesClient: ReturnType<typeof createClient<Database>>

  // Test 1: Sign in with password
  console.log('1️⃣  Testing sign in...')
  try {
    const signIn = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    })

    if (signIn.error) throw signIn.error
    const session = signIn.data.session
    if (!session) throw new Error('No session')

    // Create authenticated client with hard-set Authorization header
    authed = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${session.access_token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    })

    // Create profiles client with Prefer: return=minimal for upsert
    profilesClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      global: { headers: {
        Authorization: `Bearer ${session.access_token}`,
        Prefer: 'return=minimal'
      } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    })

    userId = signIn.data.user.id
    console.log(`   ✅ Sign in successful (${userId.substring(0, 8)}...)`)
    passed++
  } catch (error: any) {
    console.log(`   ❌ Sign in failed: ${error.message}`)
    failed++
    console.log('\n' + '='.repeat(50))
    console.log(`📊 Smoke Test Results: ${passed} passed, ${failed} failed`)
    console.log('='.repeat(50))
    console.log('\n❌ Tests failed - cannot proceed without authentication')
    process.exit(1)
  }

  // Test 2: Upsert own profile
  console.log('\n2️⃣  Testing profile upsert...')
  try {
    // Write to profiles (no select)
    const { error: upsertError } = await profilesClient
      .from('profiles')
      .upsert(
        { id: userId!, name: 'Smoke Test User', updated_at: new Date().toISOString() },
        { onConflict: 'id', returning: 'minimal' }
      )

    if (upsertError) throw upsertError

    // Verify by reading from profiles_public
    const { data, error: readError } = await authed
      .from('profiles_public')
      .select('*')
      .eq('id', userId!)
      .single()

    if (readError) throw readError
    if (!data) throw new Error('Profile not found in profiles_public')
    if ('email' in data) throw new Error('Email should not be in profiles_public')

    console.log(`   ✅ Profile upsert successful (verified via profiles_public)`)
    passed++
  } catch (error: any) {
    console.log(`   ❌ Profile upsert failed: ${error.message}`)
    failed++
  }

  // Test 3: Create temporary listing
  console.log('\n3️⃣  Testing listing create...')
  try {
    const { data, error } = await authed
      .from('listings')
      .insert({
        user_id: userId!,
        mode: 'vault',
        price_cents: 2500,
        topic: 'Smoke Test Listing',
        description: 'Temporary test listing',
        is_active: false // Inactive so it doesn't show in production
      })
      .select()
      .single()

    if (error) throw error
    testListingId = data.id
    console.log(`   ✅ Listing created (${testListingId.substring(0, 8)}...)`)
    passed++
  } catch (error: any) {
    console.log(`   ❌ Listing create failed: ${error.message}`)
    failed++
  }

  // Test 4: Read back the listing
  console.log('\n4️⃣  Testing listing read...')
  try {
    const { data, error } = await authed
      .from('listings')
      .select('id, user_id, mode, price_cents')
      .eq('id', testListingId!)
      .single()

    if (error) throw error
    if (data.user_id !== userId) {
      throw new Error(`User ID mismatch: expected ${userId}, got ${data.user_id}`)
    }
    console.log(`   ✅ Listing read successful`)
    passed++
  } catch (error: any) {
    console.log(`   ❌ Listing read failed: ${error.message}`)
    failed++
  }

  // Test 5: Read giver_availability (if any exist)
  console.log('\n5️⃣  Testing giver_availability read...')
  try {
    const { data, error } = await authed
      .from('giver_availability')
      .select('id, giver_id, date, time')
      .eq('giver_id', userId!)
      .limit(1)

    if (error) throw error
    if (data && data.length > 0) {
      console.log(`   ✅ Giver availability read successful (${data.length} slots)`)
    } else {
      console.log(`   ✅ Giver availability query succeeded (no slots for this user)`)
    }
    passed++
  } catch (error: any) {
    console.log(`   ❌ Giver availability read failed: ${error.message}`)
    failed++
  }

  // Test 6A: PRIVACY TEST - profiles.email should not be readable
  console.log('\n6️⃣A Testing privacy: profiles.email should not be readable...')
  try {
    const { data, error } = await authed
      .from('profiles')
      .select('id, email')
      .limit(1)

    // If we got here without error, that's BAD - email should not be readable
    if (!error) {
      console.log(`   ❌ PRIVACY LEAK: profiles.email is readable! Found ${data?.length || 0} rows`)
      console.log(`      This is a security issue - email should not be exposed to client roles`)
      failed++
    } else {
      // Error is expected - email column should be blocked
      console.log(`   ✅ Privacy protected: email column blocked (${error.message})`)
      passed++
    }
  } catch (error: any) {
    // Exception is also acceptable - means query was blocked
    console.log(`   ✅ Privacy protected: email access blocked (${error.message})`)
    passed++
  }

  // Test 6B: PRIVACY TEST - profiles_public view should not have email column
  console.log('\n6️⃣B Testing privacy: profiles_public should not expose email...')
  try {
    const { data, error } = await authed
      .from('profiles_public')
      .select('*')
      .limit(1)
      .single()

    if (error) throw error

    // Check that email column does NOT exist in the returned data
    if (data && 'email' in data) {
      console.log(`   ❌ PRIVACY LEAK: profiles_public exposes email column!`)
      console.log(`      This is a security issue - email should not be in the public view`)
      failed++
    } else {
      console.log(`   ✅ Privacy protected: email column not present in profiles_public`)
      passed++
    }
  } catch (error: any) {
    console.log(`   ❌ Privacy test failed: ${error.message}`)
    failed++
  }

  // Cleanup: Delete test listing
  console.log('\n7️⃣  Cleaning up test listing...')
  try {
    if (testListingId) {
      const { error } = await authed
        .from('listings')
        .delete()
        .eq('id', testListingId)

      if (error) throw error
      console.log(`   ✅ Test listing deleted`)
      passed++
    } else {
      console.log(`   ⚠️  No test listing to clean up`)
    }
  } catch (error: any) {
    console.log(`   ⚠️  Cleanup failed (non-critical): ${error.message}`)
    // Don't count cleanup failures
  }

  // Summary
  console.log('\n' + '='.repeat(50))
  console.log(`📊 Smoke Test Results: ${passed} passed, ${failed} failed`)
  console.log('='.repeat(50))

  if (failed > 0) {
    console.log('\n❌ SMOKE TESTS FAILED')
    process.exit(1)
  } else {
    console.log('\n✅ ALL SMOKE TESTS PASSED!')
    process.exit(0)
  }
}

runSmokeTests().catch((error) => {
  console.error('\n💥 Smoke test crashed:', error)
  process.exit(1)
})
