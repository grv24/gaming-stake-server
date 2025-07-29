const fs = require('fs');
const path = require('path');

const basePath = path.join(__dirname, '../../prisma/base.prisma');
const modelsDir = path.join(__dirname, '../../prisma/models');
const outputPath = path.join(__dirname, '../../prisma/schema.prisma');

let merged = fs.readFileSync(basePath, 'utf8') + '\n\n';

const modelFiles = fs.readdirSync(modelsDir).filter(f => f.endsWith('.prisma'));

for (const file of modelFiles) {
  const content = fs.readFileSync(path.join(modelsDir, file), 'utf8');
  merged += `// --- ${file} ---\n${content}\n\n`;
}

fs.writeFileSync(outputPath, merged.trim());


console.log('schema.prisma generated!');
