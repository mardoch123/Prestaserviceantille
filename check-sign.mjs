import fs from 'fs';

const filePath = 'c:/Users/MARDOCHEE/Documents/Presta - Copy/context/DataContext.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Find the signQuoteAsAdmin function and check how it calls signQuoteWithData
const signQuoteAsAdminPattern = /const signQuoteAsAdmin = async \(id: string, signatureData\?: string\) => \{[\s\S]*?\};/;

const match = content.match(signQuoteAsAdminPattern);
if (match) {
    console.log('Found signQuoteAsAdmin:');
    console.log(match[0].substring(0, 500));
} else {
    console.log('signQuoteAsAdmin not found with that pattern');
}

// Also check signQuoteWithData
const signQuoteWithDataPattern = /const signQuoteWithData = async \(id: string, signatureData: string, signedBy: 'client' \| 'admin' = 'client'\) => \{[\s\S]*?\n\};/;

const match2 = content.match(signQuoteWithDataPattern);
if (match2) {
    console.log('\nFound signQuoteWithData:');
    console.log(match2[0].substring(0, 1500));
} else {
    console.log('\nsignQuoteWithData not found with that pattern');
}
