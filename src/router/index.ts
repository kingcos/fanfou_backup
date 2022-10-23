import { createRouter, createWebHistory } from "vue-router";
import MainPage from "../pages/main/index.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "main",
      component: MainPage,
    },
  ],
});

export default router;
