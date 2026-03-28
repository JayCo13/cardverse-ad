import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) {
        console.error(error);
    } else {
        console.log("Total users:", data.users.length);
        console.log("Emails:", data.users.map(u => u.email).slice(0, 5));
    }
}
run();
