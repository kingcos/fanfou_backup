import { describe, it, expect } from "vitest";
import {
  escapeRegExp,
  extractTags,
  processText,
  hasTag,
  hasPeriod,
  formattedDate,
  getHeatLevel,
  getCommentText,
  isOnThisDay,
} from "../textUtils";

// ── escapeRegExp ──────────────────────────────────────────────────────────────
describe("escapeRegExp", () => {
  it("escapes special regex characters", () => {
    expect(escapeRegExp("a.b*c")).toBe("a\\.b\\*c");
    expect(escapeRegExp("(hello)")).toBe("\\(hello\\)");
    expect(escapeRegExp("no specials")).toBe("no specials");
  });
});

// ── extractTags ───────────────────────────────────────────────────────────────
describe("extractTags", () => {
  it("extracts hashtags from plain text", () => {
    const tags = extractTags("今天吃了 #拉面 好好吃 #周末");
    expect(tags.has("拉面")).toBe(true);
    expect(tags.has("周末")).toBe(true);
  });

  it("extracts tags from fanfou link hrefs", () => {
    const tags = extractTags('<a href="/q/%E5%91%A8%E6%9C%AB">周末</a>');
    expect(tags.has("周末")).toBe(true);
  });

  it("returns empty set for text with no tags", () => {
    expect(extractTags("普通文字").size).toBe(0);
  });

  it("does not duplicate tags from both href and plain text", () => {
    const text = '<a href="/q/%E6%97%85%E8%A1%8C">#旅行</a>';
    const tags = extractTags(text);
    expect(tags.size).toBe(1);
    expect(tags.has("旅行")).toBe(true);
  });
});

// ── processText ───────────────────────────────────────────────────────────────
describe("processText", () => {
  it("wraps hashtags in span elements", () => {
    const result = processText("今天 #晴天 心情好");
    expect(result).toContain('<span class="hashtag" data-tag="晴天">#晴天</span>');
  });

  it("preserves existing HTML tags", () => {
    const result = processText('<a href="/q/test">link</a>');
    expect(result).toBe('<a href="/q/test">link</a>');
  });

  it("wraps hashtag text content even inside anchor tags", () => {
    // The regex replaces #tag text regardless of surrounding HTML structure.
    // The HTML tag itself (<a href="...">) is preserved, and the #tag text is wrapped.
    const result = processText('<a href="/q/%E6%B5%8B%E8%AF%95">#测试</a>');
    expect(result).toContain('<span class="hashtag" data-tag="测试">#测试</span>');
    expect(result).toContain('<a href="/q/%E6%B5%8B%E8%AF%95">');
  });
});

// ── hasTag ────────────────────────────────────────────────────────────────────
describe("hasTag", () => {
  it("matches a hashtag in plain text", () => {
    expect(hasTag("今天吃了 #拉面 好好吃", "拉面")).toBe(true);
  });

  it("returns false when tag not present", () => {
    expect(hasTag("今天天气好", "拉面")).toBe(false);
  });

  it("matches tag encoded in href", () => {
    const text = '<a href="/q/%E5%91%A8%E6%9C%AB">周末</a>';
    expect(hasTag(text, "周末")).toBe(true);
  });

  it("does not partially match tags", () => {
    expect(hasTag("今天 #美食日记 开始了", "美食")).toBe(false);
  });
});

// ── hasPeriod ─────────────────────────────────────────────────────────────────
describe("hasPeriod", () => {
  it("matches correct year-month", () => {
    expect(hasPeriod("Mon Jan 15 10:00:00 +0000 2024", "2024-01")).toBe(true);
  });

  it("does not match wrong month", () => {
    expect(hasPeriod("Mon Jan 15 10:00:00 +0000 2024", "2024-02")).toBe(false);
  });

  it("does not match wrong year", () => {
    expect(hasPeriod("Mon Jan 15 10:00:00 +0000 2023", "2024-01")).toBe(false);
  });
});

