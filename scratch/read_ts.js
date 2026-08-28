const fs = require('fs');
const lines = fs.readFileSync('client/src/contexts/currentInterfaceTerms.ts', 'utf8').split('\n');
lines.slice(10, 30).forEach((line, i) => console.log((i + 11) + ': ' + line));
