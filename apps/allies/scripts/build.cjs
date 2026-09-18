const { spawnSync } = require("node:child_process")
const fs = require("node:fs")
const path = require("node:path")

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: "inherit" })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function findNextBin() {
  const candidates = [
    path.join(__dirname, "..", "node_modules", "next", "dist", "bin", "next"),
    path.join(__dirname, "..", "..", "..", "node_modules", "next", "dist", "bin", "next"),
  ]
  for (const c of candidates) {
    try {
      fs.accessSync(c)
      return c
    } catch {}
  }
  throw new Error("next binary not found — run npm install from the workspace root")
}

process.env.NEXT_PUBLIC_APP_VERSION = require("../version.json").version
run(process.execPath, [path.join(__dirname, "generate-icons.cjs")])
run(process.execPath, [findNextBin(), "build"])