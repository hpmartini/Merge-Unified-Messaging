const fs = require('fs');
let types = fs.readFileSync('types.ts', 'utf8');
types = types.replace(/Threema = 'Threema'/, "Threema = 'Threema',\n  Email = 'email'");
fs.writeFileSync('types.ts', types);

let constants = fs.readFileSync('constants.ts', 'utf8');
constants = constants.replace(/\[Platform\.Threema\]: \{ id: Platform\.Threema, label: 'Threema', color: 'text-emerald-400', bgColor: 'bg-emerald-400', lineColor: '#34d399' \},/, 
  "[Platform.Threema]: { id: Platform.Threema, label: 'Threema', color: 'text-emerald-400', bgColor: 'bg-emerald-400', lineColor: '#34d399' },\n  [Platform.Email]: { id: Platform.Email, label: 'Email', color: 'text-yellow-500', bgColor: 'bg-yellow-500', lineColor: '#eab308' },");
fs.writeFileSync('constants.ts', constants);
