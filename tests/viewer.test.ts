import { describe, expect, test } from "bun:test";
import { renderViewer } from "@htmlark/runtime";

describe("renderViewer", () => {
  test("escapes title", () => {
    const { body } = renderViewer({
      title: `</title><script>alert(1)</script>`,
      version: 1,
      renderUrl: "/render/art_0000000000000000000000/1",
      id: "art_0000000000000000000000",
    });
    expect(body).not.toContain("</title><script>");
    expect(body).toContain("&lt;/title&gt;");
  });
});
