import { createRouter, createWebHistory } from "vue-router";
import LoginView from "../views/LoginView.vue";
import EntityView from "../views/EntityView.vue";
import CleanupDeletedView from "../views/CleanupDeletedView.vue";
import CleanupNonFriendChatsView from "../views/CleanupNonFriendChatsView.vue";
import JobsView from "../views/JobsView.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/login" },
    { path: "/login", component: LoginView },
    {
      path: "/friends",
      component: EntityView,
      props: {
        type: "friend",
        action: "DELETE_FRIENDS",
        title: "好友管理",
        actionLabel: "批量删除好友"
      }
    },
    {
      path: "/groups",
      component: EntityView,
      props: {
        type: "group",
        action: "LEAVE_GROUPS",
        title: "群组管理",
        actionLabel: "批量退出群组"
      }
    },
    {
      path: "/channels",
      component: EntityView,
      props: {
        type: "channel",
        action: "UNSUBSCRIBE_CHANNELS",
        title: "频道管理",
        actionLabel: "批量取消订阅"
      }
    },
    {
      path: "/non-friend-chats",
      component: EntityView,
      props: {
        type: "non_friend_chat",
        action: "CLEANUP_NON_FRIEND_CHATS",
        title: "非好友私聊管理",
        actionLabel: "批量清理聊天记录"
      }
    },
    { path: "/cleanup-deleted", component: CleanupDeletedView },
    { path: "/cleanup-non-friends", component: CleanupNonFriendChatsView },
    { path: "/jobs", component: JobsView }
  ]
});
