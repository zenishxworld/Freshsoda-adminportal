import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDailyStock() {
    console.log('Fetching latest daily_stock entries...');

    const { data, error } = await supabase
        .from('daily_stock')
        .select(`
            *,
            routes (name),
            users (name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Found', data.length, 'entries:');
    data.forEach(entry => {
        console.log('------------------------------------------------');
        console.log('ID:', entry.id);
        console.log('Date:', entry.date);
        console.log('Route:', entry.routes?.name, `(${entry.route_id})`);
        console.log('Driver:', entry.users?.name || 'NULL (No Driver)', `(${entry.auth_user_id})`);
        console.log('Stock Items:', JSON.stringify(entry.stock, null, 2));
        console.log('Created At:', entry.created_at);
    });
}

checkDailyStock();
