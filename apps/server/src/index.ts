import { app } from "./app.js";

const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log(`[tg-tools] server is running on http://localhost:${port}`);
});
