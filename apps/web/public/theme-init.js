/* Apply before the first paint; keep playback media outside color transformations. */
(() => {
	const key = "lanvoryn.theme";
	const valid = (value) => ["system", "light", "dark"].includes(value);
	const system = window.matchMedia("(prefers-color-scheme: dark)");
	const listeners = new Set();
	let preference = "system";
	try {
		const saved = localStorage.getItem(key);
		if (valid(saved)) preference = saved;
	} catch {
		/* Storage can be disabled. */
	}
	function apply() {
		const resolved =
			preference === "system"
				? system.matches
					? "dark"
					: "light"
				: preference;
		document.documentElement.dataset.theme = resolved;
		document.documentElement.dataset.themePreference = preference;
		const meta = document.querySelector('meta[name="theme-color"]');
		if (meta) meta.content = resolved === "dark" ? "#151915" : "#f4f6ef";
		listeners.forEach((listener) => listener());
	}
	window.lanvorynTheme = {
		get: () => preference,
		set(value) {
			if (!valid(value)) return;
			preference = value;
			try {
				localStorage.setItem(key, value);
			} catch {
				/* Keep the current choice in memory. */
			}
			apply();
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
	system.addEventListener("change", () => {
		if (preference === "system") apply();
	});
	window.addEventListener("storage", (event) => {
		if (event.key === key || event.key === null) {
			preference = valid(event.newValue) ? event.newValue : "system";
			apply();
		}
	});
	apply();
})();
