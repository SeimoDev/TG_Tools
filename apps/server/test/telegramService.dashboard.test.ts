import bigInt from "big-integer";
import { describe, expect, it, vi } from "vitest";
import { Api } from "telegram";
import { TelegramService } from "../src/services/telegramService.js";

const createService = (overrides?: Partial<Record<string, unknown>>) => {
  const service = new TelegramService() as TelegramService & Record<string, unknown>;

  service.config = {
    apiId: 1000,
    apiHash: "hash_value",
    proxy: {
      enabled: true,
      host: "127.0.0.1",
      port: 7890
    }
  };
  service.usingSecureStorage = true;
  service.storageWarning = undefined;

  Object.assign(service, overrides);
  return service;
};

describe("TelegramService dashboard", () => {
  it("returns unauthorized structure when session is not authorized", async () => {
    const client = {
      connect: vi.fn().mockResolvedValue(undefined),
      checkAuthorization: vi.fn().mockResolvedValue(false)
    };

    const service = createService({ client });

    const snapshot = await service.getDashboardSnapshot(false);

    expect(snapshot.authorized).toBe(false);
    expect(snapshot.profile).toBeUndefined();
    expect(snapshot.entityStats).toBeUndefined();
    expect(snapshot.system.clientReady).toBe(true);
    expect(snapshot.system.proxyEnabled).toBe(true);
    expect(snapshot.system.proxyHost).toBe("127.0.0.1");
    expect(snapshot.system.proxyPort).toBe(7890);
  });

  it("aggregates dashboard profile and entity stats", async () => {
    const me = new Api.User({
      id: bigInt(1),
      firstName: "Alice",
      username: "alice",
      phone: "123456",
      photo: new Api.UserProfilePhoto({
        photoId: bigInt(99),
        dcId: 1
      })
    });

    const friend = new Api.User({
      id: bigInt(2),
      firstName: "Friend",
      contact: true,
      deleted: false
    });

    const deletedFriend = new Api.User({
      id: bigInt(3),
      firstName: "Deleted",
      contact: true,
      deleted: true
    });

    const groupChat = new Api.Chat({
      id: bigInt(11),
      title: "Group"
    });

    const channel = new Api.Channel({
      id: bigInt(12),
      title: "Channel",
      accessHash: bigInt(22),
      megagroup: false,
      gigagroup: false
    });

    const megaGroup = new Api.Channel({
      id: bigInt(13),
      title: "MegaGroup",
      accessHash: bigInt(23),
      megagroup: true,
      gigagroup: false
    });

    const botUser = new Api.User({
      id: bigInt(4),
      firstName: "Bot",
      bot: true,
      self: false
    });

    const nonFriend = new Api.User({
      id: bigInt(5),
      firstName: "NF",
      bot: false,
      self: false,
      contact: false
    });

    const client = {
      connect: vi.fn().mockResolvedValue(undefined),
      checkAuthorization: vi.fn().mockResolvedValue(true),
      getMe: vi.fn().mockResolvedValue(me),
      invoke: vi.fn().mockResolvedValue({ users: [friend, deletedFriend] }),
      getDialogs: vi
        .fn()
        .mockResolvedValue([
          { entity: groupChat },
          { entity: channel },
          { entity: megaGroup },
          { entity: botUser },
          { entity: nonFriend }
        ]),
      downloadProfilePhoto: vi.fn().mockResolvedValue(Buffer.from("avatar"))
    };

    const service = createService({ client });
    const snapshot = await service.getDashboardSnapshot(false);

    expect(snapshot.authorized).toBe(true);
    expect(snapshot.profile?.displayName).toBe("Alice");
    expect(snapshot.profile?.username).toBe("alice");
    expect(snapshot.profile?.avatarDataUrl?.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(snapshot.entityStats).toEqual({
      friendsTotal: 2,
      deletedContactsTotal: 1,
      groupsTotal: 2,
      channelsTotal: 1,
      botChatsTotal: 1,
      nonFriendChatsTotal: 1,
      dialogsTotal: 5
    });
  });

  it("caches avatar and bypasses cache when force=true", async () => {
    const me = new Api.User({
      id: bigInt(99),
      firstName: "Cache",
      photo: new Api.UserProfilePhoto({
        photoId: bigInt(777),
        dcId: 1
      })
    });

    const downloadProfilePhoto = vi.fn().mockResolvedValue(Buffer.from("avatar"));

    const client = {
      connect: vi.fn().mockResolvedValue(undefined),
      checkAuthorization: vi.fn().mockResolvedValue(true),
      getMe: vi.fn().mockResolvedValue(me),
      invoke: vi.fn().mockResolvedValue({ users: [] }),
      getDialogs: vi.fn().mockResolvedValue([]),
      downloadProfilePhoto
    };

    const service = createService({ client });

    await service.getDashboardSnapshot(false);
    await service.getDashboardSnapshot(false);
    await service.getDashboardSnapshot(true);

    expect(downloadProfilePhoto).toHaveBeenCalledTimes(2);
  });
});
