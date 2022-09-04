import path from 'path';
import { BannerPlugin, Configuration, ProgressPlugin } from 'webpack';
import { UserscriptPlugin } from './src/__util';

const metadata = `// ==UserScript==
// @name         Test
// @version      0.1
// @description  try to take over the world!
// @match        https://www.google.com/
// @require      https://unpkg.com/react@18/umd/react.production.min.js
// @require      https://unpkg.com/react-dom@18/umd/react-dom.production.min.js
// ==/UserScript==
`

const config: Configuration = {
  entry: "./src/index.tsx",
  output: {
    filename: "bundle.js",
    path: path.resolve(process.cwd() + "/dist")
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"]
  },
  module: {
    rules: [
      {
        test: /\.[tj]sx?/,
        exclude: /node_modules/,
        use: ["ts-loader"]
      }
    ]
  },
  externals: {
    "react": "React",
    "react/jsx-runtime": "React",
    "react-dom": "ReactDOM",
    "react-dom/client": "ReactDOM",
  },
  plugins: [
    new ProgressPlugin(),
    // new UserscriptPlugin({
    //   useCDN: true
    // }),
    new BannerPlugin({
      banner: metadata,
      raw: true,
      entryOnly: false
    }),
  ],
  devtool: false,
  optimization: {
    minimizer: [function (this, compiler) {
      
    }]
  },
  cache:true,

  
}
export default config;
