import { createRouter, createWebHistory } from "vue-router";
import LoginView from "../views/LoginView.vue";
import EntityView from "../views/EntityView.vue";
import CleanupDeletedView from "../views/CleanupDeletedView.vue";
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
        titleKey: "entity.titles.friend",
        actionLabelKey: "entity.actions.DELETE_FRIENDS"
      }
    },
    {
      path: "/groups",
      component: EntityView,
      props: {
        type: "group",
        action: "LEAVE_GROUPS",
        titleKey: "entity.titles.group",
        actionLabelKey: "entity.actions.LEAVE_GROUPS"
      }
    },
    {
      path: "/channels",
      component: EntityView,
      props: {
        type: "channel",
        action: "UNSUBSCRIBE_CHANNELS",
        titleKey: "entity.titles.channel",
        actionLabelKey: "entity.actions.UNSUBSCRIBE_CHANNELS"
      }
    },
    {
      path: "/bots",
      component: EntityView,
      props: {
        type: "bot_chat",
        action: "CLEANUP_BOT_CHATS",
        titleKey: "entity.titles.bot_chat",
        actionLabelKey: "entity.actions.CLEANUP_BOT_CHATS",
        supportsLastUsedSort: true,
        defaultSortBy: "last_used_at",
        defaultSortOrder: "desc"
      }
    },
    {
      path: "/non-friend-chats",
      component: EntityView,
      props: {
        type: "non_friend_chat",
        action: "CLEANUP_NON_FRIEND_CHATS",
        titleKey: "entity.titles.non_friend_chat",
        actionLabelKey: "entity.actions.CLEANUP_NON_FRIEND_CHATS"
      }
    },
    { path: "/cleanup-deleted", component: CleanupDeletedView },
    { path: "/cleanup-non-friends", redirect: "/non-friend-chats" },
    { path: "/jobs", component: JobsView }
  ]
});
