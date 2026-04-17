const fs = require('fs');
const path = require('path');

function getFiles(dir, filesList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getFiles(fullPath, filesList);
    } else if (fullPath.endsWith('.jsx')) {
      filesList.push(fullPath);
    }
  }
  return filesList;
}

const files = getFiles(path.join(__dirname, 'frontend/src'));
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('from "lucide-react"')) {
    const lucideMatch = content.match(/import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"]/);
    if (lucideMatch) {
       const icons = lucideMatch[1].split(',').map(i => i.trim().split(' as ')[0]).filter(i => i);
       for (const icon of icons) {
         // Check for variable declarations
         const varRegex = new RegExp(`(const|let|var|function)\\s+${icon}\\b`, 'g');
         const matches = content.match(varRegex);
         if (matches) {
            console.log(`Var conflict in ${file}: ${icon}`);
         }
       }
    }
  }
}
