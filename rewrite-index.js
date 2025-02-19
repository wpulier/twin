const fs = require("fs");
const path = require("path");

// Define the dist folder
const distPath = path.resolve(__dirname, "dist", "public");
const manifestPath = path.join(distPath, ".vite", "manifest.json");
const indexPath = path.join(distPath, "index.html");

if (!fs.existsSync(manifestPath)) {
  console.error("Manifest not found at", manifestPath);
  process.exit(1);
}

if (!fs.existsSync(indexPath)) {
  console.error("index.html not found at", indexPath);
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
} catch (err) {
  console.error("Error parsing manifest:", err);
  process.exit(1);
}

const entry = manifest["src/main.tsx"];
if (!entry) {
  console.error("Entry for src/main.tsx not found in manifest");
  process.exit(1);
}

const builtFile = "/" + entry.file;
let indexHtml = fs.readFileSync(indexPath, "utf8");

// Replace the script tag that references the source file with the built asset path
const newIndexHtml = indexHtml.replace(/<script\s+type="module"\s+src=["'][^"']*src\/main\.tsx[^"']*["']><\/script>/, `<script type="module" src="${builtFile}"></script>`);

fs.writeFileSync(indexPath, newIndexHtml, "utf8");
console.log("index.html successfully rewritten with built asset:", builtFile); 