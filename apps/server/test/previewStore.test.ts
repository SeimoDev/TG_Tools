import { describe, expect, it } from "vitest";
import type { EntityItem } from "@tg-tools/shared";
import { PreviewStore } from "../src/store/previewStore.js";

describe("PreviewStore", () => {
  const entities: EntityItem[] = [
    {
      id: "1",
      accessHash: "2",
      type: "friend",
      title: "A"
    }
  ];

  it("creates and consumes a preview token", () => {
    const store = new PreviewStore();
    const preview = store.create("DELETE_FRIENDS", entities);

    expect(preview.total).toBe(1);
    expect(preview.items[0].id).toBe("1");

    const consumed = store.consume(preview.previewToken, "DELETE_FRIENDS");
    expect(consumed).toHaveLength(1);

    expect(() => store.consume(preview.previewToken, "DELETE_FRIENDS")).toThrow("PREVIEW_TOKEN_INVALID");
  });

  it("throws when action mismatch", () => {
    const store = new PreviewStore();
    const preview = store.create("DELETE_FRIENDS", entities);

    expect(() => store.consume(preview.previewToken, "LEAVE_GROUPS")).toThrow("PREVIEW_ACTION_MISMATCH");
  });
});
