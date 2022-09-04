import { existsSync, readFileSync, writeFileSync } from "fs";
import path, { join } from "path";
import { Compiler } from "webpack";
import { createInterface } from "readline";

const wait = (q: string = "") => {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question(q, ans => {
    rl.close();
  })
}

declare interface OptionsType {
  [x: string]: string;
}

export default class UserscriptPlugin {
  static defaultOptions: OptionsType = {
    name: 'New Userscript',
    version: '0.1',
    description: "New React Userscript",
  };
  options: OptionsType;

  constructor(options: OptionsType = UserscriptPlugin.defaultOptions) {
    this.options = { ...UserscriptPlugin.defaultOptions, ...options };
  }

  buildMetadata() {

  }

  apply(compiler: Compiler) {
    // read metadata from <filename>.user.<extension>
    // @ts-ignore
    compiler.hooks.entryOption.tap("UserscriptPlugin", (path, { main: { import: [filename] } }) => {
      readFileSync(join(path, filename))
      return false
    })

    // // @ts-ignore
    // for (const hook in compiler.hooks) [
    //   // @ts-ignore
    //   compiler.hooks[hook].tap("UserscriptPlugin", function (...args) {
    //     console.log(`${hook}:`)
    //     console.log(`  Arg length: ${args.length}, keys: `)
    //     for (const arg in args) {
    //       console.log(`    ${arg}: ${typeof args[arg]}, `, Object.keys(args[arg]))
    //     }
    //   })
    // ]

    // insert metadata to head of emitted asset
    compiler.hooks.emit.tap("UserscriptPlugin", compilation => {
      for (const asset in compilation.assets) {
        // @ts-ignore
        compilation.assets[asset]["_value"] = "/* HELLO! */ " + compilation.assets[asset]["_value"]
      }
    })
  }
}