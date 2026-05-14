/**
 * Seed Script for Staff Table
 * 
 * This script inserts the initial staff members (from INITIAL_USER_SEEDS) 
 * into the Supabase staff table, matching them with their auth.users by email.
 * 
 * Usage: node seed-staff.js
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: Missing environment variables')
  console.error('   Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const INITIAL_USER_SEEDS = [
  { name: 'Muna', email: 'muna@stonebusailah.com', role: 'admin' },
  { name: 'Marcela', email: 'marcela@stonebusailah.com', role: 'attorney' },
  { name: 'M. Grecco', email: 'm.grecco@police-defense.com', role: 'attorney' },
]

async function seedStaff() {
  console.log('🌱 Starting staff seeding...\n')

  for (const user of INITIAL_USER_SEEDS) {
    try {
      // Get the auth user by email
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
      
      if (authError) {
        console.error(`❌ Failed to fetch auth users: ${authError.message}`)
        continue
      }

      const authUser = authUsers.users.find(u => (u.email || '').toLowerCase() === user.email.toLowerCase())
      
      if (!authUser) {
        console.log(`⚠️  Auth user not found: ${user.email}`)
        console.log(`   → Create this user in Supabase Auth first, or manually add to INITIAL_USER_SEEDS in src/lib/roles.js\n`)
        continue
      }

      // Insert or update staff record
      const initials = user.name.slice(0, 2).toUpperCase()
      
      const { error } = await supabase
        .from('staff')
        .upsert(
          {
            id: authUser.id,
            full_name: user.name,
            initials,
            email: user.email,
            role: user.role,
            active: true,
          },
          { onConflict: 'id' }
        )
        .select()

      if (error) {
        console.error(`❌ Failed to seed ${user.email}: ${error.message}`)
      } else {
        console.log(`✅ Seeded staff: ${user.name} (${user.email}) - Role: ${user.role}`)
      }
    } catch (err) {
      console.error(`❌ Error seeding ${user.email}: ${err.message}`)
    }
  }

  console.log('\n🎉 Staff seeding complete!')
  console.log('\nNext steps:')
  console.log('1. If you see "Auth user not found" above, create those users in Supabase Auth')
  console.log('2. Sign in again with your seeded email')
  console.log('3. If still having issues, check that your email is in INITIAL_USER_SEEDS in src/lib/roles.js')
}

seedStaff().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
