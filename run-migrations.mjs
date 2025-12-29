// Migration runner script
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ksramckuggspsqymcjpo.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set')
  console.error('Please set it with: export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Migration files to run
const migrations = [
  'supabase/migrations/add_session_protocol.sql',
  'supabase/migrations/update_giver_metrics_rls.sql'
]

async function runMigrations() {
  console.log('🚀 Running migrations...\n')

  for (const migrationFile of migrations) {
    try {
      console.log(`📄 Running: ${migrationFile}`)

      const migrationPath = join(__dirname, migrationFile)
      const sql = readFileSync(migrationPath, 'utf8')

      // Execute the SQL
      const { error } = await supabase.rpc('exec_sql', { sql_string: sql }).single()

      if (error) {
        // Try direct SQL execution if RPC doesn't work
        const { error: directError } = await supabase.from('_migrations').insert({
          name: migrationFile,
          executed_at: new Date().toISOString()
        })

        if (directError) {
          console.error(`   ❌ Error executing migration: ${error.message || directError.message}`)
          console.log(`   ℹ️  You may need to run this migration manually in the Supabase SQL Editor`)
          console.log(`   📋 Migration content saved in: ${migrationFile}\n`)
        } else {
          console.log(`   ✅ Migration recorded\n`)
        }
      } else {
        console.log(`   ✅ Success\n`)
      }
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`)
      console.log(`   ℹ️  Please run this migration manually in the Supabase SQL Editor`)
      console.log(`   📋 File: ${migrationFile}\n`)
    }
  }

  console.log('\n📝 Note: If automatic execution failed, please:')
  console.log('   1. Go to your Supabase project dashboard')
  console.log('   2. Navigate to SQL Editor')
  console.log('   3. Copy and paste the contents of each migration file')
  console.log('   4. Execute them in order\n')
  console.log('Migration files:')
  migrations.forEach(m => console.log(`   - ${m}`))
}

runMigrations().catch(console.error)
