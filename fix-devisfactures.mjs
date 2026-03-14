import fs from 'fs';

const filePath = 'c:/Users/MARDOCHEE/Documents/Presta - Copy/components/DevisFactures.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the openAdminSignModal function to handle expired quotes
const oldOpenAdminSignModal = /const openAdminSignModal = \(docId: string\) => \{[\s\S]*?setIsAdminSignModalOpen\(true\);[\s\S]*?\};/;

const newOpenAdminSignModal = `const openAdminSignModal = async (docId: string, currentStatus?: string) => {
    // If document is expired, reset creation date to today and status to 'sent' first
    if (currentStatus === 'expired') {
        const today = new Date().toISOString();
        const { error } = await supabase
            .from('documents')
            .update({ 
                created_at: today,
                status: 'sent'
            })
            .eq('id', docId);
        
        if (error) {
            console.error('[DevisFactures] Error updating expired document:', error);
            alert('Erreur lors de la mise à jour du devis expiré');
            return;
        }
        
        // Refresh the document in the list
        const doc = documents.find(d => d.id === docId);
        if (doc) {
            doc.status = 'sent';
            doc.createdAt = today;
        }
    }
    
    setAdminSignDocumentId(docId);
    setAdminSignatureDataUrl('');
    setAdminSignatureFileName('');
    setIsAdminSignModalOpen(true);
};`;

// Check if the pattern exists
if (oldOpenAdminSignModal.test(content)) {
    content = content.replace(oldOpenAdminSignModal, newOpenAdminSignModal);
    fs.writeFileSync(filePath, content);
    console.log('Successfully updated openAdminSignModal function');
} else {
    console.log('Pattern not found - trying alternative approach');
    
    // Alternative: Find the function declaration
    const altPattern = /const openAdminSignModal = \(docId: string\) => \{/;
    if (altPattern.test(content)) {
        // Replace the entire function body
        const startMatch = content.match(/const openAdminSignModal = \(docId: string\) => \{/);
        if (startMatch && startMatch.index !== undefined) {
            const startIdx = startMatch.index;
            let braceCount = 1;
            let endIdx = startIdx + startMatch[0].length;
            
            while (braceCount > 0 && endIdx < content.length) {
                if (content[endIdx] === '{') braceCount++;
                if (content[endIdx] === '}') braceCount--;
                endIdx++;
            }
            
            const before = content.substring(0, startIdx);
            const after = content.substring(endIdx);
            
            content = before + newOpenAdminSignModal + after;
            fs.writeFileSync(filePath, content);
            console.log('Successfully updated openAdminSignModal function (alternative method)');
        }
    } else {
        console.log('Could not find openAdminSignModal function');
    }
}
