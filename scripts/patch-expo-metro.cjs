const fs = require("fs");
const path = require("path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function patchMetroPackage(rootDir) {
  const metroPackageJsonPath = path.join(rootDir, "node_modules", "metro", "package.json");
  if (!fs.existsSync(metroPackageJsonPath)) {
    return false;
  }

  const metroPackageJson = readJson(metroPackageJsonPath);
  const exportsField = metroPackageJson.exports ?? {};
  const requiredExports = {
    ".": "./src/index.js",
    "./package.json": "./package.json",
    "./src/*": "./src/*.js",
    "./src/*/*": "./src/*/*.js",
    "./src/*/*/*": "./src/*/*/*.js",
    "./src/*/*/*/*": "./src/*/*/*/*.js",
  };

  let changed = false;
  for (const [key, value] of Object.entries(requiredExports)) {
    if (exportsField[key] !== value) {
      exportsField[key] = value;
      changed = true;
    }
  }

  if (changed || !metroPackageJson.exports) {
    metroPackageJson.exports = exportsField;
    writeJson(metroPackageJsonPath, metroPackageJson);
  }

  return changed;
}

function patchExpoCli(rootDir) {
  const terminalReporterPath = path.join(
    rootDir,
    "node_modules",
    "@expo",
    "cli",
    "build",
    "src",
    "start",
    "server",
    "metro",
    "TerminalReporter.js"
  );

  if (!fs.existsSync(terminalReporterPath)) {
    return false;
  }

  const original = fs.readFileSync(terminalReporterPath, "utf8");
  let next = original.replace(
    'const data = /*#__PURE__*/ _interopRequireDefault(require("metro/src/lib/TerminalReporter"));',
    'const data = require("metro").TerminalReporter;'
  );
  next = next.replace(
    "const XTerminalReporter = _terminalReporter().default;",
    "const XTerminalReporter = _terminalReporter();"
  );

  if (next !== original) {
    fs.writeFileSync(terminalReporterPath, next);
    return true;
  }

  return false;
}

function main() {
  const rootDir = path.resolve(__dirname, "..");
  const metroChanged = patchMetroPackage(rootDir);
  const expoChanged = patchExpoCli(rootDir);

  if (metroChanged || expoChanged) {
    console.log("Patched Expo/Metro workspace compatibility.");
  } else {
    console.log("Expo/Metro compatibility patch already applied.");
  }
}

main();
