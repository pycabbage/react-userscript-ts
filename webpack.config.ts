import path from 'path';
import { Configuration } from 'webpack';
import UserscriptPlugin from './src/__builder';

const config: Configuration = {
  entry: "./src/index.tsx",
  output: {
    filename: "bundle.js",
    path: path.resolve(process.cwd() + "/dist")
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"]
  },
  externals: {
    "react": "React",
    "react-dom": "ReactDOM",
    "react-dom/client": "ReactDOM",
  },
  module: {
    rules: [
      {
        test: /\.[tj]sx?/,
        exclude: /node_modules/,
        use: "ts-loader"
      }
    ]
  },
  plugins: [
    new UserscriptPlugin()
  ],
  devtool: false
}
export default config;
