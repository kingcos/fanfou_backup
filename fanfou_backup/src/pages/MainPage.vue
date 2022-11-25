<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { reactive, ref, watch, computed } from "vue";
import { requestFanfous, type Fanfou } from "../utils/fanfou";

console.log("--- RUNNING ---");

const route = useRoute();
const router = useRouter();
const currentPage = computed(() => {
  const page = route.query.page ? Number(route.query.page) : 1;
  console.log("page ", page);
  return page;
});

const rangeArray = (start: number, end: number) => {
  console.log("rangeArray", start, end);
  const arr = Array(end - start + 1)
    .fill(0)
    .map((v, i) => i + start);
  console.log("rangeArray", arr);
  return arr;
};

const PER_PAGE: number = 15;

const data = reactive<{
  orginFanfous: Fanfou[];
  fanfous: Fanfou[];
  totalPages: number;
  loading: boolean;
  image?: string;
}>({
  orginFanfous: [],
  fanfous: [],
  totalPages: 0,
  loading: false,
});

// // 1: 0,1,2,3,4,5,6,7,8,9 => 10 个内容，0-9

const keyword = ref("");
watch(keyword, (newValue) => {
  if (newValue == "") {
    data.fanfous = data.orginFanfous;
  } else {
    data.fanfous = data.fanfous.filter((fanfou) => {
      return fanfou.text.indexOf(newValue) != -1;
    });
  }
  console.log(newValue);
});

const refresh = () => {
  data.loading = true;
  requestFanfous()
    .then((result) => {
      data.loading = false;
      data.orginFanfous = result.reverse();
      data.fanfous = data.orginFanfous;
      data.totalPages = Math.ceil(result.length / PER_PAGE);
    })
    .catch(() => {
      data.loading = false;
    });
};

const pageOperate = (operate: number) => {
  const next = currentPage.value + operate;
  console.log("pageOperate", next);
  let page = next
  if (next <= 0) {
    page = data.totalPages;
  } else if (next > data.totalPages) {
    page = 1;
  }
  console.log("pageOperate", page);
  router.push({ query: { page: page } }).then(() => {
    refresh();
  });
};

const formattedDate = (dateString: string) => {
  const date = new Date(dateString);
  const year = date.getFullYear().toString() + " 年 ";
  const month = (date.getMonth() + 1).toString() + " 月 ";
  const day = date.getDate().toString() + " 日 ";
  let hour = date.getHours().toString() + ":";
  if (hour.length < 3) {
    hour = "0" + hour;
  }
  let minute = date.getMinutes().toString();
  if (minute.length < 2) {
    minute = "0" + minute;
  }
  // const second = date.getSeconds().toString();

  return year + month + day + hour + minute;
};

const clickImage = (url?: string) => {
  console.log(url);
  data.image = url;
};

refresh();
</script>

<template>
  <div v-if="data.image" @click="clickImage()" class="image_container">
    <img class="image" :src="data.image" />
  </div>
  <main>
    <h1>我的饭否备份</h1>
    <h4>
      by:
      <a href="https://github.com/kingcos/fanfou_backup"
        >github.com/kingcos/fanfou_backup</a
      >
    </h4>
    <input
      type="text"
      class="search"
      placeholder="🔍 Search"
      filterable
      v-model="keyword"
    />
    <div v-if="data.fanfous.length">
      <div
        class="fanfou"
        v-for="(index, key) in rangeArray(
          (currentPage - 1) * PER_PAGE,
          Math.min(currentPage * PER_PAGE - 1, data.fanfous.length - 1)
        )"
        :key="key"
      >
        <div class="content" v-if="data.fanfous[index].text.length">
          <span v-html="data.fanfous[index].text"></span>
        </div>
        <div class="photo" v-if="data.fanfous[index].photo">
          <img
            :src="data.fanfous[index].photo.largeurl"
            @click="clickImage(data.fanfous[index].photo.largeurl)"
          />
        </div>
        <span class="time">{{
          formattedDate(data.fanfous[index].created_at)
        }}</span>
      </div>
      <div class="pager">
        <div @click="pageOperate(-1)" class="last_page">上一页</div>
        <div class="pages">{{ currentPage }} / {{ data.totalPages }}</div>
        <div @click="pageOperate(1)" class="next_page">下一页</div>
      </div>
    </div>
    <div class="fanfou" v-else-if="data.loading">正在加载，请稍等...</div>
    <div v-else>
      <div class="fanfou" @click="refresh">
        网络似乎出现问题，无法加载内容，请点此刷新重试
      </div>
    </div>
  </main>
</template>

<style lang="scss" scoped>
h1 {
  margin-top: 20px;
}

.fanfou {
  margin-top: 20px;
  border: 1px solid;
  border-radius: 10px;
  padding: 10px;

  font-size: large;

  .photo {
    flex: 0 0 33.3%;
    padding: 5px;

    width: 30%;
    aspect-ratio: 1;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }
}

.time {
  font-size: x-small;
}

.pager {
  margin-top: 20px;
  margin-bottom: 20px;
  display: flex;
  flex-direction: row;
}

.pages {
  border: 1px solid;
  border-radius: 10px;
  padding-left: 10px;
  padding-right: 10px;
  margin-left: 10px;
  margin-right: 10px;
  text-align: center;
}

.content {
  word-break: break-all;
}

.search {
  border: 1px solid;
  border-radius: 10px;
  padding: 5px;

  font-size: medium;
  margin-top: 10px;
}

.image_container {
  position: fixed;
  z-index: 99;
  width: 100%;
  height: 100%;
  background-color: black;
  left: 0;
  top: 0;

  display: flex;
  align-items: center;
}

.image {
  padding: 10px;
  max-width: 100%;
  max-height: 100%;
  margin: auto;
}

@media (prefers-color-scheme: dark) {
  .search {
    background-color: black;
  }
}
</style>
