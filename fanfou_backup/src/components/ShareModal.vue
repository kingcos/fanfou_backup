<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import html2canvas from "html2canvas";
import { processText, getCommentText, formattedDate } from "../utils/textUtils";
import type { Fanfou } from "../utils/fanfou";

const props = defineProps<{ fanfou: Fanfou; username?: string }>();
const emit = defineEmits<{ (e: "close"): void }>();

const cardRef = ref<HTMLElement | null>(null);
const saving = ref(false);
const cropPhoto = ref(true);
const iosImageUrl = ref("");

const commentText = getCommentText(props.fanfou.text, !!props.fanfou.repost_status);
const mainText = props.fanfou.repost_status ? commentText : props.fanfou.text;
const repost = props.fanfou.repost_status ?? null;
const mainPhoto = props.fanfou.repost_status ? null : props.fanfou.photo ?? null;
const hasPhoto = !!(mainPhoto || repost?.photo);

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

const renderCanvas = () =>
  Promise.race([
    html2canvas(cardRef.value!, { useCORS: true, scale: 2, backgroundColor: null }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 12000)),
  ]);

const saveImage = async () => {
  if (!cardRef.value || saving.value) return;
  saving.value = true;
  iosImageUrl.value = "";
  try {
    const canvas = await renderCanvas();

    // iOS: try Web Share API (iOS 15+), fall back to long-press hint
    if (isIOS) {
      if (navigator.share) {
        const blob = await new Promise<Blob>((res, rej) =>
          canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/png")
        );
        const file = new File([blob], "fanfou.png", { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file] });
          return;
        }
      }
      // Fallback: show image for long-press save
      iosImageUrl.value = canvas.toDataURL("image/png");
    } else {
      const link = document.createElement("a");
      link.download = `fanfou-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    }
  } catch (e) {
    console.error("Save failed:", e);
  } finally {
    saving.value = false;
  }
};

// Body scroll lock
const lockScroll = () => {
  const y = window.scrollY;
  document.body.dataset.scrollY = String(y);
  document.body.style.position = "fixed";
  document.body.style.top = `-${y}px`;
  document.body.style.width = "100%";
};
const unlockScroll = () => {
  const y = Number(document.body.dataset.scrollY ?? 0);
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.width = "";
  window.scrollTo(0, y);
};

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape") emit("close");
};
onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  lockScroll();
});
onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
  unlockScroll();
});
</script>

<template>
  <div class="sm_overlay" @click.self="emit('close')" @touchmove.prevent>
    <div class="sm_wrapper" @touchmove.stop>
      <!-- Preview card -->
      <div class="sm_card" ref="cardRef">
        <div class="sm_card_inner">
          <div v-if="mainText" class="sm_content" v-html="processText(mainText)"></div>

          <div v-if="mainPhoto" class="sm_photo_wrap" :class="{ crop: cropPhoto }">
            <img class="sm_photo" :src="mainPhoto.largeurl" crossorigin="anonymous" />
          </div>

          <div v-if="repost" class="sm_repost">
            <div class="sm_repost_user">@{{ repost.user.name }}</div>
            <div class="sm_repost_text" v-html="processText(repost.text)"></div>
            <div v-if="repost.photo" class="sm_photo_wrap sm_photo_wrap--repost" :class="{ crop: cropPhoto }">
              <img class="sm_photo" :src="repost.photo.largeurl" crossorigin="anonymous" />
            </div>
          </div>

          <div class="sm_footer">
            <div class="sm_footer_left">
              <span v-if="username" class="sm_username">@{{ username }}</span>
              <span class="sm_time">{{ formattedDate(fanfou.created_at) }}</span>
            </div>
            <span class="sm_brand">饭否</span>
          </div>
        </div>
      </div>

      <!-- iOS long-press hint -->
      <div v-if="iosImageUrl" class="sm_ios_hint">
        <p class="sm_ios_hint_text">长按图片保存到相册</p>
        <img class="sm_ios_img" :src="iosImageUrl" />
      </div>

      <!-- Actions -->
      <div class="sm_actions">
        <button class="sm_action_btn sm_save" :disabled="saving" @click="saveImage">
          {{ saving ? "保存中…" : "保存图片" }}
        </button>
        <div v-if="hasPhoto" class="sm_seg">
          <button class="sm_seg_btn" :class="{ active: cropPhoto }" @click="cropPhoto = true">裁切</button>
          <button class="sm_seg_btn" :class="{ active: !cropPhoto }" @click="cropPhoto = false">完整</button>
        </div>
        <button class="sm_action_btn sm_cancel" @click="emit('close')">取消</button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.sm_overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.sm_wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  max-height: 90vh;
  overflow-y: auto;
}

/* ── Card ── */
.sm_card {
  width: 360px;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
}

.sm_card_inner {
  background: var(--color-background-soft);
  padding: 18px 18px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-family: -apple-system, "PingFang SC", "Hiragino Sans GB", sans-serif;
}

.sm_content {
  font-size: 15px;
  line-height: 1.75;
  color: var(--color-text);
  overflow-wrap: break-word;
  word-break: break-word;
}

/* ── Photo ── */
.sm_photo_wrap {
  border-radius: 8px;
  overflow: hidden;
  line-height: 0;
}

.sm_photo_wrap.crop {
  max-height: 240px;
}

.sm_photo_wrap--repost {
  margin-top: 8px;
}

.sm_photo {
  width: 100%;
  display: block;
  object-fit: contain;
}

.sm_photo_wrap.crop .sm_photo {
  height: 240px;
  object-fit: cover;
}

/* ── Repost ── */
.sm_repost {
  background: var(--color-background-mute);
  border-left: 3px solid var(--color-border-hover);
  border-radius: 0 6px 6px 0;
  padding: 8px 10px;
}

.sm_repost_user {
  font-size: 12px;
  color: var(--color-text);
  opacity: 0.5;
  font-weight: 600;
  margin-bottom: 3px;
}

.sm_repost_text {
  font-size: 13px;
  line-height: 1.65;
  color: var(--color-text);
  overflow-wrap: break-word;
  word-break: break-word;
}

/* ── Footer ── */
.sm_footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px solid var(--color-border);
}

.sm_footer_left {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.sm_username {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text);
  opacity: 0.7;
}

.sm_time {
  font-size: 11px;
  color: var(--color-text);
  opacity: 0.4;
}

.sm_brand {
  font-size: 11px;
  color: var(--color-text);
  opacity: 0.3;
  font-weight: 500;
}

/* ── iOS hint ── */
.sm_ios_hint {
  width: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.sm_ios_hint_text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.sm_ios_img {
  width: 100%;
  border-radius: 14px;
  display: block;
}

/* ── Actions ── */
.sm_actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sm_action_btn {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 6px 16px;
  font-size: 13px;
  cursor: pointer;
  font-weight: 500;
  background: var(--color-background-soft);
  color: var(--color-text);
  transition: background 0.15s, border-color 0.15s;

  &:hover:not(:disabled) {
    background: var(--color-background-mute);
    border-color: var(--color-border-hover);
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
}

.sm_save {
  background: var(--vt-c-indigo);
  border-color: var(--vt-c-indigo);
  color: #fff;

  &:hover:not(:disabled) {
    opacity: 0.88;
    background: var(--vt-c-indigo);
    border-color: var(--vt-c-indigo);
  }
}

.sm_seg {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  overflow: hidden;
}

.sm_seg_btn {
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: transparent;
  color: var(--color-text);
  opacity: 0.45;
  transition: background 0.15s, opacity 0.15s;

  &:first-child { border-right: 1px solid var(--color-border); }

  &:hover:not(.active) {
    background: var(--color-background-mute);
    opacity: 0.7;
  }

  &.active {
    background: var(--color-background-mute);
    opacity: 1;
  }
}
</style>
