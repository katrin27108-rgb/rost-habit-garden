import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const required = [
  "README.md",
  "AGENTS.md",
  "MEMORY.md",
  "docs/ARCHITECTURE.md",
  "docs/ONBOARDING.md",
  "docs/DEPLOYMENT.md",
  ".agents/task-template.md",
  ".agents/review-checklist.md",
];

const errors = [];
for (const file of required) {
  if (!existsSync(file)) {
    errors.push(`Missing required documentation: ${file}`);
    continue;
  }

  const content = readFileSync(file, "utf8");
  const mermaidOpen = (content.match(/```mermaid\s/g) ?? []).length;
  const fences = (content.match(/```/g) ?? []).length;
  if (mermaidOpen > 0 && fences % 2 !== 0) {
    errors.push(`Unclosed Markdown fence in ${file}`);
  }

  for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].trim().replace(/^<|>$/g, "").split("#", 1)[0];
    if (!target || /^(https?:|mailto:)/i.test(target)) continue;
    const decoded = decodeURIComponent(target);
    if (!existsSync(resolve(dirname(file), decoded))) {
      errors.push(`Broken link in ${file}: ${match[1]}`);
    }
  }
}

const agents = existsSync("AGENTS.md") ? readFileSync("AGENTS.md", "utf8") : "";
if (!agents.includes("MEMORY.md")) errors.push("AGENTS.md must require reading MEMORY.md");
if (!agents.includes("docs/ARCHITECTURE.md")) errors.push("AGENTS.md must link to docs/ARCHITECTURE.md");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Documentation check passed (${required.length} required files).`);
