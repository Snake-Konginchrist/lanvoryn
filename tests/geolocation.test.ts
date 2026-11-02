import assert from "node:assert/strict";
import test from "node:test";
import {
	Geolocation,
	isPublicIp,
	normalizeIp,
} from "../apps/server/src/security/geolocation.js";

test("local, reserved and invalid IPs never leave the server", async () => {
	let calls = 0;
	const geo = new Geolocation(true, (async () => {
		calls++;
		throw new Error();
	}) as typeof fetch);
	for (const ip of [
		"10.0.0.1",
		"172.16.1.1",
		"192.168.1.1",
		"127.0.0.1",
		"100.64.0.1",
		"169.254.1.1",
		"192.0.2.1",
		"::1",
		"::ffff:192.168.1.1",
		"::ffff:c0a8:101",
		"fc00::1",
		"fe80::1",
		"2001:db8::1",
		"ff02::1",
	]) {
		assert.equal((await geo.lookup(ip)).status, "local", ip);
	}
	assert.equal((await geo.lookup("example.com/path")).status, "unavailable");
	assert.equal(calls, 0);
	assert.ok(isPublicIp("8.8.8.8"));
	assert.ok(isPublicIp("2606:4700:4700::1111"));
	assert.equal(normalizeIp("::ffff:8.8.8.8"), "8.8.8.8");
});
test("lookups share requests, cache results and degrade safely", async () => {
	let calls = 0;
	const geo = new Geolocation(true, (async () => {
		calls++;
		return Response.json({
			ipAddress: "8.8.8.8",
			countryCode: "US",
			regionName: "California",
			cityName: "Mountain View",
		});
	}) as typeof fetch);
	const results = await Promise.all([
		geo.lookup("8.8.8.8"),
		geo.lookup("8.8.8.8"),
	]);
	assert.equal(results[0]?.countryCode, "US");
	await geo.lookup("8.8.8.8");
	assert.equal(calls, 1);
	assert.equal(
		(await new Geolocation(false).lookup("8.8.8.8")).status,
		"disabled",
	);
	const failed = new Geolocation(
		true,
		(async () => new Response(null, { status: 429 })) as typeof fetch,
	);
	assert.equal((await failed.lookup("8.8.8.8")).status, "unavailable");
});
test("rate limit bounds outgoing queries and mismatched responses are rejected", async () => {
	let calls = 0;
	const geo = new Geolocation(true, (async () => {
		calls++;
		return Response.json({ ipAddress: "1.1.1.1", countryCode: "AU" });
	}) as typeof fetch);
	for (let index = 1; index <= 12; index++)
		assert.equal((await geo.lookup(`8.8.8.${index}`)).status, "unavailable");
	assert.equal(calls, 8);
});
