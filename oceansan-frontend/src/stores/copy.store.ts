import { defineStore } from "pinia";
import { startCopy, connectProgress } from "src/services/copy.api";

export const useCopyStore = defineStore("copy", {
  state: () => ({
    running: false,
    percent: 0,
    currentFile: ""
  }),

  actions: {
    async startCopy(from: string, to: string) {
      this.running = true;
      this.percent = 0;
      this.currentFile = "";

      connectProgress(
        p => {
          this.percent = p.percent;
          this.currentFile = p.currentFile;
        },
        () => {
          this.running = false;
        }
      );

      await startCopy(from, to);
    }
  }
});
