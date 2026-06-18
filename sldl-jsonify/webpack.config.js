const TerserPlugin = require("terser-webpack-plugin");
const webpack = require("webpack");
const path = require("path");
const pkg = require("./package.json");

module.exports = {
  mode: "production",
  entry: {
    "sldl-jsonify": "./main.js",
    "sldl-jsonify.min": "./main.js",
  },
  output: {
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
  externals: {
    "sldl-utils": "SLDL",
    "sldl-objects": "SLDL"
  },
  plugins: [
    new webpack.BannerPlugin({
      banner: `/*! ${pkg.name} v${pkg.version} | (c) ${new Date().getFullYear()} ${pkg.author} | License: ${pkg.license} */`,
      raw: true,
      entryOnly: true
    })
  ]
};