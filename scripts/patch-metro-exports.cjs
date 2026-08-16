const fs = require("fs");
const path = require("path");

function resolveMetroPackageJson() {
  try {
    return require.resolve("metro/package.json");
  } catch (error) {
    return null;
  }
}

const metroPackageJsonPath = resolveMetroPackageJson();
if (!metroPackageJsonPath) {
  process.exit(0);
}

const metroPackageJson = JSON.parse(
  fs.readFileSync(metroPackageJsonPath, "utf8")
);

const currentExports = metroPackageJson.exports ?? {};
const extraExports = {
  "./src/*": "./src/*.js",
  "./src/*/*": "./src/*/*.js",
  "./src/*/*/*": "./src/*/*/*.js",
  "./src/*/*/*/*": "./src/*/*/*/*.js",
};

let changed = false;
for (const [key, value] of Object.entries(extraExports)) {
  if (currentExports[key] !== value) {
    currentExports[key] = value;
    changed = true;
  }
}

if (changed) {
  metroPackageJson.exports = currentExports;
  fs.writeFileSync(
    metroPackageJsonPath,
    JSON.stringify(metroPackageJson, null, 2) + "\n"
  );
}
