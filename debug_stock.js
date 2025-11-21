import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Manually load env vars
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        envVars[key.trim()] = value.trim();
    }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDailyStock() {
    console.log('Fetching latest daily_stock entries (raw IDs)...');

    const { data, error } = await supabase
        .from('daily_stock')
        .select('*')
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
        console.log('Route ID:', entry.route_id);
        console.log('Driver ID:', entry.auth_user_id || 'NULL (No Driver)');
        console.log('Stock Items:', JSON.stringify(entry.stock, null, 2));
        console.log('Created At:', entry.created_at);
    });
}

checkDailyStock();
