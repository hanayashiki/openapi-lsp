import * as esbuild from "esbuild";

const isWatch = process.argv.includes("--watch");

const clientConfig: esbuild.BuildOptions = {
  entryPoints: ["./src/extension.ts"],
  bundle: true,
  outfile: "./dist/extension.js",
  platform: "node",
  format: "cjs",
  external: ["vscode"],
  sourcemap: true,
};

const serverConfig: esbuild.BuildOptions = {
  entryPoints: ["../server/src/server.ts"],
  bundle: true,
  outfile: "./dist/server.js",
  platform: "node",
  format: "cjs",
  sourcemap: true,
};

async function build(): Promise<void> {
  if (isWatch) {
    const [clientCtx, serverCtx] = await Promise.all([
      esbuild.context(clientConfig),
      esbuild.context(serverConfig),
    ]);
    await Promise.all([clientCtx.watch(), serverCtx.watch()]);
    console.info("Watching for changes...");
  } else {
    await Promise.all([
      esbuild.build(clientConfig),
      esbuild.build(serverConfig),
    ]);
    console.info("Build complete");
  }
}

build().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
