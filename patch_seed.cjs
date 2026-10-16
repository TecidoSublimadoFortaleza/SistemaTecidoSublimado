const fs = require('fs');
let c = fs.readFileSync('src/server/db/seed.ts', 'utf-8');

const startIndex = c.indexOf('const employeesSeedData');
const endIndex = c.indexOf('];', startIndex) + 2;

const arraySignature = c.substring(startIndex, c.indexOf('=', startIndex) + 1);

c = c.substring(0, startIndex) + arraySignature + ' [];\n' + c.substring(endIndex);

fs.writeFileSync('src/server/db/seed.ts', c);
