import { App } from "./app/App";
import { Router } from "./app/Router";
import { Editor } from "./editor/Editor";

const container = document.getElementById("app");
if (!container) {
  throw new Error("Missing #app container");
}

let currentApp: App | null = null;
let currentEditor: Editor | null = null;

const router = new Router({
  onChange: async (route) => {
    if (currentApp) {
      currentApp.dispose();
      currentApp = null;
    }
    if (currentEditor) {
      currentEditor.dispose();
      currentEditor = null;
    }
    if (route === "play") {
      const app = new App(container, {
        onNavigateEditor: () => router.navigate("editor"),
      });
      await app.start();
      currentApp = app;
    } else {
      const editor = new Editor(container, {
        onBackToGame: () => router.navigate("play"),
      });
      await editor.start();
      currentEditor = editor;
    }
  },
});

router.start();
