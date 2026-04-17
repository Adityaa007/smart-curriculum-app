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
  const lucideMatch = content.match(/import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"]/);
  const routerMatch = content.match(/import\s+\{([^}]+)\}\s+from\s+['"]react-router-dom['"]/);
  
  if (lucideMatch && routerMatch) {
    const lucideIcons = lucideMatch[1].split(',').map(i => i.trim().split(' as ')[0]).filter(i => i);
    const routerImports = routerMatch[1].split(',').map(i => i.trim().split(' as ')[0]).filter(i => i);
    
    const intersection = lucideIcons.filter(i => routerImports.includes(i));
    if (intersection.length > 0) {
      console.log(`Conflict in ${file}: ${intersection.join(', ')}`);
    }
  }
}
