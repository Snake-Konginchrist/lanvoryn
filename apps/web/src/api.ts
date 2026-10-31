import { t } from "./i18n";
export class ApiError extends Error {
	readonly status: number;
	constructor(message: string, status: number) {
		super(message);
		this.status = status;
	}
}

export async function api<T>(
	path: string,
	options: { method?: string; body?: unknown } = {},
): Promise<T> {
	const response = await fetch(`/api${path}`, {
		method: options.method ?? "GET",
		credentials: "same-origin",
		headers: {
			"X-Lanvoryn-Request": "1",
			...(options.body === undefined
				? {}
				: { "Content-Type": "application/json" }),
		},
		...(options.body === undefined
			? {}
			: { body: JSON.stringify(options.body) }),
	});
	if (!response.ok) {
		const error = await response
			.json()
			.catch(() => ({
				message: t("请求失败（{{status}}）", { status: response.status }),
			}));
		if (response.status === 401 && path !== "/auth/login")
			window.dispatchEvent(new Event("lanvoryn:unauthorized"));
		throw new ApiError(t(error.message ?? "操作失败"), response.status);
	}
	return response.status === 204
		? (undefined as T)
		: (response.json() as Promise<T>);
}

export function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const fileStamp = () => new Date().toISOString().replace(/[:.]/g, "-");
