// Static export writes segment payloads as `route/__next.route/__PAGE__.txt`, but the
// client requests the flattened `route/__next.route.__PAGE__.txt`. Write both forms.
import { copyFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "out");

const files = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });

let copied = 0;
const visit = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (!statSync(p).isDirectory()) continue;
    if (name.startsWith("__next.")) {
      for (const f of files(p)) {
        const flat = join(dir, `${name}.${relative(p, f).split(sep).join(".")}`);
        if (!existsSync(flat)) {
          copyFileSync(f, flat);
          copied++;
        }
      }
    }
    visit(p);
  }
};
visit(OUT);
console.log(`flatten-rsc: wrote ${copied} flattened segment files`);
