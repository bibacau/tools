export const templates: Record<
  string,
  { html: string; css: string; js: string }
> = {
  "Hello world": {
    html: '<main><h1>Hello, little world.</h1><p>Make something you would like to see.</p><button id="hello">Say hello</button></main>',
    css: "body { font-family: system-ui; background: #f4ecd7; color: #263d2b; padding: 40px; }\nbutton { background: #a65f39; color: white; border: 0; padding: 12px 20px; border-radius: 8px; }",
    js: 'document.querySelector("#hello").addEventListener("click", () => console.log("Hello from your sandbox!"));',
  },
  "Responsive cards": {
    html: "<h1>Your next idea</h1><section><article>Imagine</article><article>Create</article><article>Explore</article></section>",
    css: "body { font-family: system-ui; padding: 24px; background: #10121a; color: #eee; }\nsection { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; }\narticle { padding: 40px; background: #8270f9; border-radius: 14px; }",
    js: 'console.log("Resize the preview to see the cards reflow.");',
  },
  Counter: {
    html: '<h1>Small steps</h1><button id="counter">0</button>',
    css: "body { text-align: center; font-family: Georgia; padding: 40px; }\nbutton { font-size: 40px; padding: 20px 50px; border-radius: 20px; border: 1px solid #8270f9; }",
    js: 'let count = 0; document.getElementById("counter").onclick = event => { event.target.textContent = ++count; console.log("Count", count); };',
  },
};
export function standaloneHTML({
  html,
  css,
  js,
}: {
  html: string;
  css: string;
  js: string;
}) {
  const encoded = btoa(unescape(encodeURIComponent(js)));
  const styles =
    "<style>" + css.replace(/<\/style/gi, "<\\/style") + "</style>";
  const script =
    '<script src="data:text/javascript;base64,' + encoded + '"></script>';
  if (/<html[\s>]/i.test(html)) {
    let document = html;
    if (/<\/head>/i.test(document))
      document = document.replace(/<\/head>/i, styles + "</head>");
    else document = styles + document;
    if (/<\/body>/i.test(document))
      document = document.replace(/<\/body>/i, script + "</body>");
    else document += script;
    return document;
  }
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    styles +
    "</head><body>" +
    html +
    script +
    "</body></html>"
  );
}
