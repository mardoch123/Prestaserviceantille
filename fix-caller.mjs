import fs from 'fs';

const filePath = 'c:/Users/MARDOCHEE/Documents/Presta - Copy/components/DevisFactures.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Find calls to openAdminSignModal and update them to pass the status
// Pattern: openAdminSignModal(selectedDocument.id)
// Should become: openAdminSignModal(selectedDocument.id, selectedDocument.status)

const pattern = /openAdminSignModal\(([^)]+)\)/g;

content = content.replace(pattern, (match, arg) => {
    // Check if it already has a second argument
    if (arg.includes(',')) {
        return match; // Already has multiple arguments, don't modify
    }
    
    // Check if arg is selectedDocument.id
    if (arg.trim() === 'selectedDocument.id') {
        return 'openAdminSignModal(selectedDocument.id, selectedDocument.status)';
    }
    
    // Check if arg is doc.id or similar
    if (arg.trim().endsWith('.id')) {
        const base = arg.trim().replace('.id', '');
        return `openAdminSignModal(${arg}, ${base}.status)`;
    }
    
    return match;
});

fs.writeFileSync(filePath, content);
console.log('Successfully updated openAdminSignModal calls');
