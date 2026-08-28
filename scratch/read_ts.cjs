const fs = require('fs');
const lines = fs.readFileSync('client/src/contexts/currentInterfaceTerms.ts', 'utf8').split('\n');
lines.slice(0, 30).forEach((line, i) => console.log(`${i + 1}: ${line.substring(line.length - 20)}`));
