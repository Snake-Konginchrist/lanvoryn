import { createApp } from "./app.js";
import { env } from "./environment.js";

try {
	const { app } = await createApp();
	await app.listen({ host: env.LANVORYN_HOST, port: env.LANVORYN_PORT });
	for (const signal of ["SIGTERM", "SIGINT"] as const)
		process.once(signal, () => {
			void app.close().then(
				() => process.exit(0),
				(error) => {
					console.error(error);
					process.exit(1);
				},
			);
		});
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}
