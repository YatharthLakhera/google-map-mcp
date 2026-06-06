import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  clean: true,
  target: "node18",
  banner: {
    js: "#!/usr/bin/env node",
  },
  noExternal: [],
});
