import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    try {
        console.log('Testing Supabase connection...');

        // Test basic connection
        const { data, error } = await supabase
            .from('projects')
            .select('count', { count: 'exact', head: true });

        if (error) {
            console.error('❌ Connection failed:', error.message);
        } else {
            console.log('✅ Database connected successfully!');
            console.log('📊 Projects table exists and is accessible');
        }
    } catch (err) {
        console.error('❌ Connection error:', err);
    }
}

testConnection(); 