// Pure utility functions extracted from MainPage.vue for testability

export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const TAG_LINK_RE = /href="[^"]*\/q\/([^"/?&\s]+)"/g;
const TEXT_TAG_RE = /#([^#\s，。！？,.!?<>]+)/g;

export const extractTags = (text: string): Set<string> => {
  const tags = new Set<string>();
  for (const m of text.matchAll(new RegExp(TAG_LINK_RE.source, "g")))
    tags.add(decodeURIComponent(m[1]));
  const plain = text.replace(/<[^>]*>/g, " ");
  for (const m of plain.matchAll(new RegExp(TEXT_TAG_RE.source, "g"))) tags.add(m[1]);
  return tags;
};

export const processText = (text: string): string =>
  text.replace(/(<[^>]*>)|#([^#\s，。！？,.!?<>]+)/g, (match, htmlTag, tagName) => {
    if (htmlTag) return htmlTag;
    return `<span class="hashtag" data-tag="${tagName}">#${tagName}</span>`;
  });

export const hasTag = (text: string, tag: string): boolean => {
  const encoded = encodeURIComponent(tag);
  if (text.includes(`/q/${encoded}`) || text.includes(`/q/${tag}`)) return true;
  const plain = text.replace(/<[^>]*>/g, " ");
  return new RegExp(`#${escapeRegExp(tag)}(?:#|(?=[\\s，。！？,.!?]|$))`).test(plain);
};

export const hasPeriod = (createdAt: string, period: string): boolean => {
  const d = new Date(createdAt);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === period;
};

export const formattedDate = (dateString: string): string => {
  const d = new Date(dateString);
  return (
    d.getFullYear() +
    " 年 " +
    (d.getMonth() + 1).toString().padStart(2, "0") +
    " 月 " +
    d.getDate().toString().padStart(2, "0") +
    " 日 " +
    d.getHours().toString().padStart(2, "0") +
    ":" +
    d.getMinutes().toString().padStart(2, "0")
  );
};

export const getHeatLevel = (count: number): number => {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 8) return 2;
  if (count <= 20) return 3;
  return 4;
};

/**
 * For a repost, extract the user's own comment before the repost chain.
 * Real Fanfou formats observed in data:
 *   - Pure repost:           "转@<a href=...>user</a> original_text"
 *   - Repost with comment:   "my comment转@<a href=...>user</a> ..."
 *                            "my comment 转@<a href=...>user</a> ..."
 *                            "my comment\n\n转@<a href=...>user</a> ..."
 *   - RT@ variant:           "my comment RT@<a href=...>user</a> ..."
 *   - Original hidden:       "抱歉，饭友已设置仅展示三个月内饭否，此条饭否已不可见"
 * Returns empty string when there is no user comment (pure repost / hidden).
 */
export const getCommentText = (text: string, hasRepost: boolean): string => {
  if (!hasRepost) return text;
  // Original hidden by privacy setting
  if (text.startsWith("抱歉")) return "";
  // Find the first "转@<" or "RT@<" repost chain marker
  const match = text.match(/转@<|RT@</);
  if (match && match.index !== undefined) {
    return text.substring(0, match.index).trim();
  }
  return text;
};

/**
 * Check if a post was created on a given month+day (any year).
 */
export const isOnThisDay = (createdAt: string, month: number, day: number): boolean => {
  const d = new Date(createdAt);
  return d.getMonth() + 1 === month && d.getDate() === day;
};
