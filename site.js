fetch("release.json")
  .then((r) => {
    if (!r.ok) throw Error();
    return r.json();
  })
  .then((r) => {
    document.getElementById("version").textContent = "Version " + r.version;
    document.getElementById("size").textContent =
      (r.sizeBytes / 1048576).toFixed(1) + " MB";
    document.getElementById("hash").textContent = "SHA-256: " + r.sha256;
  })
  .catch(() => {});
