import type { Role } from "@lanvoryn/shared";

export const pagePaths = {
	live: "/live",
	settings: "/settings",
	schedules: "/schedules",
	security: "/security",
	events: "/events",
} as const;
export type Page = keyof typeof pagePaths;

export function pageFromPath(pathname: string): Page | undefined {
	const path = pathname.replace(/\/+$/, "") || "/";
	return (Object.keys(pagePaths) as Page[]).find(
		(page) => pagePaths[page] === path,
	);
}

// 登录回跳只允许项目内部页面，访客始终进入实时监看。
export function loginDestination(role: Role, from: unknown): string {
	if (role !== "admin" || typeof from !== "string") return pagePaths.live;
	const page = pageFromPath(from);
	return page ? pagePaths[page] : pagePaths.live;
}
