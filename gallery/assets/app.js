// Renders the template catalog from ./templates.json (built by
// scripts/build-site.mjs). When a template has a live preview, links to it.
// No framework, no build — served as-is.

const TIER_LABEL = {
  static: "Static",
  ssg: "SSG",
  spa: "SPA",
  data: "Data",
  native: "Native",
};

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "href") node.href = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}

function card(t) {
  const head = el(
    "div",
    { class: "card-head" },
    el("h3", { text: t.title }),
    el("span", { class: `badge badge-${t.tier}`, text: TIER_LABEL[t.tier] || t.tier }),
  );

  const meta = el(
    "dl",
    { class: "meta" },
    el("dt", { text: "Framework" }),
    el("dd", { text: t.framework }),
    el("dt", { text: "Base path" }),
    el("dd", { text: t.basePathMechanism }),
    el("dt", { text: "Deploy" }),
    el("dd", { text: t.deploy }),
  );

  const tags = el(
    "div",
    { class: "tags" },
    ...(t.tags || []).map((tag) => el("span", { class: "tag", text: tag })),
  );

  const actions = el(
    "div",
    { class: "actions" },
    t.preview
      ? el("a", { class: "btn btn-sm", href: `./preview/${t.name}/`, target: "_blank", rel: "noopener" }, "Live preview ↗")
      : el("span", { class: "btn btn-sm btn-disabled", title: "Preview not built for this template" }, "No preview"),
    el("a", { class: "btn btn-sm btn-ghost", href: `https://github.com/jongio/gh-pages-templates/tree/main/templates/${t.name}`, target: "_blank", rel: "noopener" }, "Source ↗"),
  );

  const cmd = el("code", { class: "cmd", text: `new-site.mjs ${t.name} --repo owner/name` });

  return el(
    "article",
    { class: "card" },
    head,
    el("p", { class: "tagline", text: t.tagline }),
    el("p", { class: "desc", text: t.description }),
    meta,
    tags,
    actions,
    cmd,
  );
}

async function load() {
  const host = document.getElementById("templates");
  try {
    const res = await fetch("./templates.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const templates = await res.json();
    host.innerHTML = "";
    host.append(el("div", { class: "grid" }, ...templates.map(card)));
    host.setAttribute("aria-busy", "false");
  } catch (err) {
    host.innerHTML = "";
    host.append(el("p", { class: "error", text: `Couldn't load templates: ${err.message}` }));
    host.setAttribute("aria-busy", "false");
  }
}

const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

load();
