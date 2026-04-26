
import fs from 'fs';

const content = fs.readFileSync('c:\\Users\\hp\\Desktop\\Projets\\ExtracteurIA\\src\\App.tsx', 'utf8');

const tagRegex = /<\/?([a-zA-Z0-9\.]+)(?:\s+[^>]*?)?>/g;
let match;
let stack = [];

while ((match = tagRegex.exec(content)) !== null) {
    const fullTag = match[0];
    const tagName = match[1];
    const isClosing = fullTag.startsWith('</');
    const isSelfClosing = fullTag.endsWith('/>') || ['img', 'input', 'br', 'hr'].includes(tagName.toLowerCase());

    if (isSelfClosing && !isClosing) continue;

    if (isClosing) {
        if (stack.length === 0) {
            console.log(`Extra closing tag: ${fullTag} at position ${match.index}`);
        } else {
            const lastTag = stack.pop();
            if (lastTag.name !== tagName) {
                console.log(`Mismatched tag: expected </${lastTag.name}> but found ${fullTag} at position ${match.index}`);
            }
        }
    } else {
        stack.push({ name: tagName, pos: match.index });
    }
}

console.log(`Remaining tags in stack: ${stack.length}`);
stack.forEach(t => console.log(`Unclosed tag: <${t.name}> at position ${t.pos}`));
