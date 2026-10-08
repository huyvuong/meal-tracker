import "next/dist/server/node-environment-baseline";

import assert from "node:assert/strict";
import { after, before, beforeEach, mock, test } from "node:test";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";

type TestAuth = (() => Promise<{ userId: string | null }>) & {
  protect: () => Promise<void>;
};
type Handler = (auth: TestAuth, request: NextRequest) => Promise<Response | void>;

let handler: Handler;
let config: typeof import("./proxy").config;
let userId: string | null = null;
let protectionChecks = 0;
const auth = Object.assign(async () => ({ userId }), {
  protect: async () => {
    protectionChecks++;
    if (!userId) throw new Error("Sign in required");
  },
});

// Keep Clerk session verification isolated while testing the actual route guard.
for (const modulePath of [
  "./node_modules/@clerk/nextjs/dist/cjs/server/index.js",
  "./node_modules/@clerk/nextjs/dist/esm/server/index.js",
]) {
  mock.module(modulePath, { namedExports: {
    clerkMiddleware: (callback: Handler) => { handler = callback; return callback; },
  } });
}

before(async () => { ({ config } = await import("./proxy")); });
beforeEach(() => { userId = null; protectionChecks = 0; });
after(() => { mock.restoreAll(); });

const protectedPaths = [
  "/dashboard",
  "/dashboard/",
  "/dashboard?start=invalid",
  "/dashboard/meals/new",
  "/dashboard/meals/meal-id",
  "/dashboard/future/nested/page",
  "/dashboard/future/page.json",
];

test("signed-out dashboard requests are blocked, including nested and static-looking paths", async () => {
  for (const path of protectedPaths) {
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: path }), true, path);
    await assert.rejects(handler(auth, new NextRequest(`https://example.com${path}`)), /Sign in required/);
  }
  assert.equal(protectionChecks, protectedPaths.length);
});

test("signed-in users can access every dashboard route", async () => {
  userId = "signed_in_user";
  for (const path of protectedPaths) {
    assert.equal(await handler(auth, new NextRequest(`https://example.com${path}`)), undefined);
  }
  assert.equal(protectionChecks, protectedPaths.length);
});

test("public routes and similarly named paths do not require sign-in", async () => {
  for (const path of ["/", "/sign-in", "/sign-up", "/sign-in/verify", "/dashboard-public"]) {
    assert.equal(await handler(auth, new NextRequest(`https://example.com${path}`)), undefined);
  }
  assert.equal(protectionChecks, 0);
  assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: "/_next/static/app.js" }), false);
});

test("signed-in home requests still redirect to the dashboard on the same origin", async () => {
  userId = "signed_in_user";
  const response = await handler(auth, new NextRequest("https://example.com/?redirect_url=https://other.example"));
  assert.ok(response);
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "https://example.com/dashboard");
  assert.equal(protectionChecks, 0);
});
