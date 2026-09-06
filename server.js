// Agent8 GameServer functions — Verse8 platform convention: root server.js, a bare
// `class Server` (not exported) whose methods become remoteFunction endpoints, with
// $global / $sender injected. Plain JS, no build step. Runs in an isolated VM.
//
// Cloud saves for Lure of the Temptress: one collection item per (account, slot).
// `slot` is the ScummVM save filename (e.g. "lure.001"), `data` is the file as base64.
// Client: src/save/syncController.ts.

const SAVES = "lure_saves";
const MAX_BYTES = 512 * 1024;

class Server {
  async ping() {
    return "pong";
  }

  async listSaves() {
    const items = await $global.getCollectionItems(SAVES, {
      filters: [{ field: "account", operator: "==", value: $sender.account }],
      limit: 100,
    });
    return items.map((i) => ({ slot: i.slot, name: i.name, mtime: i.mtime, size: i.size }));
  }

  async getSave(slot) {
    const items = await $global.getCollectionItems(SAVES, {
      filters: [
        { field: "account", operator: "==", value: $sender.account },
        { field: "slot", operator: "==", value: String(slot) },
      ],
      limit: 1,
    });
    const i = items[0];
    return i ? { slot: i.slot, name: i.name, mtime: i.mtime, size: i.size, data: i.data } : null;
  }

  async putSave(slot, name, mtime, data) {
    if (typeof data !== "string" || data.length > MAX_BYTES * 1.4) throw new Error("save too large");
    if (typeof slot !== "string" || !/^[A-Za-z0-9._-]{1,32}$/.test(slot)) throw new Error("bad slot");
    const item = {
      account: $sender.account,
      slot,
      name: String(name || slot).slice(0, 64),
      mtime: Number(mtime) || Date.now(),
      size: Math.floor(data.length * 0.75),
      data,
    };
    const existing = await $global.getCollectionItems(SAVES, {
      filters: [
        { field: "account", operator: "==", value: $sender.account },
        { field: "slot", operator: "==", value: slot },
      ],
      limit: 1,
    });
    if (existing[0]) {
      await $global.updateCollectionItem(SAVES, { ...item, __id: existing[0].__id });
      return { updated: true };
    }
    await $global.addCollectionItem(SAVES, item);
    return { updated: false };
  }

  async deleteSave(slot) {
    const existing = await $global.getCollectionItems(SAVES, {
      filters: [
        { field: "account", operator: "==", value: $sender.account },
        { field: "slot", operator: "==", value: String(slot) },
      ],
      limit: 10,
    });
    for (const e of existing) await $global.deleteCollectionItem(SAVES, e.__id);
    return { deleted: existing.length };
  }
}
