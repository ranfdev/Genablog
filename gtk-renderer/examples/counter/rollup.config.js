import resolve from "@rollup/plugin-node-resolve";
import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";

export default [
  {
    input: "./index.jsx",
    output: {
      file: "build/bundle.mjs",
      format: "esm",
    },
    plugins: [
      commonjs({
        strictRequires: true
      }),
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      babel({
        babelHelpers: "bundled",
        presets: [
          [
            "babel-preset-solid",
            {
              moduleName: "../../",
              generate: "universal",
            },
          ],
        ],
      }),
    ],
  },
  
];
