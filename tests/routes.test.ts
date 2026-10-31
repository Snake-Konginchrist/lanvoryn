import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryRouter } from "react-router";
import {
	loginDestination,
	pageFromPath,
	pagePaths,
} from "../apps/web/src/routes.js";

test("every console page has a distinct direct URL", () => {
	assert.equal(new Set(Object.values(pagePaths)).size, 5);
	for (const [page, path] of Object.entries(pagePaths)) {
		assert.equal(pageFromPath(path), page);
		assert.equal(pageFromPath(`${path}/`), page);
	}
	assert.equal(pageFromPath("/unknown"), undefined);
	assert.equal(pageFromPath("/settings/nested"), undefined);
});
test("login destinations restrict guests and reject external redirects", () => {
	assert.equal(loginDestination("admin", "/settings"), "/settings");
	assert.equal(loginDestination("admin", "/schedules/"), "/schedules");
	for (const from of [
		"https://example.com",
		"//example.com",
		"/unknown",
		undefined,
	]) {
		assert.equal(loginDestination("admin", from), "/live");
	}
	assert.equal(loginDestination("viewer", "/security"), "/live");
});
test("router history retains direct-entry paths and supports back/forward", async () => {
	const router = createMemoryRouter([{ path: "*", element: null }], {
		initialEntries: ["/settings"],
	});
	try {
		assert.equal(pageFromPath(router.state.location.pathname), "settings");
		await router.navigate("/schedules");
		assert.equal(pageFromPath(router.state.location.pathname), "schedules");
		await router.navigate(-1);
		assert.equal(pageFromPath(router.state.location.pathname), "settings");
		await router.navigate(1);
		assert.equal(pageFromPath(router.state.location.pathname), "schedules");
	} finally {
		router.dispose();
	}
});
