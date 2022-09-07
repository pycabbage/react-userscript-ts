import path from 'path';
import type { Configuration } from 'webpack';
import type { Configuration as DevServerConfiguration } from "webpack-dev-server";
import { ProgressPlugin } from 'webpack';
import { UserscriptPlugin } from './src/__util';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';

const config: { devServer?: DevServerConfiguration } & Configuration = {
  entry: "./src/index.tsx",
  output: {
    filename: "[name].js",
    path: path.join(__dirname, "/dist"),
    clean: true
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"]
  },
  module: {
    rules: [
      {
        test: /\.[tj]sx?/,
        exclude: /node_modules/,
        use: "ts-loader",
      }
    ]
  },
  externals: {},
  devServer: {
    static: {
      directory: path.join(__dirname, "/dist")
    },
    port: 9000
  },
  plugins: [
    new CleanWebpackPlugin(),
    new ProgressPlugin(),
    new UserscriptPlugin({
      useCDN: true,
    }),
  ],
  devtool: false,
  cache:true,
}
export default config;
