import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import ReactDOM from "react-dom/client";

import { App } from "./app.js";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <App />,
);
