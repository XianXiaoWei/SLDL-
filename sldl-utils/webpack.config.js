const TerserPlugin = require("terser-webpack-plugin");
const webpack = require("webpack");
const path = require("path");
const pkg = require('./package.json');

module.exports = {
  mode: "production",
  entry: {
    "sldl-utils": "./main.js",
    "sldl-utils.min": "./main.js",
  },
  output: {
    clean: true,
    filename: "[name].js",
    path: path.resolve(__dirname, "dist"),
    library: {
      name: "SLDL",
      type: "assign-properties"
    },
    globalObject: "window"
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin({
      extractComments: false,
      include: /\.min\.js$/
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