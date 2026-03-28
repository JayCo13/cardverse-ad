require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log("Fetching users from 'users' table...");
    const { data: users, error: err1 } = await supabase.from('users').select('*').limit(5);
    if (!err1) console.log("users table:", users[0]);
    else console.log("No users table or error:", err1.message);

    console.log("Fetching profiles from 'profiles' table...");
    const { data: profiles, error: err2 } = await supabase.from('profiles').select('*').limit(5);
    if (!err2) console.log("profiles table:", profiles[0]);
    else console.log("No profiles table or error:", err2.message);
}
run();
