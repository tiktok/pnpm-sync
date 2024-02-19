const fs = require('fs');
const path = require('path');

console.log('Installing Git hooks...');
fs.copyFileSync(
  path.join(__dirname, '../git-hooks/pre-commit'),
  path.join(__dirname, '../../../.git/hooks/pre-commit')
);
