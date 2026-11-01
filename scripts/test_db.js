const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envContent = fs.readFileSync(path.resolve('.env.local'), 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) {
    env[key.trim()] = vals.join('=').trim().replace(/^"|"$/g, '');
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'] || env['VITE_SUPABASE_ANON_KEY'];

async function check() {
  const res = await fetch(`${supabaseUrl}/rest/v1/profiles?email=eq.empo@hr.com&select=id,full_name,email,phone,emp_code`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const data = await res.json();
  console.log("Data for empo@hr.com:", data);
  
  const res2 = await fetch(`${supabaseUrl}/rest/v1/profiles?select=phone&limit=5`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const data2 = await res2.json();
  console.log("5 random phones:", data2);
}

check().catch(console.error);
