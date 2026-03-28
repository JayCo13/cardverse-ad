require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log("Fetching users...");
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 10 });
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Users:", JSON.stringify(data.users, null, 2));
    }
}
run();
