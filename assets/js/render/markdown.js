// markdown.js – Markdown rendering with code copy buttons

export function renderMarkdown(text) {
  if (typeof marked !== "undefined") {
    marked.setOptions({
      breaks: true,
      gfm: true,
    });
    const raw = marked.parse(text || "");
    const clean =
      typeof DOMPurify !== "undefined"
        ? DOMPurify.sanitize(raw, {
            ALLOW_UNKNOWN_PROTOCOLS: false,
            FORBID_TAGS: ["style"],
          })
        : raw;
    return clean;
  }
  return (text || "").replace(
    /[&<>]/g,
    (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[s])
  );
}

export function enhanceCodeBlocks(container) {
  const pres = container.querySelectorAll("pre");
  pres.forEach((pre) => {
    if (pre.querySelector(".copy-btn")) return;
    const btn = document.createElement("button");
    btn.className = "copy-btn";
    btn.textContent = "Copy";
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(pre.innerText);
        btn.textContent = "Copied";
        setTimeout(() => (btn.textContent = "Copy"), 1200);
      } catch {
        btn.textContent = "Error";
        setTimeout(() => (btn.textContent = "Copy"), 1200);
      }
    });
    pre.appendChild(btn);
  });
}
