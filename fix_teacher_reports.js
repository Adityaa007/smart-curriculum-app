const fs = require('fs');

const mapping = {
  "HiOutlineDownload": "Download",
  "HiOutlineRefresh": "RefreshCw",
  "HiOutlineExclamationCircle": "AlertCircle",
  "HiOutlineCheck": "Check",
  "HiOutlineQrcode": "QrCode",
  "HiOutlinePencilAlt": "Pencil",
  "HiOutlineViewList": "List",
  "HiOutlineX": "X",
  "HiOutlineBookOpen": "BookOpen",
  "HiOutlineCollection": "Layers",
  "HiOutlineAdjustments": "SlidersHorizontal",
};

let content = fs.readFileSync('frontend/src/pages/TeacherReports.jsx', 'utf8');

// Replace import statement
content = content.replace(/import\s+\{([^}]+)\}\s+from\s+['"]react-icons\/hi['"];/, () => {
    return 'import { ' + Object.values(mapping).join(', ') + ' } from "lucide-react";';
});

// Replace tags and add size={20} if size is not already present
for (const [hiName, lucideName] of Object.entries(mapping)) {
  const tagRegex = new RegExp(`<${hiName}(|\\s[^>]*)>`, 'g');
  content = content.replace(tagRegex, (match, p1) => {
      // Avoid modifying self-closing slash directly attached to the name without space
      let props = p1;
      if (props === '/') props = ' /';
      
      if (props.includes('size=')) {
          return `<${lucideName}${props}>`;
      } else {
          return `<${lucideName} size={20}${props}>`;
      }
  });
  
  // Replace references like `icon: HiOutlineBookOpen`
  const refRegex = new RegExp(`\\b${hiName}\\b`, 'g');
  content = content.replace(refRegex, lucideName);
}

fs.writeFileSync('frontend/src/pages/TeacherReports.jsx', content);
console.log("TeacherReports.jsx updated!");
