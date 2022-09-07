import type { SourceLocation } from "acorn";
import { existsSync, readFileSync } from "fs";
import { Compiler, EntryNormalized, WebpackPluginInstance } from "webpack";
// @ts-ignore
import parse from "eslint-plugin-userscripts/lib/utils/parse";
import { join } from "path";
import { ConcatSource, Source } from "webpack-sources";
import PackageJson from "../package.json";
import { readdirSync } from "fs";

/// <reference types="webpack" />

type OptionsType = {
  /** use CDN or include React library */
  useCDN: boolean;
  /**
   * React version
   * - if not specified, read from `package.json`
   */
  reactVersion?: string;
  /**
   * ReactDOM version
   * - if not specified, read from `package.json`
   */
  reactDomVersion?: string;

  appendExternal: {
    name: string;
    version?: string;
    as: string;
  }[];
};

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

interface IDir {
  path: string;
  type: "directory";
  files: (IDir | IFile)[];
}
interface IFile {
  path: string;
  type: "file";
  contentType: string;
  integrity: string;
  lastModified: string;
  size: number;
}

export class UserscriptPlugin implements WebpackPluginInstance {
  static defaultOptions: OptionsType = {
    useCDN: true,
    appendExternal: []
  };
  options: OptionsType;
  metadataTextArray: string[] = [];
  metadataArray: metadataValue[] = [];
  metadataText: string = "";
  requireArray: string[] = [];
  exMeta: Function = () => {};

  constructor(options: OptionsType = UserscriptPlugin.defaultOptions) {
    this.options = { ...{
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

  async _getLinkFromCDN(name: string, version: string, isDev: boolean): Promise<string|void> {
    const dir: IDir = await (await fetch(`https://unpkg.com/${name}@${version}/umd/?meta`)).json();
    const res: Partial<{
      prod: string;
      dev: string;
    }> = {};
    dir.files.forEach((file) => {
      if (file.path.includes("development")) {
        res.dev = file.path;
      } else if (file.path.includes("production")) {
        res.prod = file.path;
      }
    })
    return res[isDev ? "dev" : "prod"];
  }

  _getLinkFromLocal(name: string, version: string, isDev: boolean): string|void {
    const umdPath = join(__dirname, "../node_modules", name, "umd")
    if (existsSync(umdPath)) {
      const dir = readdirSync(umdPath);
      const res: Partial<{
        prod: string;
        dev: string;
      }> = {};
      dir.forEach((file) => {
        if (file.includes("development")) {
          res.dev = file;
        } else if (file.includes("production")) {
          res.prod = file;
        }
      })
      return `https://unpkg.com/${name}@${version}/umd/${res[isDev ? "dev" : "prod"]}`
    }
  }

  async getLink(name: string, version: string, isDev: boolean): Promise<string> {
    let link = this._getLinkFromLocal(name, version, isDev);
    if (!link) {
      console.log("UMD not found in local, trying to get from CDN...")
      link = await this._getLinkFromCDN(name, version, isDev);
    }
    if (!link) throw Error("cannnot get link from CDN and local")
    return link;
  }

  fixDependencyLink(compiler: Compiler): Compiler["options"]["externals"] {
    if (this.options.useCDN) {
      return [
        {
          "react": "React",
          "react/jsx-runtime": "React",
          "react-dom": "ReactDOM",
          "react-dom/client": "ReactDOM",
        },
        (data, callback) => {
          if (this.options.useCDN) {
            const isDev = compiler.options.mode === "development"
            if (/react(\/.*)?/.test(data.request || "")) {
              return callback(undefined, "React")
            } else if (/react-dom(\/.*)?/.test(data.request || "")) {
              return callback(undefined, "ReactDOM")
            } else {
              let ok = false;
              this.options.appendExternal.forEach((external) => {
                if (data.request && data.request.includes(external.name)) {
                  let version: string = external.version
                    // @ts-ignore
                    || PackageJson.devDependencies[external.name]
                    // @ts-ignore
                    || PackageJson.dependencies[external.name];
                  this.getLink(external.name, version, isDev).then(link => {
                    this.requireArray.push(link)
                  })
                  ok = true;
                  callback(undefined, external.as)
                }
              })
              // this.getCDNLink()
              if (!ok) {
                return callback()
              }
            }
          }
        }
      ]
    } else {
      return {}
    }
  }

  apply(compiler: Compiler) {
    // add external UMD module to require
    compiler.options.externals = this.fixDependencyLink(compiler)
    // change filename to .user.js
    if (typeof compiler.options.output.filename === "string" && !compiler.options.output.filename.endsWith(".user.js")) {
      compiler.options.output.filename = compiler.options.output.filename.replace(/\.js/, ".user.js")
    }
    compiler.hooks.entryOption.tap("UserscriptPlugin", (( path, entries ) => {
      const isDev = compiler.options.mode === "development"
      for (const e in entries) {
        const filepath = join(path, (entries as { [index: string]: { import: string[] } } & EntryNormalized)[e].import[0] as string);
        compiler.options.externals = this.fixDependencyLink(compiler)
        this.metadataText = this.readMetadata(filepath, isDev)
        if (this.metadataText) break;
      }
    }) as (path: string, entries: EntryNormalized) => boolean)

    // insert metadata to head of emitted asset
    compiler.hooks.make.tap("UserscriptPlugin", compilation => {
      compilation.hooks.afterOptimizeAssets.tap("UserscriptPlugin", assets => {
        this.requireArray.forEach((require) => {
          this.addMetadata("require", require)
        })
        this.metadataText = this.metadataTextArray.join("\n")

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
