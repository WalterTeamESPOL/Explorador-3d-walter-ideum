// Genera un HTML autónomo a partir de los archivos del proyecto.
// Solo utiliza herramientas incluidas en Node.js.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = __dirname;
const output = path.join(root, "Walter_3D_Local.html");

// Lee archivos locales relativos a esta carpeta.
function readLocal(relative) {
  if (/^(?:[a-z]+:|\/\/)/i.test(relative))
    throw new Error(`Se esperaba un archivo local: ${relative}`);
  const file = path.resolve(root, relative);
  if (!fs.existsSync(file))
    throw new Error(`No se encontró: ${relative}`);
  return fs.readFileSync(file, "utf8");
}

// Obtiene un atributo entre comillas de una etiqueta HTML.
function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match ? match[1] : null;
}

try {
  let html = readLocal("index.html");
  let cssCount = 0, jsCount = 0;

  // Sustituye cada enlace CSS por su contenido.
  html = html.replace(/<link\b[^>]*>/gi, tag => {
    if (attribute(tag, "rel")?.toLowerCase() !== "stylesheet") return tag;
    const href = attribute(tag, "href");
    if (!href) throw new Error("Hay una hoja de estilos sin ruta.");
    const css = readLocal(href);
    // Este proyecto no utiliza imágenes ni fuentes externas en CSS.
    if (/@import\b|url\s*\(/i.test(css))
      throw new Error(`Hay recursos CSS que requieren empaquetado adicional: ${href}`);
    cssCount++;
    return `<style>\n${css.replace(/<\/style/gi, "<\\/style")}\n</style>`;
  });

  // Sustituye cada script externo por su contenido, conservando el orden.
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, tag => {
    const opening = tag.slice(0, tag.indexOf(">") + 1);
    const src = attribute(opening, "src");
    if (!src) return tag;
    if (attribute(opening, "type") === "module")
      throw new Error(`Este generador admite scripts clásicos: ${src}`);
    const code = readLocal(src);
    new vm.Script(code, {filename: src}); // Revisa sintaxis, no ejecuta.
    jsCount++;
    return `<script>\n${code.replace(/<\/script/gi, "<\\/script")}\n</script>`;
  });

  if (!cssCount || !jsCount)
    throw new Error("No se encontraron los CSS o scripts esperados en index.html.");

  fs.writeFileSync(output, html, "utf8");
  console.log(`Listo: ${output}`);
  console.log(`Incluidos: ${cssCount} CSS y ${jsCount} JavaScript.`);
  console.log("Puedes copiar únicamente Walter_3D_Local.html a la Ideum.");
} catch (error) {
  console.error("No se pudo generar el HTML:", error.message);
  process.exitCode = 1;
}