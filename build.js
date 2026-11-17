const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

['html', 'css', 'js'].forEach(dir => {
    const src = path.join(__dirname, dir);
    const dest = path.join(publicDir, dir);
    if (fs.existsSync(src)) {
        fs.cpSync(src, dest, { recursive: true });
        console.log(`Copied ${dir} to public/${dir}`);
    }
});

console.log('Build completed successfully: static assets ready in public/');
