const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const outputPath = path.join(distDir, "auth-cpf-lambda.zip");

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

const command = process.platform === "win32"
  ? {
      cmd: "powershell.exe",
      args: [
        "-NoProfile",
        "-Command",
        "Compress-Archive -Path src,node_modules,package.json -DestinationPath dist/auth-cpf-lambda.zip -Force"
      ]
    }
  : {
      cmd: "zip",
      args: ["-qr", outputPath, "src", "node_modules", "package.json"]
    };

const result = spawnSync(command.cmd, command.args, {
  cwd: rootDir,
  stdio: "inherit"
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}

console.log(`Created ${outputPath}`);
