let text = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) text += chunk;

const document = JSON.parse(text);
if (
  typeof document !== "object" ||
  document === null ||
  typeof document.digest !== "string" ||
  !document.digest.startsWith("sha256:") ||
  !Array.isArray(document.namespaces) ||
  document.namespaces.map(({ name }) => name).join(",") !== "gradle,kast"
) {
  throw new Error(
    "Bundled catalog output violates the qualified broker contract.",
  );
}
process.stdout.write(`${document.digest}\n`);
