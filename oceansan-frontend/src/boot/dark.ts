import { Dark } from "quasar";

export default () => {
  const saved = localStorage.getItem("dark-mode");
  Dark.set(saved === "true");
};
