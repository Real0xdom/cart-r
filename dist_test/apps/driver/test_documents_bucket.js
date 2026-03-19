"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = 'https://epevjbiymsvwmmzybzib.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwZXZqYml5bXN2d21tenliemliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjQyODAsImV4cCI6MjA3NzgwMDI4MH0.TTO9koYOJFjjFNMc7g9_blvnpcM_QIb0Zwj13hW0NXI';
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
async function testStorage() {
    console.log('Testing "documents" storage bucket...');
    // 1. Check if bucket exists (by trying to list files)
    const { data: listData, error: listError } = await supabase
        .storage
        .from('documents')
        .list();
    if (listError) {
        console.error('FAILED: Could not access "documents" bucket:', listError.message);
        return;
    }
    console.log('SUCCESS: Bucket accessible. File count:', listData === null || listData === void 0 ? void 0 : listData.length);
    // 2. Try to upload a dummy file
    const fileName = `test_upload_${Date.now()}.txt`;
    const { error: uploadError } = await supabase
        .storage
        .from('documents')
        .upload(fileName, 'Test file content', { contentType: 'text/plain' });
    if (uploadError) {
        console.error('FAILED: Upload failed:', uploadError.message);
    }
    else {
        console.log('SUCCESS: Dummy file uploaded successfully:', fileName);
        // Cleanup
        await supabase.storage.from('documents').remove([fileName]);
        console.log('SUCCESS: Cleaned up test file.');
    }
}
testStorage();
