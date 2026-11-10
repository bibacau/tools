/** Trusted bootstrap. Its exact content hash is allowed by the app CSP. */
(() => {
  if (window.parent === window || window.origin !== "null") return;
  window.addEventListener(
    "message",
    function receive(event) {
      if (event.source !== parent || event.data?.kind !== "personal-os-preview")
        return;
      const payload = event.data;
      if (typeof payload.token !== "string") return;

      const scriptURL = (code) => {
        const url = URL.createObjectURL(
          new Blob([code], { type: "application/javascript" }),
        );
        return url;
      };
      // Keep the closing tag escaped because this source is embedded into srcdoc.
      const scriptTag = (code) =>
        // eslint-disable-next-line no-useless-escape
        '<script src="' + scriptURL(code) + '"><\/script>';
      const token = JSON.stringify(payload.token);
      const bridge = `(()=>{const token=${token};const send=(level,args)=>{try{parent.postMessage({kind:'preview-console',token,level,text:args.map(v=>{try{return typeof v==='string'?v:JSON.stringify(v)}catch{return String(v)}}).join(' ').slice(0,4000)},'*')}catch{}};for(const level of ['log','info','warn','error']){const old=console[level];console[level]=(...args)=>{send(level,args);old.apply(console,args)}}addEventListener('error',e=>send('error',[e.message+' ('+e.lineno+':'+e.colno+')']));addEventListener('unhandledrejection',e=>send('error',[String(e.reason)]));})();`;
      const doc = new DOMParser().parseFromString(
        String(payload.html || ""),
        "text/html",
      );
      doc.querySelectorAll("base").forEach((node) => node.remove());
      doc.querySelectorAll("script").forEach((node) => {
        if (!node.hasAttribute("src")) {
          const source = node.textContent || "";
          node.textContent = "";
          node.src = scriptURL(source);
        }
      });
      // A blob script binds inline handlers, without eval or weakening the host CSP.
      const handlers = [];
      let index = 0;
      doc.querySelectorAll("*").forEach((node) => {
        for (const attr of Array.from(node.attributes)) {
          if (/^on[a-z]+$/i.test(attr.name)) {
            const id = String(index++);
            node.setAttribute("data-personalos-handler", id);
            handlers.push(
              `document.querySelector('[data-personalos-handler="${id}"]')[${JSON.stringify(attr.name.toLowerCase())}]=function(event){${attr.value}\n};`,
            );
            node.removeAttribute(attr.name);
          }
        }
      });
      const remote = payload.external ? " https:" : "";
      const policy =
        "default-src 'none'; script-src blob: 'unsafe-eval'" +
        remote +
        "; style-src 'unsafe-inline'" +
        remote +
        "; img-src data: blob:" +
        remote +
        "; font-src data:" +
        remote +
        "; connect-src " +
        (payload.external ? "https:" : "'none'") +
        "; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
      const result =
        '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="' +
        policy +
        '">' +
        scriptTag(bridge) +
        doc.head.innerHTML +
        "<style>" +
        String(payload.css || "") +
        "</style></head><body>" +
        doc.body.innerHTML +
        scriptTag(handlers.join("\n")) +
        scriptTag(String(payload.js || "") + "\n//# sourceURL=playground.js") +
        "</body></html>";
      parent.postMessage({ kind: "preview-ready", token: payload.token }, "*");
      document.open();
      document.write(result);
      document.close();
    },
    { once: true },
  );
})();
