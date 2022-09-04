import type { SourceLocation } from "acorn";
import { readFileSync } from "fs";
import { Compiler, EntryNormalized, WebpackPluginInstance } from "webpack";
// @ts-ignore
import parse from "eslint-plugin-userscripts/lib/utils/parse";
import { ReplaceSource, Source } from "webpack-sources";
import PackageJson from "../package.json";
import { join } from "path";
import { validate } from 'schema-utils';

type OptionsType = Partial<{
  useCDN: boolean;
  reactVersion: string;
  reactdomVersion: string;
}>;

interface metadataValue {
  key: string;
  value: string
}

interface ParsingResult {
  end: boolean;
  enteredMetadata: number;
  lines: {
    value: string;
    lineLoc: SourceLocation;
    codeBetween: boolean;
    end: boolean;
    start: boolean;
    invalid: boolean;
    metadataInfo: boolean;
    metadataValue?: metadataValue;
  }[];
}

export class UserscriptPlugin implements WebpackPluginInstance {
  static defaultOptions: OptionsType = {
    useCDN: true,
  };
  options: OptionsType;
  metadataTextArray: string[] = [];
  metadataArray: metadataValue[] = [];
  metadataText: string = "";

  constructor(options: OptionsType = UserscriptPlugin.defaultOptions) {
    this.options = { ...{
      useCDN: true,
      reactVersion: PackageJson.devDependencies["react"],
      reactdomVersion: PackageJson.devDependencies["react-dom"],
    }, ...options };
  }

  readMetadata(filepath: string, isDev: boolean): string {
    const source = readFileSync(filepath).toString()
    const parsedMetadata: ParsingResult = parse({
      lines: source.split(/\r?\n/)
    })
    parsedMetadata.lines.forEach((line) => {
      this.metadataTextArray.push(line.value)
      if (line.metadataValue) this.metadataArray.push(line.metadataValue)
    });
    const includeReact = this.metadataArray.map(meta => (meta.key === "require" && /react@.*\.js/.test(meta.value))).includes(true)
    const includeReactDOM = this.metadataArray.map(meta => (meta.key === "require" && /react-dom@.*\.js/.test(meta.value))).includes(true)
    if (this.options.useCDN && !includeReact) {
      const metadata = {
        key: "require",
        value: `https://unpkg.com/react@${this.options.reactVersion}/umd/react.${isDev ? "development" : "production.min"}.js`
      }
      this.metadataArray.push(metadata)
      this.metadataTextArray.splice(this.metadataArray.length, 0,
        `// @${metadata.key}      ${metadata.value}`)
    }
    if (this.options.useCDN && !includeReactDOM) {
      const metadata = {
        key: "require",
        value: `https://unpkg.com/react-dom@${this.options.reactdomVersion}/umd/react-dom.${isDev ? "development" : "production.min"}.js`
      }
      this.metadataArray.push(metadata)
      this.metadataTextArray.splice(this.metadataArray.length, 0,
        `// @${metadata.key}      ${metadata.value}`)
    }
    return this.metadataTextArray.join("\n")
  }

  apply(compiler: Compiler) {
    if (this.options.useCDN) {
      compiler.options.externals = {
        "react": "React",
        "react/jsx-runtime": "React",
        "react-dom": "ReactDOM",
        "react-dom/client": "ReactDOM",
      }
    }
    compiler.hooks.entryOption.tap("UserscriptPlugin", ((path, entries ) => {
      const isDev = compiler.options.mode === "development"
      const filepath = join(path, (entries as { main: { import: string[] } } & EntryNormalized).main.import[0])
      this.metadataText = this.readMetadata(filepath, isDev)
    }) as (path: string, entries: EntryNormalized) => boolean)

    // insert metadata to head of emitted asset
    /*
    compiler.hooks.emit.tap("UserscriptPlugin", compilation => {
      for (const asset in compilation.assets) {
        // @ts-ignore
        if (compilation.assets[asset]["_children"]) {
        // @ts-ignore
          compilation.assets[asset]["_children"][0] = this.metadataText + "\n\n" + compilation.assets[asset]["_children"][0]
        }
        // @ts-ignore
        compilation.assets[asset]["_value"] = this.metadataText + "\n\n" + compilation.assets[asset]["_value"]
        console.log(asset, compilation.assets[asset])
      }
    })
    */
    compiler.hooks.make.tap("UserscriptPlugin", compilation => {
      compilation.hooks.afterOptimizeAssets.tap("UserscriptPlugin", assets => {
        for (const name in assets) {
          const asset = assets[name]
          const rep = new ReplaceSource(asset as Source, "metadata")
          rep.insert(0, this.metadataText + "\n\n", "metadata")
          compilation.updateAsset(name, asset)
          console.log("rep:", asset)
        }
      })
    })
  }
}