/**
 * The account switch on the chat usage panel.
 *
 * Two things are worth pinning and neither is visible in review. It has to be the *same*
 * `patchAccount` the Settings pane calls — a second implementation here is exactly how the
 * two copies drifted apart the last time this panel carried controls — and a refusal has to
 * be shown, because enabling a parked account makes the server prove its token first and
 * that trip can come back 400. Without the message the switch just snaps back, which reads
 * as a broken toggle rather than as a rejected one.
 *
 * Mounted rather than rendered to a string: the point is the wiring, and
 * `renderToStaticMarkup` dispatches no events, so it would pass just as well against a
 * switch whose handler had been deleted.
 */
import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { installDom, mount, click, type Mounted } from "../../helpers/react-dom.tsx";
import type { AccountInfo, AccountUsageEntry } from "../../../src/web/lib/api-settings.ts";

installDom();

const patched: Array<{ id: string; status: string }> = [];
let patchError: string | null = null;
let reloads = 0;

mock.module("../../../src/web/lib/api-settings.ts", () => ({
  patchAccount: async (id: string, updates: { status: string }) => {
    patched.push({ id, status: updates.status });
    if (patchError) throw new Error(patchError);
    return null;
  },
}));

let accountStatus: AccountInfo["status"] = "active";

mock.module("../../../src/web/components/settings/accounts/use-accounts-data.ts", () => ({
  useAccountsData: () => ({
    usages: [{
      accountId: "acc-1",
      accountLabel: "work",
      accountStatus,
      isOAuth: true,
      usage: {},
    } satisfies AccountUsageEntry],
    accounts: [{
      id: "acc-1", label: "work", email: null, expiresAt: null, status: accountStatus,
      cooldownUntil: null, priority: 0, totalRequests: 0, lastUsedAt: null, profileData: null,
      createdAt: 0, hasRefreshToken: true,
    } satisfies AccountInfo],
    activeAccountId: "acc-1",
    initialLoading: false,
    refreshing: false,
    flashIds: new Set<string>(),
    reload: async () => { reloads += 1; },
  }),
}));

const { UsageDetailPanel } = await import("../../../src/web/components/chat/usage-badge.tsx");

let view: Mounted | null = null;

beforeEach(() => {
  patched.length = 0;
  patchError = null;
  reloads = 0;
  accountStatus = "active";
});
afterEach(async () => { await view?.unmount(); view = null; });

async function render() {
  view = await mount(<UsageDetailPanel usage={{}} visible onClose={() => {}} />);
  return view.container;
}

const theSwitch = (c: HTMLElement) => c.querySelector('button[role="switch"]');

describe("the chat usage panel's account switch", () => {
  it("asks the server to disable an account that is on, then refetches", async () => {
    const c = await render();
    await click(theSwitch(c));
    expect(patched).toEqual([{ id: "acc-1", status: "disabled" }]);
    expect(reloads).toBe(1);
  });

  it("brings a parked account back", async () => {
    accountStatus = "disabled";
    const c = await render();
    expect(theSwitch(c)?.getAttribute("aria-label")).toBe("Enable account");
    await click(theSwitch(c));
    expect(patched).toEqual([{ id: "acc-1", status: "active" }]);
  });

  it("shows what the server said when it refuses", async () => {
    patchError = "refresh token rejected";
    const c = await render();
    await click(theSwitch(c));
    expect(c.textContent).toContain("refresh token rejected");
  });

  it("carries the switch and nothing else — add, remove and export stay in Settings", async () => {
    const c = await render();
    expect(theSwitch(c)).not.toBeNull();
    const labels = [...c.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"));
    expect(labels).not.toContain("Remove account");
    expect(labels).not.toContain("Export this account");
    expect(c.textContent).toContain("Manage accounts");
  });
});
