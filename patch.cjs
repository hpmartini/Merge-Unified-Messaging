const fs = require('fs');
const file = 'src/tests/ChatArea.test.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/alternateIds: \[\]\n\s*\},\n/g, "alternateIds: []\n      },\n      typingUsers: {},\n");
fs.writeFileSync(file, content);
