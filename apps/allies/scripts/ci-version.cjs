const fs = require("fs")
const path = require("path")

const version = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "version.json"), "utf8")).version
process.stdout.write(version)