
import fs from 'fs';

const content = fs.readFileSync('c:\\Users\\hp\\Desktop\\Projets\\ExtracteurIA\\src\\App.tsx', 'utf8');

let curly = 0;
let paren = 0;
let tags = [];

const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '{') curly++;
        if (char === '}') curly--;
        if (char === '(') paren++;
        if (char === ')') paren--;
    }
}

console.log(`Final counts - Curly: ${curly}, Paren: ${paren}`);
