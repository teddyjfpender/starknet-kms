// src/constants.ts
var mnemonic = [
  "habit",
  "hope",
  "tip",
  "crystal",
  "because",
  "grunt",
  "nation",
  "idea",
  "electric",
  "witness",
  "alert",
  "like"
];

// src/configs.ts
var baseTsupConfig = {
  entry: ["./src/index.ts"],
  outDir: "./dist",
  format: "esm",
  sourcemap: true,
  clean: true,
  bundle: true,
  dts: true,
  silent: true
};
export {
  baseTsupConfig,
  mnemonic
};
