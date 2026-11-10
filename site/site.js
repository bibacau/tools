fetch("release.json", { cache: "no-store" })
  .then((r) => {
    if (!r.ok) throw Error();
    return r.json();
  })
  .then((r) => {
    document.getElementById("version").textContent = "Version " + r.version;
    document.getElementById("size").textContent =
      (r.sizeBytes / 1048576).toFixed(1) + " MB";
    document.getElementById("hash").textContent = "SHA-256: " + r.sha256;
    document.querySelectorAll('a[href^="personal-os.apk"]').forEach((link) => {
      link.href =
        "personal-os.apk?v=" +
        encodeURIComponent(r.version) +
        "&sha=" +
        r.sha256.slice(0, 12);
    });
  })
  .catch(() => {});
