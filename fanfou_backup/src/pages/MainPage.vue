<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { reactive, ref, watch, computed, onMounted, onUnmounted } from "vue";
import { requestFanfous, FANFOU_OWNER, type Fanfou } from "../utils/fanfou";
import ShareModal from "../components/ShareModal.vue";
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
} from "../utils/textUtils";

const route = useRoute();
const router = useRouter();

// ── Helpers ────────────────────────────────────────────────────────────────
const debounce = <T extends (...args: any[]) => unknown>(fn: T, ms: number) => {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>): void => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

// ── Theme ──────────────────────────────────────────────────────────────────
const isDark = ref(false);

const applyTheme = () => {
  document.documentElement.setAttribute("data-theme", isDark.value ? "dark" : "light");
  localStorage.setItem("theme", isDark.value ? "dark" : "light");
};

const toggleTheme = () => {
  isDark.value = !isDark.value;
  applyTheme();
};

const initTheme = () => {
  const saved = localStorage.getItem("theme");
  isDark.value =
    saved !== null ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme();
};

// ── Data ───────────────────────────────────────────────────────────────────
const PER_PAGE_OPTIONS = [10, 15, 20, 30, 50] as const;
type PerPageOption = (typeof PER_PAGE_OPTIONS)[number];

const savedPerPage = localStorage.getItem("perPage");
const perPage = ref<PerPageOption>(
  PER_PAGE_OPTIONS.includes(Number(savedPerPage) as PerPageOption)
    ? (Number(savedPerPage) as PerPageOption)
    : 15
);

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

const currentPage = computed(() => (route.query.page ? Number(route.query.page) : 1));

const rangeArray = (start: number, end: number) =>
  Array(end - start + 1)
    .fill(0)
    .map((_, i) => i + start);

// ── Image lightbox ─────────────────────────────────────────────────────────
const currentImageIndex = ref(-1);

const pageImages = computed(() => {
  if (!data.fanfous.length) return [];
  const range = rangeArray(
    (currentPage.value - 1) * perPage.value,
    Math.min(currentPage.value * perPage.value - 1, data.fanfous.length - 1)
  );
  return range.flatMap((i) => {
    const urls: string[] = [];
    if (data.fanfous[i]?.photo?.largeurl) urls.push(data.fanfous[i].photo!.largeurl);
    if (data.fanfous[i]?.repost_status?.photo?.largeurl)
      urls.push(data.fanfous[i].repost_status!.photo!.largeurl);
    return urls;
  });
});

const clickImage = (url?: string) => {
  if (!url) {
    data.image = undefined;
    currentImageIndex.value = -1;
    return;
  }
  data.image = url;
  currentImageIndex.value = pageImages.value.indexOf(url);
};

const prevImage = (e: Event) => {
  e.stopPropagation();
  const len = pageImages.value.length;
  if (!len) return;
  const idx = (currentImageIndex.value - 1 + len) % len;
  currentImageIndex.value = idx;
  data.image = pageImages.value[idx];
};

const nextImage = (e: Event) => {
  e.stopPropagation();
  const len = pageImages.value.length;
  if (!len) return;
  const idx = (currentImageIndex.value + 1) % len;
  currentImageIndex.value = idx;
  data.image = pageImages.value[idx];
};

// ── Hashtags ───────────────────────────────────────────────────────────────
const hashtags = computed(() => {
  const map = new Map<string, number>();
  for (const f of data.orginFanfous)
    for (const tag of extractTags(f.text)) map.set(tag, (map.get(tag) ?? 0) + 1);
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => ({ tag, count }));
});

const activeTag = ref(route.query.tag ? String(route.query.tag) : "");

const handleContentClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (target.classList.contains("hashtag") && target.dataset.tag) {
    activeTag.value = target.dataset.tag;
    return;
  }
  const anchor = target.closest("a") as HTMLAnchorElement | null;
  if (!anchor) return;
  const href = anchor.getAttribute("href") ?? "";
  const m = href.match(/\/q\/([^/?#\s"]+)/);
  if (m) {
    e.preventDefault();
    activeTag.value = decodeURIComponent(m[1]);
  }
};

const selectTag = (tag: string) => {
  activeTag.value = activeTag.value === tag ? "" : tag;
};

const clearTag = () => {
  activeTag.value = "";
};

// ── Repost filter ──────────────────────────────────────────────────────────
const activeRepost = ref(route.query.repost === "1");

const repostCount = computed(() => data.orginFanfous.filter((f) => !!f.repost_status).length);

const toggleRepost = () => {
  activeRepost.value = !activeRepost.value;
};

// ── Heatmap ────────────────────────────────────────────────────────────────
const activePeriod = ref(route.query.period ? String(route.query.period) : "");
const showHeatmap = ref(false);

const heatmapData = computed(() => {
  const map = new Map<string, number>();
  for (const f of data.orginFanfous) {
    const d = new Date(f.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  const keys = Array.from(map.keys()).sort();
  if (!keys.length) return { years: [] as number[], map };
  const minYear = parseInt(keys[0].split("-")[0]);
  const maxYear = parseInt(keys[keys.length - 1].split("-")[0]);
  const years: number[] = [];
  for (let y = maxYear; y >= minYear; y--) years.push(y);
  return { years, map };
});

const periodKey = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;

const togglePeriod = (period: string) => {
  activePeriod.value = activePeriod.value === period ? "" : period;
};

const formatPeriod = (p: string) => {
  const [y, m] = p.split("-");
  return `${y} 年 ${m} 月`;
};

const clearPeriod = () => {
  activePeriod.value = "";
};

// ── 那年今日 ───────────────────────────────────────────────────────────────
const showOnThisDay = ref(false);
const otdOffset = ref(0); // 0 = today, -1 = yesterday, +1 = tomorrow

const otdDate = computed(() => {
  const d = new Date();
  d.setDate(d.getDate() + otdOffset.value);
  return d;
});

const otdMonth = computed(() => otdDate.value.getMonth() + 1);
const otdDay = computed(() => otdDate.value.getDate());

const otdLabel = computed(() => `${otdMonth.value} 月 ${otdDay.value} 日`);

const onThisDayFanfous = computed(() =>
  data.orginFanfous.filter((f) => isOnThisDay(f.created_at, otdMonth.value, otdDay.value))
);

const onThisDayYear = (createdAt: string) => new Date(createdAt).getFullYear();

// ── Search & filter ────────────────────────────────────────────────────────
const keyword = ref(route.query.keyword ? String(route.query.keyword) : "");
const jumpPage = ref("");

const buildQuery = (page: number) => ({
  page,
  keyword: keyword.value || undefined,
  tag: activeTag.value || undefined,
  period: activePeriod.value || undefined,
  repost: activeRepost.value ? "1" : undefined,
});

const applyFilters = (kw: string, tag: string, period: string, repost: boolean) => {
  let result = data.orginFanfous;
  if (period) result = result.filter((f) => hasPeriod(f.created_at, period));
  if (tag) result = result.filter((f) => hasTag(f.text, tag));
  if (repost) result = result.filter((f) => !!f.repost_status);
  if (kw) result = result.filter((f) => f.text.includes(kw));
  data.fanfous = result;
  data.isEmptyResult =
    result.length === 0 && (kw !== "" || tag !== "" || period !== "" || repost);
  data.totalPages = Math.ceil(result.length / perPage.value);
};

const clearAll = () => {
  keyword.value = "";
  activeTag.value = "";
  activePeriod.value = "";
  activeRepost.value = false;
};

const debouncedKeywordFilter = debounce((val: string) => {
  applyFilters(val, activeTag.value, activePeriod.value, activeRepost.value);
  router.push({ query: buildQuery(1) });
}, 300);

watch(keyword, (val) => debouncedKeywordFilter(val));

watch(activeTag, () => {
  applyFilters(keyword.value, activeTag.value, activePeriod.value, activeRepost.value);
  router.push({ query: buildQuery(1) });
});

watch(activePeriod, () => {
  applyFilters(keyword.value, activeTag.value, activePeriod.value, activeRepost.value);
  router.push({ query: buildQuery(1) });
});

watch(activeRepost, () => {
  applyFilters(keyword.value, activeTag.value, activePeriod.value, activeRepost.value);
  router.push({ query: buildQuery(1) });
});

watch(perPage, (val) => {
  localStorage.setItem("perPage", String(val));
  applyFilters(keyword.value, activeTag.value, activePeriod.value, activeRepost.value);
  router.push({ query: buildQuery(1) });
});

const refresh = () => {
  data.loading = true;
  requestFanfous()
    .then((result) => {
      data.loading = false;
      data.orginFanfous = result.reverse();
      applyFilters(keyword.value, activeTag.value, activePeriod.value, activeRepost.value);
    })
    .catch(() => {
      data.loading = false;
    });
};

// ── Pagination ─────────────────────────────────────────────────────────────
const pageOperate = (operate: number) => {
  const next = currentPage.value + operate;
  let page = next;
  if (next <= 0) page = data.totalPages;
  else if (next > data.totalPages) page = 1;
  if (page !== currentPage.value) {
    router.push({ query: buildQuery(page) }).then(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
};

const doJumpPage = () => {
  const page = parseInt(jumpPage.value);
  if (!isNaN(page) && page >= 1 && page <= data.totalPages && page !== currentPage.value) {
    router.push({ query: buildQuery(page) }).then(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
  jumpPage.value = "";
};

// ── Share ──────────────────────────────────────────────────────────────────
const sharingFanfou = ref<Fanfou | null>(null);

// ── Copy link toast ────────────────────────────────────────────────────────
const toastVisible = ref(false);
let toastTimer: ReturnType<typeof setTimeout>;

const copyCurrentURL = () => {
  navigator.clipboard.writeText(window.location.href);
  toastVisible.value = true;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastVisible.value = false;
  }, 2000);
};

// ── Keyboard ──────────────────────────────────────────────────────────────
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape") {
    if (data.image) {
      clickImage();
      return;
    }
    if (showOnThisDay.value) {
      showOnThisDay.value = false;
      return;
    }
    if (showHeatmap.value) {
      showHeatmap.value = false;
      return;
    }
  }
  if (data.image) {
    if (e.key === "ArrowLeft") prevImage(e);
    if (e.key === "ArrowRight") nextImage(e);
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
  <!-- Share Modal -->
  <ShareModal
    v-if="sharingFanfou"
    :fanfou="sharingFanfou"
    :username="FANFOU_OWNER"
    @close="sharingFanfou = null"
  />

  <!-- 那年今日 Modal -->
  <div v-if="showOnThisDay" class="otd_overlay" @click.self="showOnThisDay = false">
    <div class="otd_modal">
      <div class="otd_header">
        <button class="otd_nav otd_nav--prev" @click="otdOffset--"></button>
        <span class="otd_title">那年今日（{{ otdLabel }}）</span>
        <button class="otd_nav otd_nav--next" @click="otdOffset++"></button>
        <button class="otd_close" @click="showOnThisDay = false">✕</button>
      </div>
      <div v-if="onThisDayFanfous.length" class="otd_list">
        <div class="fanfou otd_item" v-for="(f, i) in onThisDayFanfous" :key="i">
          <div class="otd_year_badge">{{ onThisDayYear(f.created_at) }} 年</div>
          <div
            class="content"
            v-if="getCommentText(f.text, !!f.repost_status).length || !f.repost_status"
            @click="handleContentClick"
            v-html="processText(getCommentText(f.text, !!f.repost_status) || f.text)"
          ></div>
          <div class="photo" v-if="f.photo && !f.repost_status">
            <img :src="f.photo?.largeurl" loading="lazy" @click="clickImage(f.photo?.largeurl)" />
          </div>
          <div class="repost" v-if="f.repost_status">
            <span class="repost_user">@{{ f.repost_status.user.name }}：</span>
            <span class="repost_content" @click="handleContentClick" v-html="processText(f.repost_status.text)"></span>
            <div class="photo" v-if="f.repost_status!.photo">
              <img :src="f.repost_status!.photo?.largeurl" loading="lazy" @click="clickImage(f.repost_status!.photo?.largeurl)" />
            </div>
          </div>
          <div class="post_footer">
            <div class="post_footer_left">
              <span class="time">{{ formattedDate(f.created_at) }}</span>
              <span v-if="f.photo" class="badge">📷</span>
              <span v-if="f.repost_status" class="badge">🔁</span>
            </div>
            <button class="share_btn" @click="sharingFanfou = f" title="分享">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <polyline points="16 6 12 2 8 6"/>
                <line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div v-else class="otd_empty">这一天还没有饭否记录</div>
    </div>
  </div>

  <!-- Lightbox -->
  <div v-if="data.image" class="image_container" @click="clickImage()">
    <button class="image_close" @click.stop="clickImage()">✕</button>
    <button
      v-if="pageImages.length > 1 && currentImageIndex >= 0"
      class="image_nav image_prev"
      @click.stop="prevImage($event)"
    >◀</button>
    <img class="image" :src="data.image" />
    <button
      v-if="pageImages.length > 1 && currentImageIndex >= 0"
      class="image_nav image_next"
      @click.stop="nextImage($event)"
    >▶</button>
    <div v-if="pageImages.length > 1 && currentImageIndex >= 0" class="image_counter">
      {{ currentImageIndex + 1 }} / {{ pageImages.length }}
    </div>
  </div>

  <!-- Toast -->
  <div class="toast" :class="{ visible: toastVisible }">链接已复制</div>

  <main>
    <!-- Header -->
    <div class="header">
      <div>
        <h1>我的饭否备份</h1>
        <h4>
          by:
          <a href="https://github.com/kingcos/fanfou_backup">github.com/kingcos/fanfou_backup</a>
        </h4>
      </div>
      <div class="header_actions">
        <button class="icon_btn" @click="showOnThisDay = !showOnThisDay" title="那年今日">🗓️</button>
        <button class="icon_btn" @click="copyCurrentURL" title="复制当前链接">🔗</button>
        <button
          class="icon_btn"
          @click="toggleTheme"
          :title="isDark ? '切换到亮色模式' : '切换到暗色模式'"
        >{{ isDark ? "☀️" : "🌙" }}</button>
      </div>
    </div>

    <!-- Search -->
    <div class="search_wrap">
      <input
        type="text"
        class="search"
        placeholder="🔍 搜索"
        v-model="keyword"
      />
      <button v-if="keyword" class="search_clear" @click="keyword = ''">✕</button>
    </div>

    <!-- Topics + Repost + Heatmap toggle row -->
    <div class="filter_row" v-if="hashtags.length || heatmapData.years.length || repostCount > 0">
      <div class="tags_scroll" v-if="hashtags.length || repostCount > 0">
        <!-- Repost filter pill -->
        <button
          v-if="repostCount > 0"
          class="tag_pill"
          :class="{ active: activeRepost }"
          @click="toggleRepost"
        >🔁 转发<em>{{ repostCount }}</em><span v-if="activeRepost" class="tag_x">×</span></button>
        <!-- Hashtag pills -->
        <button
          v-for="item in hashtags"
          :key="item.tag"
          class="tag_pill"
          :class="{ active: activeTag === item.tag }"
          @click="selectTag(item.tag)"
        >#{{ item.tag }}<em>{{ item.count }}</em><span v-if="activeTag === item.tag" class="tag_x">×</span></button>
      </div>
      <div class="heatmap_toggle" v-if="heatmapData.years.length" @click="showHeatmap = !showHeatmap">
        <span v-if="activePeriod" class="heatmap_active_badge" @click.stop>
          {{ formatPeriod(activePeriod) }}
          <button class="heatmap_clear_btn" @click.stop="clearPeriod">✕</button>
        </span>
        <span class="heatmap_toggle_label">热力图</span>
        <span class="heatmap_arrow" :class="{ open: showHeatmap }"></span>
      </div>
    </div>

    <!-- Heatmap body -->
    <div class="heatmap_body" v-if="heatmapData.years.length && showHeatmap">
        <div class="hm_grid">
          <!-- 表头：年份横轴 -->
          <div class="hm_row">
            <div class="hm_month_col"></div>
            <div class="hm_year_label" v-for="year in heatmapData.years" :key="year">
              {{ year }}
            </div>
          </div>
          <!-- 数据行：月份纵轴 -->
          <div class="hm_row" v-for="m in 12" :key="m">
            <div class="hm_month_col">{{ m }}月</div>
            <div
              v-for="year in heatmapData.years"
              :key="year"
              class="hm_cell"
              :class="[
                `lv${getHeatLevel(heatmapData.map.get(periodKey(year, m)) ?? 0)}`,
                { active: activePeriod === periodKey(year, m) }
              ]"
              :title="`${year}年${m}月 · ${heatmapData.map.get(periodKey(year, m)) ?? 0} 条`"
              @click="togglePeriod(periodKey(year, m))"
            ></div>
          </div>
        </div>
        <div class="hm_legend">
          <span>少</span>
          <div class="hm_cell lv0"></div>
          <div class="hm_cell lv1"></div>
          <div class="hm_cell lv2"></div>
          <div class="hm_cell lv3"></div>
          <div class="hm_cell lv4"></div>
          <span>多</span>
        </div>
    </div>

    <!-- Results -->
    <div v-if="data.fanfous.length">
      <div class="result_info">
        <span>
          共 {{ data.fanfous.length }} 条
          <template v-if="activePeriod">（{{ formatPeriod(activePeriod) }}）</template>
          <template v-if="activeTag">（话题：#{{ activeTag }}#）</template>
          <template v-if="activeRepost">（转发）</template>
          <template v-if="keyword">（搜索：{{ keyword }}）</template>
        </span>
        <span class="per_page_wrap">
          每页
          <select class="per_page_select" v-model="perPage">
            <option v-for="n in PER_PAGE_OPTIONS" :key="n" :value="n">{{ n }}</option>
          </select>
          条
        </span>
      </div>
      <div
        class="fanfou"
        v-for="(index, key) in rangeArray(
          (currentPage - 1) * perPage,
          Math.min(currentPage * perPage - 1, data.fanfous.length - 1)
        )"
        :key="key"
      >
        <!-- Main content: show only user's own comment for reposts -->
        <div
          class="content"
          v-if="getCommentText(data.fanfous[index].text, !!data.fanfous[index].repost_status).length"
          @click="handleContentClick"
          v-html="processText(getCommentText(data.fanfous[index].text, !!data.fanfous[index].repost_status))"
        ></div>

        <!-- Main photo (non-repost) -->
        <div class="photo" v-if="data.fanfous[index].photo && !data.fanfous[index].repost_status">
          <img
            :src="data.fanfous[index].photo?.largeurl"
            loading="lazy"
            @click="clickImage(data.fanfous[index].photo?.largeurl)"
          />
        </div>

        <!-- Repost -->
        <div class="repost" v-if="data.fanfous[index].repost_status">
          <span class="repost_user">@{{ data.fanfous[index].repost_status!.user.name }}：</span>
          <span
            class="repost_content"
            @click="handleContentClick"
            v-html="processText(data.fanfous[index].repost_status!.text)"
          ></span>
          <div class="photo" v-if="data.fanfous[index].repost_status!.photo">
            <img
              :src="data.fanfous[index].repost_status!.photo?.largeurl"
              loading="lazy"
              @click="clickImage(data.fanfous[index].repost_status!.photo?.largeurl)"
            />
          </div>
        </div>

        <div class="post_footer">
          <div class="post_footer_left">
            <span class="time">{{ formattedDate(data.fanfous[index].created_at) }}</span>
            <span v-if="data.fanfous[index].photo" class="badge">📷</span>
            <span v-if="data.fanfous[index].repost_status" class="badge">🔁</span>
          </div>
          <button class="share_btn" @click="sharingFanfou = data.fanfous[index]" title="分享">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Pager -->
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

    <!-- Skeleton loading -->
    <div v-else-if="data.loading">
      <div class="skeleton_card" v-for="i in 5" :key="i">
        <div class="skeleton_line" style="width: 88%"></div>
        <div class="skeleton_line" style="width: 65%"></div>
        <div class="skeleton_line" style="width: 35%"></div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="data.isEmptyResult" class="empty_state">
      <div class="empty_icon">🔍</div>
      <p class="empty_title">暂无相关内容</p>
      <p class="empty_hint">换个关键词试试，或</p>
      <button class="empty_clear_btn" @click="clearAll">清除所有筛选条件</button>
    </div>

    <!-- Error -->
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

h1 { margin-top: 0; }

.header_actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.icon_btn {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 18px;
  cursor: pointer;
  line-height: 1;

  &:hover {
    background-color: var(--color-background-mute);
    border-color: var(--color-border-hover);
  }
}

// ── 那年今日 弹窗 ─────────────────────────────────────────────────────────────
.otd_overlay {
  position: fixed;
  inset: 0;
  z-index: 150;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.otd_modal {
  width: 100%;
  max-width: 480px;
  max-height: 80vh;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.otd_header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.otd_nav {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  width: 28px;
  height: 28px;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  opacity: 0.6;
  &:hover { background: var(--color-background-mute); opacity: 1; }

  &::after {
    content: "";
    display: block;
    width: 6px;
    height: 6px;
    border-right: 1.5px solid var(--color-text);
    border-bottom: 1.5px solid var(--color-text);
  }

  &.otd_nav--prev::after {
    transform: rotate(135deg) translate(1px, -1px);
  }

  &.otd_nav--next::after {
    transform: rotate(-45deg) translate(-1px, 1px);
  }
}

.otd_title {
  flex: 1;
  text-align: center;
  font-size: 0.9rem;
  font-weight: 600;
  opacity: 0.8;
}

.otd_close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  opacity: 0.4;
  padding: 2px 4px;
  color: var(--color-text);
  &:hover { opacity: 0.9; }
}

.otd_list {
  overflow-y: auto;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.otd_item {
  margin-top: 0 !important;
}

.otd_year_badge {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--vt-c-indigo);
  opacity: 0.75;
  margin-bottom: 4px;
}

.otd_empty {
  padding: 32px 20px;
  text-align: center;
  font-size: small;
  opacity: 0.45;
}

// ── Search ──────────────────────────────────────────────────────────────────
.search_wrap {
  position: relative;
  margin-top: 12px;
}

.search {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 6px 36px 6px 12px;
  font-size: 1rem;
  width: 100%;
  background-color: var(--color-background-soft);
  color: var(--color-text);

  &::placeholder { opacity: 0.5; }
  &:focus { outline: none; border-color: var(--color-border-hover); }
}

.search_clear {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text);
  opacity: 0.4;
  padding: 2px 4px;

  &:hover { opacity: 0.8; }
}

// ── Tags / Topics ────────────────────────────────────────────────────────────
.filter_row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}

.tags_scroll {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 2px;
  -webkit-mask-image: linear-gradient(to right, black 88%, transparent 100%);
  mask-image: linear-gradient(to right, black 88%, transparent 100%);

  &::-webkit-scrollbar { display: none; }
}

.tag_pill {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 11px;
  border-radius: 20px;
  border: 1px solid var(--color-border);
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  background: transparent;
  color: var(--color-text);
  transition: background 0.15s, border-color 0.15s;

  em {
    font-style: normal;
    font-size: 11px;
    opacity: 0.38;
  }

  &:hover:not(.active) {
    background: var(--color-background-mute);
    border-color: var(--color-border-hover);
  }

  &.active {
    background: var(--vt-c-indigo);
    border-color: var(--vt-c-indigo);
    color: #fff;
    em { opacity: 0.65; }
  }
}

.tag_x {
  font-style: normal;
  font-size: 12px;
  opacity: 0.75;
  margin-left: 1px;
  line-height: 1;
}


// ── Result info ─────────────────────────────────────────────────────────────
.result_info {
  margin-top: 16px;
  font-size: small;
  opacity: 0.6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.per_page_wrap {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.per_page_select {
  background: var(--color-background-soft);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 1px 4px;
  font-size: small;
  cursor: pointer;
  &:focus { outline: none; border-color: var(--color-border-hover); }
}

// ── Post card ───────────────────────────────────────────────────────────────
.fanfou {
  margin-top: 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 12px;
  font-size: 1rem;
  line-height: 1.7;
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
      &:hover { opacity: 0.85; }
    }
  }
}

.post_footer_left {
  display: flex;
  align-items: center;
  gap: 5px;
}

.badge {
  font-size: 11px;
  opacity: 0.4;
}

.content {
  overflow-wrap: break-word;
}

.repost {
  margin-top: 8px;
  padding: 8px 10px;
  border-left: 3px solid var(--color-border);
  border-radius: 0 6px 6px 0;
  background-color: var(--color-background-mute);
  font-size: 0.9rem;
  overflow-wrap: break-word;
}

.repost_user {
  font-size: 0.85rem;
  opacity: 0.7;
  font-weight: 500;
}

.post_footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.time {
  font-size: 0.75rem;
  opacity: 0.45;
}

.share_btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  color: var(--color-text);
  opacity: 0;
  transition: opacity 0.15s;
  display: flex;
  align-items: center;

  &:hover { opacity: 0.7 !important; }
}

.fanfou:hover .share_btn {
  opacity: 0.3;
}

.otd_item .share_btn {
  opacity: 0.3;
}

// ── Pager ───────────────────────────────────────────────────────────────────
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
  &::-webkit-outer-spin-button { -webkit-appearance: none; }
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

// ── Skeleton ────────────────────────────────────────────────────────────────
.skeleton_card {
  margin-top: 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 14px 12px;
  background-color: var(--color-background-soft);
}

.skeleton_line {
  height: 13px;
  border-radius: 4px;
  margin-bottom: 10px;
  background: linear-gradient(
    90deg,
    var(--color-background-mute) 25%,
    var(--color-border-hover) 50%,
    var(--color-background-mute) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;

  &:last-child { margin-bottom: 0; }
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

// ── Empty state ─────────────────────────────────────────────────────────────
.empty_state {
  margin-top: 60px;
  text-align: center;
  padding: 0 20px;
}

.empty_icon { font-size: 48px; margin-bottom: 12px; }

.empty_title {
  font-size: 1.1rem;
  margin-bottom: 6px;
}

.empty_hint {
  font-size: small;
  opacity: 0.55;
  margin-bottom: 14px;
}

.empty_clear_btn {
  border: 1px solid var(--color-border);
  border-radius: 20px;
  padding: 6px 18px;
  font-size: small;
  background: none;
  color: var(--color-text);
  cursor: pointer;

  &:hover {
    background-color: var(--color-background-mute);
    border-color: var(--color-border-hover);
  }
}

// ── Lightbox ─────────────────────────────────────────────────────────────────
.image_container {
  position: fixed;
  z-index: 300;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.9);
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
  z-index: 2;
  &:hover { background: rgba(255, 255, 255, 0.35); }
}

.image_nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.25);
  border: none;
  color: white;
  font-size: 22px;
  width: 44px;
  height: 72px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  line-height: 1;
  &:hover { background: rgba(255, 255, 255, 0.4); }
}

.image_prev { left: 12px; }
.image_next { right: 12px; }

.image_counter {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.7);
  font-size: small;
  z-index: 2;
}

