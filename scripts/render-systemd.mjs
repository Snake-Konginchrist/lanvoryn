import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function renderUnit(template, { node, user, group }) {
	if (![user, group].every((value) => /^[a-zA-Z0-9_.-]+\$?$/.test(value)))
		throw new Error("Invalid service user or group");
	if (!node.startsWith("/") || /[\r\n\0]/.test(node))
		throw new Error("Node must be an absolute executable path");
	// systemd expands %, and quoted arguments require escaping backslashes and quotes.
	const escape = (value) =>
		value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("%", "%%");
	return template
		.replaceAll("@SERVICE_USER@", user)
		.replaceAll("@SERVICE_GROUP@", group)
		.replaceAll("@NODE_COMMAND@", `"${escape(node)}"`);
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const [node, user, group, output] = process.argv.slice(2);
	if (!node || !user || !group || !output)
		throw new Error("Usage: render-systemd.mjs NODE USER GROUP OUTPUT_DIR");
	const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
	for (const name of ["lanvoryn.service", "lanvoryn-media.service"]) {
		writeFileSync(
			join(output, name),
			renderUnit(readFileSync(join(root, "deploy", name), "utf8"), {
				node,
				user,
				group,
			}),
			{ mode: 0o644 },
		);
	}
}
