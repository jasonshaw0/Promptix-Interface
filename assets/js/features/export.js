// export.js – export chat to multiple formats (md, txt, html, pdf, json, zip, copy)

function toFrontMatterMd(chat) {
  const fm = `---\ntitle: ${chat.title || "Untitled"
    }\ndate: ${new Date().toISOString()}\n---\n\n`;
  const body = chat.messages
    .map(
      (m) => `### ${m.role} — ${new Date(m.ts).toLocaleString()}\n\n${m.text}\n`
    )
    .join("\n");
  return fm + body + "\n";
}

function toPlainText(chat) {
  return chat.messages
    .map((m) => `[${m.role}] ${new Date(m.ts).toLocaleString()}\n${m.text}\n`)
    .join("\n");
}

function toMessagesHtml(chat) {
  const parts = chat.messages.map((m) => {
    const time = new Date(m.ts).toLocaleString();
    const html = (window.marked ? window.marked.parse(m.text || "") : (m.text || ""));
    return `<article class="m m--${m.role}"><header><strong>${m.role}</strong> <time>${time}</time></header><div class="m__body">${html}</div></article>`;
  });
  return parts.join("\n");
}

function toHtml(chat, template) {
  const title = chat.title || "Chat";
  const timestamp = new Date().toISOString();
  const messages_html = toMessagesHtml(chat);
  const tpl = template || `<!doctype html>
<html><head><meta charset="utf-8"/><title>{{title}}</title><style>
body{font-family:system-ui,Segoe UI,Roboto,Inter,sans-serif;background:#0b111a;color:#d8e1ee;padding:24px}
.m{background:#111b29;border:1px solid rgba(120,160,210,.25);border-radius:12px;padding:10px 12px;margin:10px 0}
.m--user{border-color:rgba(var(--accent-rgb,91,141,255),.45)}
.m header{font-size:12px;color:#9fb0c6;margin-bottom:6px}
.m__body{font-size:14px;line-height:1.55}
pre{background:#0f1722;border:1px solid rgba(120,160,210,.25);border-radius:10px;padding:12px;overflow:auto}
</style></head><body><h1>{{title}}</h1><div class="messages">{{messages_html}}</div></body></html>`;
  return tpl
    .replace(/{{\\s*title\\s*}}/g, title)
    .replace(/{{\\s*timestamp\\s*}}/g, timestamp)
    .replace(/{{\\s*messages_html\\s*}}/g, messages_html);
}

function toJson(chat) {
  return JSON.stringify(chat, null, 2);
}

export function download(name, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportChat(chat, type = "md", options = {}) {
  if (!chat) return;
  const base = (chat.title || "chat").replace(/[^a-z0-9-_]+/gi, "_") || "chat";
  const templates = (options.templates || (window.__exportTemplates)) || {};
  switch (type) {
    case "md":
      download(`${base}.md`, toFrontMatterMd(chat));
      break;
    case "txt":
      download(`${base}.txt`, toPlainText(chat));
      break;
    case "html": {
      const html = toHtml(chat, templates.html);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      if (window.saveAs) {
        window.saveAs(blob, `${base}.html`);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${base}.html`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
      break;
    }
    case "pdf": {
      const html = toHtml(chat, templates.html);
      if (!window.html2pdf) {
        console.warn("html2pdf.js not loaded");
        return;
      }
      const opt = { margin: 10, filename: `${base}.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: "mm", format: "a4", orientation: "portrait" } };
      // Use a temporary element for from()
      const tmp = document.createElement("div");
      tmp.style.position = "fixed";
      tmp.style.left = "-99999px";
      tmp.innerHTML = html;
      document.body.appendChild(tmp);
      await window.html2pdf().set(opt).from(tmp).save();
      tmp.remove();
      break;
    }
    case "json":
      download(`${base}.json`, toJson(chat));
      break;
    case "copy": {
      const txt = toPlainText(chat);
      try {
        await navigator.clipboard.writeText(txt);
      } catch (e) {
        download(`${base}.txt`, txt);
      }
      break;
    }
    case "zip": {
      const JSZip = window.JSZip;
      if (!JSZip) {
        console.warn("JSZip not loaded");
        return;
      }
      const zip = new JSZip();
      const md = toFrontMatterMd(chat);
      const txt = toPlainText(chat);
      const html = toHtml(chat, templates.html);
      const json = toJson(chat);
      zip.file(`${base}.md`, md);
      zip.file(`${base}.txt`, txt);
      zip.file(`${base}.html`, html);
      zip.file(`${base}.json`, json);
      // Attempt PDF generation into zip (best-effort)
      if (window.html2pdf) {
        try {
          const tmp = document.createElement("div");
          tmp.style.position = "fixed";
          tmp.style.left = "-99999px";
          tmp.innerHTML = html;
          document.body.appendChild(tmp);
          const worker = window.html2pdf().from(tmp).toPdf();
          const doc = await worker.get("pdf");
          const blob = doc.output("blob");
          tmp.remove();
          const arrayBuffer = await blob.arrayBuffer();
          zip.file(`${base}.pdf`, arrayBuffer);
        } catch (e) {
          console.warn("PDF in zip failed, continuing without PDF", e);
        }
      }
      const content = await zip.generateAsync({ type: "blob" });
      if (window.saveAs) {
        window.saveAs(content, `${base}.zip`);
      } else {
        const url = URL.createObjectURL(content);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${base}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
      break;
    }
    default:
      download(`${base}.txt`, toPlainText(chat));
  }
}
