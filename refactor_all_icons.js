const fs = require('fs');
const path = require('path');

const mapping = {
  "HiAcademicCap": "GraduationCap",
  "HiChevronLeft": "ChevronLeft",
  "HiChevronRight": "ChevronRight",
  "HiOutlineAdjustments": "SlidersHorizontal",
  "HiOutlineBell": "Bell",
  "HiOutlineBookOpen": "BookOpen",
  "HiOutlineCalendar": "Calendar",
  "HiOutlineCamera": "Camera",
  "HiOutlineChartBar": "BarChart",
  "HiOutlineCheck": "Check",
  "HiOutlineCheckCircle": "CheckCircle",
  "HiOutlineChevronDown": "ChevronDown",
  "HiOutlineChevronLeft": "ChevronLeft",
  "HiOutlineChevronRight": "ChevronRight",
  "HiOutlineClipboardCheck": "ClipboardCheck",
  "HiOutlineClipboardList": "ClipboardCheck",
  "HiOutlineClock": "Clock",
  "HiOutlineCollection": "Layers",
  "HiOutlineDownload": "Download",
  "HiOutlineExclamationCircle": "AlertCircle",
  "HiOutlineEye": "Eye",
  "HiOutlineEyeOff": "EyeOff",
  "HiOutlineFire": "Flame",
  "HiOutlineGlobe": "Globe",
  "HiOutlineHome": "Home",
  "HiOutlineIdentification": "IdCard",
  "HiOutlineLightningBolt": "Zap",
  "HiOutlineLink": "Link",
  "HiOutlineLockClosed": "LockKeyhole",
  "HiOutlineLogout": "LogOut",
  "HiOutlineMail": "Mail",
  "HiOutlineMenu": "Menu",
  "HiOutlinePencilAlt": "Pencil",
  "HiOutlinePlay": "Play",
  "HiOutlinePlus": "Plus",
  "HiOutlineQrcode": "QrCode",
  "HiOutlineRefresh": "RefreshCw",
  "HiOutlineSave": "Save",
  "HiOutlineSearch": "Search",
  "HiOutlineShieldCheck": "ShieldCheck",
  "HiOutlineSparkles": "Sparkles",
  "HiOutlineStar": "Star",
  "HiOutlineStatusOnline": "Activity",
  "HiOutlineTag": "Tag",
  "HiOutlineTrash": "Trash",
  "HiOutlineTrendingUp": "TrendingUp",
  "HiOutlineUser": "User",
  "HiOutlineUserGroup": "Users",
  "HiOutlineViewList": "List",
  "HiOutlineX": "X",
  "HiOutlineXCircle": "XCircle",
  "HiWifi": "Wifi"
};

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

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // 1. Process imports
  const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"]react-icons\/hi['"];?/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
      const parts = match[1].split(',').map(i => i.trim()).filter(i => i);
      const lucideIcons = new Set();
      
      for (const hi of parts) {
          if (mapping[hi]) {
             lucideIcons.add(mapping[hi]);
          } else {
             console.warn(`WARNING: Missing mapping for ${hi} in ${file}`);
             lucideIcons.add(hi); // fallback to keep it from breaking code completely
          }
      }
      
      // Check if lucide-react is already imported
      const existingLucideImport = content.match(/import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"];?/);
      if (existingLucideImport) {
          const existingParts = existingLucideImport[1].split(',').map(i => i.trim()).filter(i => i);
          existingParts.forEach(p => lucideIcons.add(p));
          
          // Replace react-icons import with empty
          content = content.replace(match[0], '');
          
          // Update lucide-react import
          content = content.replace(existingLucideImport[0], `import { ${Array.from(lucideIcons).join(', ')} } from "lucide-react";`);
      } else {
          // Replace react-icons import with lucide-react
          content = content.replace(match[0], `import { ${Array.from(lucideIcons).join(', ')} } from "lucide-react";`);
      }
      changed = true;
  }

  if (changed) {
      // 2. Process usages
      for (const [hiName, lucideName] of Object.entries(mapping)) {
        // Match <HiName   /> or <HiName>
        const tagRegex = new RegExp(`<${hiName}(|\\s[^>]*)>`, 'g');
        content = content.replace(tagRegex, (m, p1) => {
            let props = p1;
            if (props === '/') props = ' /';
            
            // if it has size= or className that implies size, we omit size={20} to respect custom sizing
            if (props.includes('size=') || props.includes('w-') || props.includes('h-')) {
                return `<${lucideName}${props}>`;
            } else {
                return `<${lucideName} size={20}${props}>`;
            }
        });
        
        // Replace object references e.g. icon: HiName
        const refRegex = new RegExp(`\\b${hiName}\\b`, 'g');
        content = content.replace(refRegex, lucideName);
      }
      
      fs.writeFileSync(file, content);
      console.log(`Updated ${path.basename(file)}`);
  }
}
console.log("Migration complete.");