.image {
  max-width: 80%;
  max-height: 85%;
  object-fit: contain;
  border-radius: 4px;
  position: relative;
  z-index: 1;
}

// ── Heatmap ──────────────────────────────────────────────────────────────────
.heatmap_toggle {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.heatmap_toggle_label {
  font-size: 13px;
  opacity: 0.5;
  font-weight: 500;
}

.heatmap_arrow {
  display: inline-block;
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  opacity: 0.55;
  transform: rotate(45deg) translateY(-2px);
  transition: transform 0.2s ease;

  &.open {
    transform: rotate(-135deg) translateY(-2px);
  }
}

.heatmap_active_badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  background: var(--color-background-mute);
  border: 1px solid var(--color-border);
  border-radius: 20px;
  padding: 1px 8px 1px 10px;
}

.heatmap_clear_btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 10px;
  opacity: 0.5;
  padding: 0;
  color: var(--color-text);
  &:hover { opacity: 1; }
}

.heatmap_body {
  margin-top: 6px;
  overflow-x: auto;
}

.hm_grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  min-width: max-content;
}

.hm_row {
  display: flex;
  align-items: center;
  gap: 3px;
}

// 月份标签列（纵轴）
.hm_month_col {
  width: 28px;
  flex-shrink: 0;
  font-size: 10px;
  opacity: 0.38;
  text-align: right;
  padding-right: 3px;
}

