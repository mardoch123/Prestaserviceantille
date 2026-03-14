import fs from 'fs';

const filePath = 'c:/Users/MARDOCHEE/Documents/Presta - Copy/components/DevisFactures.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the date format in openAdminSignModal
// Replace dayjs().format('YYYY-MM-DD') or similar with new Date().toISOString()

// Pattern to find the created_at update in openAdminSignModal
const pattern = /const today = .*?;\s*\n\s*const \{ error \} = await supabase\s*\n\s*\.from\('documents'\)\s*\n\s*\.update\(\{\s*\n\s*created_at: today,/;

// Find all matches
const matches = content.match(pattern);
if (matches) {
    console.log('Found patterns:', matches.length);
    matches.forEach((m, i) => console.log(`Match ${i}:`, m.substring(0, 200)));
}

// Replace the pattern
content = content.replace(
    /(const openAdminSignModal = async \(docId: string, currentStatus\?: string\) => \{[\s\S]*?if \(currentStatus === 'expired'\) \{[\s\S]*?)(const today = .*?;)([\s\S]*?)(created_at: today,)/,
    (match, p1, p2, p3, p4) => {
        return p1 + 'const now = new Date().toISOString();' + p3 + 'created_at: now,';
    }
);

fs.writeFileSync(filePath, content);
console.log('Updated DevisFactures.tsx with ISO date format');
