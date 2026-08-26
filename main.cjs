// ARIA Desktop Entry Wrapper
const path = require("path");
const fs = require("fs");

const compiledMain = path.join(__dirname, "dist", "desktop", "main.cjs");

if (fs.existsSync(compiledMain)) {
  require(compiledMain);
} else {
  // If not built yet, fallback to tsx or require
  console.log("[Electron] Starting via TSX loader...");
  try {
    require("tsx/cjs");
    require("./desktop/main.ts");
  } catch (e) {
    console.warn("[Electron] Could not require TS directly, ensure npm run build has been run.");
  }
}