// ── formattedDate ─────────────────────────────────────────────────────────────
describe("formattedDate", () => {
  it("formats a date string into Chinese format", () => {
    // Use a fixed UTC date to avoid timezone issues
    const result = formattedDate(new Date(2024, 0, 5, 9, 8).toString());
    expect(result).toContain("2024 年");
    expect(result).toContain("01 月");
    expect(result).toContain("05 日");
    expect(result).toContain("09:08");
  });
});

// ── getHeatLevel ──────────────────────────────────────────────────────────────
describe("getHeatLevel", () => {
  it("returns 0 for 0 posts", () => expect(getHeatLevel(0)).toBe(0));
  it("returns 1 for 1-2 posts", () => {
    expect(getHeatLevel(1)).toBe(1);
    expect(getHeatLevel(2)).toBe(1);
  });
  it("returns 2 for 3-8 posts", () => {
    expect(getHeatLevel(3)).toBe(2);
    expect(getHeatLevel(8)).toBe(2);
  });
  it("returns 3 for 9-20 posts", () => {
    expect(getHeatLevel(9)).toBe(3);
    expect(getHeatLevel(20)).toBe(3);
  });
  it("returns 4 for 21+ posts", () => expect(getHeatLevel(21)).toBe(4));
});

// ── getCommentText ────────────────────────────────────────────────────────────
describe("getCommentText", () => {
  const A = '<a href="https://fanfou.com/user" class="former">user</a>';

  it("returns original text when no repost", () => {
    expect(getCommentText("普通帖子", false)).toBe("普通帖子");
  });

  it("returns empty string for pure repost (starts with 转@<)", () => {
    expect(getCommentText(`转@${A} 原文内容`, true)).toBe("");
  });

  it("extracts comment when separated by space before 转@<", () => {
    expect(getCommentText(`我的评论 转@${A} 原文`, true)).toBe("我的评论");
  });

  it("extracts comment when separator has no space (e.g. period直连)", () => {
    expect(getCommentText(`收场了。转@${A} 原文`, true)).toBe("收场了。");
  });

  it("extracts comment when separated by newlines before 转@<", () => {
    expect(getCommentText(`好帖。\n\n转@${A} 原文`, true)).toBe("好帖。");
  });

  it("extracts comment for RT@ variant", () => {
    expect(getCommentText(`我的评论 RT@${A} 原文`, true)).toBe("我的评论");
  });

  it("returns empty string when original post is hidden (抱歉 notice)", () => {
    expect(getCommentText("抱歉，饭友已设置仅展示三个月内饭否，此条饭否已不可见", true)).toBe("");
  });

  it("returns full text when no repost chain marker found (e.g. link-only repost)", () => {
    const text = '开源在：<a href="https://github.com/foo" rel="nofollow">GitHub</a>';
    expect(getCommentText(text, true)).toBe(text);
  });
});

// ── isOnThisDay ───────────────────────────────────────────────────────────────
describe("isOnThisDay", () => {
  it("returns true when month and day match", () => {
    const date = new Date(2020, 2, 15).toString(); // March 15
    expect(isOnThisDay(date, 3, 15)).toBe(true);
  });

  it("returns false when month does not match", () => {
    const date = new Date(2020, 2, 15).toString();
    expect(isOnThisDay(date, 4, 15)).toBe(false);
  });

  it("returns false when day does not match", () => {
    const date = new Date(2020, 2, 15).toString();
    expect(isOnThisDay(date, 3, 16)).toBe(false);
  });

  it("matches across different years", () => {
    const date2018 = new Date(2018, 5, 1).toString(); // June 1
    const date2022 = new Date(2022, 5, 1).toString(); // June 1
    expect(isOnThisDay(date2018, 6, 1)).toBe(true);
    expect(isOnThisDay(date2022, 6, 1)).toBe(true);
  });
});
