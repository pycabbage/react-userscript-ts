import type { SourceLocation } from "acorn";
import { readFileSync } from "fs";
import { Compiler, EntryNormalized, WebpackPluginInstance } from "webpack";
// @ts-ignore
import parse from "eslint-plugin-userscripts/lib/utils/parse";
import { join } from "path";
import { ConcatSource, Source } from "webpack-sources";
import PackageJson from "../package.json";

type OptionsType = Partial<{
  /** use CDN or include React library */
  useCDN: boolean;
  /**
   * React version
   * - if not specified, read from `package.json`
   */
  reactVersion: string;
  /**
   * ReactDOM version
   * - if not specified, read from `package.json`
   */
  reactDomVersion: string;
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
      reactDomVersion: PackageJson.devDependencies["react-dom"],
    }, ...options };
  }

  addMetadata(key: string, value: string) {
    const metadata = { key, value };
    this.metadataArray.push(metadata);
    this.metadataTextArray.splice(this.metadataArray.length, 0,
      `// @${metadata.key}      ${metadata.value}`);
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
      this.addMetadata("require", `https://unpkg.com/react@${this.options.reactVersion}/umd/react.${isDev ? "development" : "production.min"}.js`)
    }
    if (this.options.useCDN && !includeReactDOM) {
      this.addMetadata("require", `https://unpkg.com/react-dom@${this.options.reactDomVersion}/umd/react-dom.${isDev ? "development" : "production.min"}.js`)
    }
    if (process.env.USERSCRIPT_UPDATE_URL) {
      this.addMetadata("updateURL", process.env.USERSCRIPT_UPDATE_URL)
      this.addMetadata("downloadURL", process.env.USERSCRIPT_UPDATE_URL)
    }
    return this.metadataTextArray.join("\n")
  }

  apply(compiler: Compiler) {
    if (this.options.useCDN) {
      compiler.options.externals = {...{
        "react": "React",
        "react/jsx-runtime": "React",
        "react-dom": "ReactDOM",
        "react-dom/client": "ReactDOM",
      }, ...(compiler.options.externals as Object)}
    }
    if (typeof compiler.options.output.filename === "string" && !compiler.options.output.filename.endsWith(".user.js")) {
      compiler.options.output.filename = compiler.options.output.filename.replace(/\.js/, ".user.js")
    }
    compiler.hooks.entryOption.tap("UserscriptPlugin", (( path, entries ) => {
      const isDev = compiler.options.mode === "development"
      for (const e in entries) {
        const filepath = join(path, (entries as { [index: string]: { import: string[] } } & EntryNormalized)[e].import[0] as string);
        this.metadataText = this.readMetadata(filepath, isDev)
        if (this.metadataText) break;
      }
    }) as (path: string, entries: EntryNormalized) => boolean)

    // insert metadata to head of emitted asset
    compiler.hooks.make.tap("UserscriptPlugin", compilation => {
      compilation.hooks.afterOptimizeAssets.tap("UserscriptPlugin", assets => {
        for (const name in assets) {
          const asset = assets[name]
          const inserted = new ConcatSource(this.metadataText + "\n\n")
          inserted.add(asset as Source)
          // @ts-ignore
          compilation.updateAsset(name, inserted)
        }
      })
    })
  }
}
