const fs = require('fs');
const path = require('path');

const basePath = path.join(__dirname, '../../prisma/base.prisma');
const modelsDir = path.join(__dirname, '../../prisma/models');
const outputPath = path.join(__dirname, '../../prisma/schema.prisma');

function getAllPrismaFiles(dirPath, fileList = []) {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      getAllPrismaFiles(fullPath, fileList);
    } else if (file.endsWith('.prisma')) {
      fileList.push(fullPath);
    }
  }

  return fileList;
}

let merged = fs.readFileSync(basePath, 'utf8') + '\n\n';

const modelFiles = getAllPrismaFiles(modelsDir);

for (const file of modelFiles) {
  const content = fs.readFileSync(file, 'utf8');
  merged += `// --- ${path.relative(modelsDir, file)} ---\n${content}\n\n`;
}

fs.writeFileSync(outputPath, merged.trim());

console.log('schema.prisma generated!');
