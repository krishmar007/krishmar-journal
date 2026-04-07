const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Users\\DMA\\Documents\\KrishmarJournalApp\\public\\index.html';
const stylePath = 'c:\\Users\\DMA\\Documents\\KrishmarJournalApp\\public\\style.css';
const scriptPath = 'c:\\Users\\DMA\\Documents\\KrishmarJournalApp\\public\\script.js';

let html = fs.readFileSync(filePath, 'utf8');

// Extract CSS
const styleStart = html.indexOf('<style>');
const styleEnd = html.indexOf('</style>', styleStart);

if (styleStart !== -1 && styleEnd !== -1) {
    const css = html.substring(styleStart + 7, styleEnd).trim();
    fs.writeFileSync(stylePath, css);
    
    // Replace carefully replacing exact match
    const styleBlock = html.substring(styleStart, styleEnd + 8);
    html = html.replace(styleBlock, '<link rel="stylesheet" href="style.css">');
}

// Extract JS
// Find the last <script> block, which is the main app logic
const lastScriptEnd = html.lastIndexOf('</script>');
const lastScriptStart = html.lastIndexOf('<script>', lastScriptEnd);

if (lastScriptStart !== -1 && lastScriptEnd !== -1) {
    // Make sure it's the main one by length or content
    const js = html.substring(lastScriptStart + 8, lastScriptEnd).trim();
    if (js.length > 1000) { // Main logic is definitely large
        fs.writeFileSync(scriptPath, js);
        const scriptBlock = html.substring(lastScriptStart, lastScriptEnd + 9);
        html = html.replace(scriptBlock, '<script src="script.js"></script>');
    }
}

fs.writeFileSync(filePath, html);
console.log("Refactoring complete");
