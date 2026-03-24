<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { reactive, ref, watch, computed, onMounted, onUnmounted } from "vue";
import { requestFanfous, type Fanfou } from "../utils/fanfou";

const route = useRoute();
const router = useRouter();

const currentPage = computed(() => {
  return route.query.page ? Number(route.query.page) : 1;
});

const rangeArray = (start: number, end: number) => {
  return Array(end - start + 1)
    .fill(0)
    .map((_, i) => i + start);
};

const PER_PAGE: number = 15;

const data = reactive<{
  orginFanfous: Fanfou[];
  fanfous: Fanfou[];
  totalPages: number;
  loading: boolean;
  image?: string;
  isEmptyResult: boolean;
}>({
  orginFanfous: [],
  fanfous: [],
  totalPages: 0,
  loading: false,
  isEmptyResult: false,
});

// ── Theme ──────────────────────────────────────────────────────────────────
const isDark = ref(false);

const applyTheme = () => {
  document.documentElement.setAttribute(
    "data-theme",
    isDark.value ? "dark" : "light"
  );
  localStorage.setItem("theme", isDark.value ? "dark" : "light");
};

const toggleTheme = () => {
  isDark.value = !isDark.value;
  applyTheme();
};

const initTheme = () => {
  const saved = localStorage.getItem("theme");
  isDark.value =
    saved !== null
      ? saved === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme();
};

// ── Hashtags ───────────────────────────────────────────────────────────────
const HASHTAG_RE = /#([^#<>\s]+)#/g;


