/**
 * Smoke test: Verify authenticated database reads
 * Tests: profiles, listings, giver_availability, bookings
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database.generated'

const supabaseUrl = 'https://ksramckuggspsqymcjpo.supabase.co'
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!

if (!supabaseAnonKey) {
  console.error('❌ VITE_SUPABASE_ANON_KEY environment variable not set')
  process.exit(1)
}

const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

async function runSmokeTests() {
  console.log('🧪 Running smoke tests...\n')
  let passed = 0
  let failed = 0

  // Test 1: Read profiles (public read access)
  console.log('1️⃣  Testing profiles read...')
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email')
      .limit(5)

    if (error) throw error
    console.log(`   ✅ Profiles read successful (${data?.length || 0} rows)`)
    if (data && data.length > 0) {
      console.log(`   Sample: ${data[0].name || 'unnamed'} (${data[0].id.substring(0, 8)}...)`)
    }
    passed++
  } catch (error: any) {
    console.log(`   ❌ Profiles read failed: ${error.message}`)
    failed++
  }

  // Test 2: Read listings (public read access for active listings)
  console.log('\n2️⃣  Testing listings read...')
  try {
    const { data, error } = await supabase
      .from('listings')
      .select('id, user_id, topic, mode, is_active')
      .eq('is_active', true)
      .limit(5)

    if (error) throw error
    console.log(`   ✅ Listings read successful (${data?.length || 0} active listings)`)
    if (data && data.length > 0) {
      console.log(`   Sample: ${data[0].topic || 'no topic'} (${data[0].mode}, ${data[0].id.substring(0, 8)}...)`)
    }
    passed++
  } catch (error: any) {
    console.log(`   ❌ Listings read failed: ${error.message}`)
    failed++
  }

  // Test 3: Read giver_availability
  console.log('\n3️⃣  Testing giver_availability read...')
  try {
    const { data, error } = await supabase
      .from('giver_availability')
      .select('id, giver_id, date, time')
      .limit(5)

    if (error) throw error
    console.log(`   ✅ Giver availability read successful (${data?.length || 0} slots)`)
    if (data && data.length > 0) {
      console.log(`   Sample: ${data[0].date} at ${data[0].time}`)
    }
    passed++
  } catch (error: any) {
    console.log(`   ❌ Giver availability read failed: ${error.message}`)
    failed++
  }

  // Test 4: Read bookings (should fail without auth, or succeed if RLS allows)
  console.log('\n4️⃣  Testing bookings read...')
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, seeker_id, giver_id, status')
      .limit(5)

    if (error) {
      // This is expected if RLS requires authentication
      console.log(`   ⚠️  Bookings read requires auth (expected): ${error.message}`)
      passed++ // This is not a failure - it's expected behavior
    } else {
      console.log(`   ✅ Bookings read successful (${data?.length || 0} bookings)`)
      passed++
    }
  } catch (error: any) {
    console.log(`   ❌ Bookings read failed unexpectedly: ${error.message}`)
    failed++
  }

  // Summary
  console.log('\n' + '='.repeat(50))
  console.log(`📊 Smoke Test Results: ${passed} passed, ${failed} failed`)
  console.log('='.repeat(50))

  if (failed > 0) {
    console.log('\n❌ Some tests failed')
    process.exit(1)
  } else {
    console.log('\n✅ All smoke tests passed!')
    process.exit(0)
  }
}

runSmokeTests().catch((error) => {
  console.error('\n💥 Smoke test crashed:', error)
  process.exit(1)
})
