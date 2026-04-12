const fs = require('fs');
const file = 'tests/reactions.test.js';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes("generateToken")) {
  content = `import { generateToken } from '../server/auth/jwt.js';\n` + content;
  content = content.replace(
    `.post('/api/messages/msg1/react')`,
    `.post('/api/messages/msg1/react')\n      .set('Authorization', \`Bearer \${generateToken({ id: 1, username: 'testuser' })}\`)`
  );
  fs.writeFileSync(file, content);
}
