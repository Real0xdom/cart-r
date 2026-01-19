
const fs = require('fs');
const path = require('path');

const envPath = 'e:\\Freelance\\Pranav\\Cart-R\\Repository\\cart-r\\apps\\admin\\.env';

try {
    const data = fs.readFileSync(envPath, 'utf8');
    const lines = data.split('\n');
    const result = {};
    lines.forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim().replace(/['"]/g, '');
            result[key] = value;
        }
    });
    
    fs.writeFileSync('credentials.json', JSON.stringify(result, null, 2));
    console.log('Credentials extracted to credentials.json');
} catch (err) {
    console.error('Error:', err);
}
