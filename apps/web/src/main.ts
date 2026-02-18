import { createApp } from "vue";
import { createPinia } from "pinia";
import "material-symbols/rounded.css";
import App from "./App.vue";
import { router } from "./router";
import { vuetify } from "./plugins/vuetify";
import { i18n } from "./plugins/i18n";
import "./styles/base.scss";

const app = createApp(App);
app.use(createPinia());
app.use(i18n);
app.use(router);
app.use(vuetify);
app.mount("#app");
