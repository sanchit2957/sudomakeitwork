const fs = require('fs');
const lines = fs.readFileSync('client/src/contexts/currentInterfaceTerms.ts', 'utf8').split('\n');
lines.slice(30, 50).forEach((line, i) => console.log(`${i + 31}: ${line.substring(0, 50)}`));
