const fs = require('fs'); const txt = fs.readFileSync('scratch/line5.txt', 'utf8'); const idx = txt.indexOf('Saved on'); console.log(txt.substring(idx - 60, idx + 100));
