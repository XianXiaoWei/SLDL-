const TerserPlugin = require("terser-webpack-plugin");
const webpack = require("webpack");
const path = require("path");
const pkg = require('./package.json');

module.exports = {
  mode: "production",
  entry: "./main.js",
  output: {
    clean: true,
    filename: "sldl-utils.min.js",
    path: path.resolve(__dirname, "dist"),
    libraryTarget: "umd",
    library: "SLDL",
    globalObject: "window"
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin({
      extractComments: true,
      terserOptions: {
        output: {
          comments: "some"
        }
      }
    })]
  },
  plugins: [
    new webpack.BannerPlugin({
      banner: `/*! ${pkg.name} v${pkg.version} | (c) ${new Date().getFullYear()} ${pkg.author} | License: ${pkg.license} */`,
      raw: true,
      entryOnly: true
    })
  ]
};