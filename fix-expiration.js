#!/usr/bin/env node
const fs = require('fs');
const path = 'c:\\Users\\MARDOCHEE\\Documents\\Presta - Copy\\context\\DataContext.tsx';

let content = fs.readFileSync(path, 'utf8');
content = content.replace(
  /throw new Error\('Devis expiré : signature impossible \(délai 48h dépassé\)'\);/g,
  "if (signedBy !== 'admin') throw new Error('Devis expiré : signature impossible (délai 48h dépassé)');"
);
fs.writeFileSync(path, content);
console.log('File updated successfully');