// 年份标签行（横轴）
.hm_year_label {
  flex: 1;
  font-size: 10px;
  opacity: 0.38;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: clip;
}

.hm_cell {
  flex: 1;
  height: 14px;
  min-width: 14px;
  border-radius: 2px;
  cursor: pointer;
  transition: opacity 0.12s;

  &.lv0 { background: var(--color-background-mute); cursor: default; }
  &.lv1 { background: hsla(160, 55%, 50%, 0.28); }
  &.lv2 { background: hsla(160, 60%, 46%, 0.55); }
  &.lv3 { background: hsla(160, 65%, 40%, 0.8); }
  &.lv4 { background: hsla(160, 70%, 36%, 1); }

  &:not(.lv0):hover { opacity: 0.68; }

  &.active {
    outline: 2px solid var(--vt-c-indigo);
    outline-offset: 1px;
  }
}

.hm_legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
  margin-top: 8px;

  span { font-size: 10px; opacity: 0.38; }

  .hm_cell {
    width: 11px;
    height: 11px;
    cursor: default;
    &.active { outline: none; }
  }
}

// ── Toast ────────────────────────────────────────────────────────────────────
.toast {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%) translateY(20px);
  background: var(--vt-c-indigo);
  color: white;
  padding: 8px 20px;
  border-radius: 20px;
  font-size: small;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s, transform 0.25s;
  z-index: 100;

  &.visible {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
</style>

<style>
/* 穿透 scoped：帖子内容由 v-html 注入 */
.content a[href*="/q/"],
.repost_content a[href*="/q/"] {
  color: hsla(160, 100%, 37%, 1);
  cursor: pointer;
  font-weight: 500;
  text-decoration: none;
}
.content a[href*="/q/"]:hover,
.repost_content a[href*="/q/"]:hover {
  text-decoration: underline;
}
.content .hashtag,
.repost_content .hashtag {
  color: hsla(160, 100%, 37%, 1);
  cursor: pointer;
  font-weight: 500;
}
.content .hashtag:hover,
.repost_content .hashtag:hover {
  text-decoration: underline;
}
</style>
