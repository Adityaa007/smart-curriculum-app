const fs = require('fs');
const path = require('path');

function getFiles(dir, filesList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getFiles(fullPath, filesList);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      filesList.push(fullPath);
    }
  }
  return filesList;
}

const files = getFiles(path.join(__dirname, 'frontend/src'));
const iconsSet = new Set();

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const importMatch = content.match(/import\s+\{([^}]+)\}\s+from\s+['"]react-icons\/hi['"]/g);
  if (importMatch) {
    for (const match of importMatch) {
      const parts = match.match(/import\s+\{([^}]+)\}/);
      if (parts) {
        const icons = parts[1].split(',').map(i => i.trim()).filter(i => i);
        icons.forEach(i => iconsSet.add(i));
      }
    }
  }
  
  const hiMatch = content.match(/<Hi[A-Z][a-zA-Z0-9]+/g);
  if(hiMatch) {
     hiMatch.forEach(m => iconsSet.add(m.replace('<','')));
  }
  
  const iconPropMatch = content.match(/icon:\s*(Hi[A-Z][a-zA-Z0-9]+)/g);
  if (iconPropMatch) {
     iconPropMatch.forEach(m => iconsSet.add(m.split(':')[1].trim()));
  }
}

console.log('All identified icons:');
console.log(Array.from(iconsSet).sort().join('\n'));