const hashtags = computed(() => {
  const map = new Map<string, number>();
  for (const fanfou of data.orginFanfous) {
    for (const match of fanfou.text.matchAll(HASHTAG_RE)) {
      const tag = match[1];
      map.set(tag, (map.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => ({ tag, count }));
});

const showTopics = ref(false);

const handleContentClick = (e: MouseEvent) => {
  const anchor = (e.target as HTMLElement).closest("a") as HTMLAnchorElement | null;
  if (!anchor) return;
  const href = anchor.getAttribute("href") ?? "";
  const match = href.match(/\/q\/([^/?#]+)/);
  if (match) {
    e.preventDefault();
    keyword.value = `#${decodeURIComponent(match[1])}#`;
  }
};

const selectTag = (tag: string) => {
  keyword.value = `#${tag}#`;
  showTopics.value = false;
};

// ── Search & filter ────────────────────────────────────────────────────────
const keyword = ref(route.query.keyword ? String(route.query.keyword) : "");
const jumpPage = ref("");

watch(keyword, (newValue) => {
  if (newValue === "") {
    data.fanfous = data.orginFanfous;
  } else {
    data.fanfous = data.orginFanfous.filter((fanfou) =>
      fanfou.text.includes(newValue)
    );
  }
  data.isEmptyResult = data.fanfous.length === 0 && newValue !== "";
  data.totalPages = Math.ceil(data.fanfous.length / PER_PAGE);
  router.push({ query: { page: 1, keyword: newValue || undefined } });
});

const refresh = () => {
  data.loading = true;
  requestFanfous()
    .then((result) => {
      data.loading = false;
      data.orginFanfous = result.reverse();
      data.fanfous = keyword.value
        ? data.orginFanfous.filter((fanfou) =>
            fanfou.text.includes(keyword.value)
          )
        : data.orginFanfous;
      data.isEmptyResult = data.fanfous.length === 0 && keyword.value !== "";
      data.totalPages = Math.ceil(data.fanfous.length / PER_PAGE);
    })
    .catch(() => {
      data.loading = false;
    });
};

// ── Pagination ─────────────────────────────────────────────────────────────
const pageOperate = (operate: number) => {
  const next = currentPage.value + operate;
  let page = next;
  if (next <= 0) {
    page = data.totalPages;
  } else if (next > data.totalPages) {
    page = 1;
  }
  if (page !== currentPage.value) {
    router
      .push({ query: { page, keyword: keyword.value || undefined } })
      .then(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
  }
};

const doJumpPage = () => {
  const page = parseInt(jumpPage.value);
  if (
    !isNaN(page) &&
    page >= 1 &&
    page <= data.totalPages &&
    page !== currentPage.value
  ) {
    router
      .push({ query: { page, keyword: keyword.value || undefined } })
      .then(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
  }
  jumpPage.value = "";
};

// ── Utils ──────────────────────────────────────────────────────────────────
const formattedDate = (dateString: string) => {
  const date = new Date(dateString);
  const year = date.getFullYear() + " 年 ";
  const month = (date.getMonth() + 1).toString().padStart(2, "0") + " 月 ";
  const day = date.getDate().toString().padStart(2, "0") + " 日 ";
  const hour = date.getHours().toString().padStart(2, "0") + ":";
  const minute = date.getMinutes().toString().padStart(2, "0");
  return year + month + day + hour + minute;
};

const clickImage = (url?: string) => {
  data.image = url;
};

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape") {
    if (data.image) {
      data.image = undefined;
    } else if (showTopics.value) {
      showTopics.value = false;
    }
  }
};

onMounted(() => {
  initTheme();
  window.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});

refresh();
</script>

<template>
  <div v-if="data.image" class="image_container" @click="clickImage()">
    <button class="image_close" @click.stop="clickImage()">✕</button>
    <img class="image" :src="data.image" />
  </div>

  <main>
    <div class="header">
      <div>
        <h1>我的饭否备份</h1>
        <h4>
          by:
          <a href="https://github.com/kingcos/fanfou_backup"
            >github.com/kingcos/fanfou_backup</a
          >
        </h4>
      </div>
      <button class="theme_btn" @click="toggleTheme" :title="isDark ? '切换到亮色模式' : '切换到暗色模式'">
        {{ isDark ? "☀️" : "🌙" }}
      </button>
    </div>

    <input
      type="text"
      class="search"
      placeholder="🔍 搜索"
      v-model="keyword"
    />

    <div v-if="hashtags.length" class="topics_bar">
      <button class="topics_toggle" @click="showTopics = !showTopics">
        # 话题 {{ showTopics ? "▲" : "▼" }}
      </button>
      <span
        v-if="keyword && keyword.startsWith('#') && keyword.endsWith('#')"
        class="active_tag"
      >
        {{ keyword }}
        <span class="clear_tag" @click="keyword = ''">✕</span>
      </span>
    </div>

    <div v-if="showTopics" class="topics_panel">
      <span
        v-for="item in hashtags"
        :key="item.tag"
        class="topic_chip"
        :class="{ active: keyword === `#${item.tag}#` }"
        @click="selectTag(item.tag)"
      >
        #{{ item.tag }}#
        <em>{{ item.count }}</em>
      </span>
    </div>

    <div v-if="data.fanfous.length">
      <div class="result_info">
        共 {{ data.fanfous.length }} 条
        <template v-if="keyword">（搜索：{{ keyword }}）</template>
      </div>
      <div
        class="fanfou"
        v-for="(index, key) in rangeArray(
          (currentPage - 1) * PER_PAGE,
          Math.min(currentPage * PER_PAGE - 1, data.fanfous.length - 1)
        )"
        :key="key"
      >
        <div
          class="content"
          v-if="data.fanfous[index].text.length"
          @click="handleContentClick"
          v-html="data.fanfous[index].text"
        ></div>
        <div class="photo" v-if="data.fanfous[index].photo">
          <img
            :src="data.fanfous[index].photo?.largeurl"
            loading="lazy"
            @click="clickImage(data.fanfous[index].photo?.largeurl)"
          />
        </div>
        <span class="time">{{
          formattedDate(data.fanfous[index].created_at)
        }}</span>
      </div>
      <div class="pager">
        <div @click="pageOperate(-1)" class="pager_btn">上一页</div>
        <div class="pages">{{ currentPage }} / {{ data.totalPages }}</div>
        <div @click="pageOperate(1)" class="pager_btn">下一页</div>
        <div class="jump">
          <input
            class="jump_input"
            type="number"
            v-model="jumpPage"
            placeholder="跳至"
            @keyup.enter="doJumpPage"
          />
          <div class="jump_btn" @click="doJumpPage">GO</div>
        </div>
      </div>
    </div>
    <div class="fanfou" v-else-if="data.loading">正在加载，请稍等...</div>
    <div v-else-if="data.isEmptyResult">
      <div class="fanfou">暂无相关内容，请重新输入搜索关键词</div>
    </div>
    <div v-else>
      <div class="fanfou clickable" @click="refresh">
        网络似乎出现问题，无法加载内容，请点此刷新重试
      </div>
    </div>
  </main>
</template>

<style lang="scss" scoped>
.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-top: 20px;
}

h1 {
  margin-top: 0;
}

.theme_btn {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
  flex-shrink: 0;

  &:hover {
    background-color: var(--color-background-mute);
    border-color: var(--color-border-hover);
  }
}

.result_info {
  margin-top: 16px;
  font-size: small;
  color: var(--color-text);
  opacity: 0.6;
}

.fanfou {
  margin-top: 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 12px;
  font-size: large;
  background-color: var(--color-background-soft);

  &.clickable {
    cursor: pointer;

    &:hover {
      border-color: var(--color-border-hover);
      background-color: var(--color-background-mute);
    }
  }

  .photo {
    margin-top: 8px;

    img {
      width: 50%;
      max-width: 240px;
      aspect-ratio: 1;
      object-fit: cover;
      border-radius: 6px;
      cursor: pointer;

      &:hover {
        opacity: 0.85;
      }
    }
  }
}

.time {
  display: block;
  margin-top: 8px;
  font-size: x-small;
  opacity: 0.5;
}

.pager {
  margin-top: 20px;
  margin-bottom: 20px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.pager_btn {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 5px 14px;
  cursor: pointer;

  &:hover {
    background-color: var(--color-background-mute);
    border-color: var(--color-border-hover);
  }
}

.pages {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 5px 14px;
  text-align: center;
}

.jump {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
}

.jump_input {
  width: 56px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 5px 8px;
  font-size: small;
  text-align: center;
  background-color: var(--color-background-soft);
  color: var(--color-text);

  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button {
    -webkit-appearance: none;
  }
}

.jump_btn {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 5px 10px;
  font-size: small;
  cursor: pointer;

  &:hover {
    background-color: var(--color-background-mute);
    border-color: var(--color-border-hover);
  }
}

.content {
  overflow-wrap: break-word;
}

.search {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 6px 12px;
  font-size: medium;
  margin-top: 12px;
  width: 100%;
  background-color: var(--color-background-soft);
  color: var(--color-text);

  &::placeholder {
    opacity: 0.5;
  }

  &:focus {
    outline: none;
    border-color: var(--color-border-hover);
  }
}

.topics_bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}

.topics_toggle {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 3px 10px;
  font-size: small;
  cursor: pointer;
  color: var(--color-text);

  &:hover {
    background-color: var(--color-background-mute);
    border-color: var(--color-border-hover);
  }
}

.active_tag {
  font-size: small;
  background-color: var(--color-background-mute);
  border: 1px solid var(--color-border);
  border-radius: 20px;
  padding: 2px 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.clear_tag {
  cursor: pointer;
  opacity: 0.6;
  font-size: 11px;

  &:hover {
    opacity: 1;
  }
}

.topics_panel {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background-color: var(--color-background-soft);
}

.topic_chip {
  font-size: small;
  border: 1px solid var(--color-border);
  border-radius: 20px;
  padding: 3px 10px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;

  em {
    font-style: normal;
    opacity: 0.5;
    font-size: 11px;
  }

  &:hover {
    background-color: var(--color-background-mute);
    border-color: var(--color-border-hover);
  }

  &.active {
    background-color: var(--vt-c-indigo);
    color: white;
    border-color: var(--vt-c-indigo);

    em {
      opacity: 0.8;
    }
  }
}

.image_container {
  position: fixed;
  z-index: 99;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.9);
  left: 0;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.image_close {
  position: absolute;
  top: 16px;
  right: 16px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  font-size: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(255, 255, 255, 0.35);
  }
}

.image {
  max-width: 90%;
  max-height: 90%;
  object-fit: contain;
  border-radius: 4px;
}
</style>

<style>
/* 穿透 scoped：帖子内容由 v-html 注入，Fanfou 原生话题链接样式 */
.content a[href*="/q/"] {
  color: hsla(160, 100%, 37%, 1);
  cursor: pointer;
  font-weight: 500;
  text-decoration: none;
}
.content a[href*="/q/"]:hover {
  text-decoration: underline;
}
</style>
