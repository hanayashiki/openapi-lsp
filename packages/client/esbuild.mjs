import * as esbuild from "esbuild";

const isWatch = process.argv.includes("--watch");

/** @type {esbuild.BuildOptions} */
const clientConfig = {
  entryPoints: ["./src/extension.ts"],
  bundle: true,
  outfile: "./dist/extension.js",
  platform: "node",
  format: "cjs",
  external: ["vscode"],
  sourcemap: true,
};

/** @type {esbuild.BuildOptions} */
const serverConfig = {
  entryPoints: ["../server/src/server.ts"],
  bundle: true,
  outfile: "./dist/server.js",
  platform: "node",
  format: "cjs",
  sourcemap: true,
};

async function build() {
  if (isWatch) {
    const [clientCtx, serverCtx] = await Promise.all([
      esbuild.context(clientConfig),
      esbuild.context(serverConfig),
    ]);
    await Promise.all([clientCtx.watch(), serverCtx.watch()]);
    console.log("Watching for changes...");
  } else {
    await Promise.all([
      esbuild.build(clientConfig),
      esbuild.build(serverConfig),
    ]);
    console.log("Build complete");
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
