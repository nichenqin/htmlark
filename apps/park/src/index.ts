export default {
  fetch(): Response {
    const body = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>htmlark</title>
  <style>
    body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: #0f1115; color: #e8eaed; }
    main { max-width: 40rem; margin: 20vh auto; padding: 1.5rem; }
    h1 { font-size: 2rem; letter-spacing: -0.03em; margin: 0 0 0.5rem; }
    p { color: #9aa0a6; line-height: 1.5; }
    code { color: #8ab4f8; }
  </style>
</head>
<body>
  <main>
    <h1>htmlark</h1>
    <p>Local-first runtime for AI-generated HTML artifacts.</p>
    <p>Public publish is not live yet. Local CLI remains the source of truth.</p>
    <p><code>htmlark.com</code></p>
  </main>
</body>
</html>`;
    return new Response(body, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300",
        "x-robots-tag": "noindex",
      },
    });
  },
};
