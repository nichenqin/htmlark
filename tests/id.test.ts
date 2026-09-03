import { describe, expect, test } from "bun:test";
import { encodeId, hexToBytes } from "@htmlark/core";

describe("artifact id", () => {
  test("vectors", () => {
    expect(encodeId(hexToBytes("0000000000000000000000000000"))).toBe("art_0000000000000000000000");
    expect(encodeId(hexToBytes("ffffffffffffffffffffffffffff"))).toBe("art_ZZZZZZZZZZZZZZZZZZZZZZ");
    expect(encodeId(hexToBytes("8000000000000000000000000000"))).toBe("art_G000000000000000000000");
    expect(encodeId(hexToBytes("0b5a91c3e07f2d448a16b3c91e02"))).toBe("art_1DD93GZ0FWPM92GPPF4HW0");
  });
});
