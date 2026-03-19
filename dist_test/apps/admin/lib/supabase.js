"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Debug logging (remove in production)
if (typeof window !== 'undefined') {
    console.log('Supabase Config Debug:', {
        hasUrl: !!supabaseUrl,
        urlPreview: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'MISSING',
        hasAnonKey: !!supabaseAnonKey,
        hasServiceKey: !!supabaseServiceKey,
        usingKey: supabaseServiceKey ? 'SERVICE_ROLE' : (supabaseAnonKey ? 'ANON' : 'NONE'),
    });
}
if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables!', {
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? 'set' : 'MISSING',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey ? 'set' : 'MISSING',
        SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKey ? 'set' : 'MISSING',
    });
}
// Use service role key if available (bypasses RLS), otherwise use anon key
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl || '', supabaseServiceKey || supabaseAnonKey || '', {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
