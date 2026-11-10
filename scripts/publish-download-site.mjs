/** Publish the prepared static website using the repository's existing Git credentials. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const temp = mkdtempSync(path.join(tmpdir(), "personal-os-pages-"));
const env = { ...process.env, GIT_INDEX_FILE: path.join(temp, "index") };
function git(args, input) {
  return execFileSync("git", args, { env, input, encoding: "utf8" }).trim();
}
try {
  const remote = git(["ls-remote", "origin", "refs/heads/gh-pages"]).split(
    /\s/,
  )[0];
  if (remote) git(["fetch", "origin", "gh-pages"]);
  git(["read-tree", "HEAD:site"]);
  for (const [source, target] of [
    ["downloads/personal-os.apk", "personal-os.apk"],
    ["downloads/release.json", "release.json"],
  ]) {
    const blob = git(["rev-parse", `HEAD:${source}`]);
    git(["update-index", "--add", "--cacheinfo", `100644,${blob},${target}`]);
  }
  const empty = git(["hash-object", "-w", "--stdin"], "");
  git(["update-index", "--add", "--cacheinfo", `100644,${empty},.nojekyll`]);
  const tree = git(["write-tree"]);
  const commit = git(
    ["commit-tree", tree, ...(remote ? ["-p", remote] : [])],
    `Publish Android download website from ${git(["rev-parse", "--short", "HEAD"])}\n`,
  );
  git(["push", "origin", `${commit}:refs/heads/gh-pages`]);
  console.log(
    "Published website files and APK to gh-pages. GitHub Pages will deploy https://bibacau.github.io/tools/",
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
