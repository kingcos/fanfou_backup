<script setup lang="ts">
import { requestFanfous, type Fanfou } from "../utils/fanfou";
import { reactive } from "vue";

console.log("--- RUNNING ---");

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
  fanfous: Fanfou[];
  currentPage: number;
  totalPages: number;
}>({ fanfous: [], currentPage: 1, totalPages: 0 });

// // 1: 0,1,2,3,4,5,6,7,8,9 => 10 个内容，0-9

const refresh = () => {
  requestFanfous().then((result) => {
    data.fanfous = result.reverse();
    data.totalPages = Math.ceil(result.length / PER_PAGE);
  });
};

const pageOperate = (operate: number) => {
  const next = data.currentPage + operate;
  console.log("pageOperate", next);
  if (next <= 0) {
    data.currentPage = data.totalPages;
  } else if (next > data.totalPages) {
    data.currentPage = 1;
  } else {
    data.currentPage = next;
  }
  console.log("pageOperate", data.currentPage);
};

refresh();
</script>

<template>
  <main>
    <h1>我的饭否备份</h1>
    <h4>
      by:
      <a href="https://github.com/kingcos/fanfou_backup"
        >github.com/kingcos/fanfou_backup</a
      >
    </h4>
    <div v-if="data.fanfous.length">
      <div
        class="fanfou"
        v-for="(index, key) in rangeArray(
          (data.currentPage - 1) * PER_PAGE,
          Math.min(data.currentPage * PER_PAGE - 1, data.fanfous.length - 1)
        )"
        :key="key"
      >
        <div v-if="data.fanfous[index].text.length">
          <span v-html="data.fanfous[index].text"></span>
        </div>
        <div v-if="data.fanfous[index].photo">
          <img :src="data.fanfous[index].photo.largeurl" />
        </div>
        <span class="time">{{ data.fanfous[index].created_at }}</span>
      </div>
      <div class="pager">
        <div @click="pageOperate(-1)" class="last_page">上一页</div>
        <div class="pages">{{ data.currentPage }} / {{ data.totalPages }}</div>
        <div @click="pageOperate(1)" class="next_page">下一页</div>
      </div>
    </div>
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

  img {
    margin-top: 10px;
    width: 50%;
  }
}

.time {
  font-size: small;
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
</style>
