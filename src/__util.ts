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

interface IExternal {
  name: string;
  version?: string;
  as?: string;
  url?: string | {
    dev: string;
    prod: string;
  };
}

type OptionsType = Partial<{
  /** use CDN or include React library */
  useCDN?: boolean;
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

  appendExternal?: IExternal[];
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

type IFS = Partial<{
  prod: string;
  dev: string;
}>

export class UserscriptPlugin implements WebpackPluginInstance {
  static defaultOptions: OptionsType = {
    useCDN: true,
    appendExternal: []
  };
  options: OptionsType;
  metadataTextArray: string[] = [];
  metadataArray: metadataValue[] = [];
  metadataText: string = "";
  // requireArray: string[] = [];
  requireArray: {
    name: string;
    url: string;
  }[] = [];

  constructor(options: OptionsType = UserscriptPlugin.defaultOptions) {
    this.options = {
      ...{
        reactVersion: PackageJson.devDependencies["react"],
        reactDomVersion: PackageJson.devDependencies["react-dom"],
      }, ...options
    };
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
      // this.addMetadata("require", `https://unpkg.com/react@${this.options.reactVersion}/cjs/react-jsx-dev-runtime.${isDev ? "development" : "production.min"}.js`)
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

  async _getLinkFromCDN(name: string, version: string, isDev: boolean): Promise<string | void> {
    const dir: IDir = await (await fetch(`https://unpkg.com/${name}@${version}/umd/?meta`)).json();
    const res: Partial<{
      prod: string;
      dev: string;
    }> = {};
    dir.files.forEach((file) => {
      if (file.path.includes(".min.")) {
        res.prod = file.path;
      } else {
        res.dev = file.path;
      }
    })
    return res[isDev ? "dev" : "prod"];
  }

  _getLinkFromLocal(
    name: string,
    version: string,
    isDev: boolean,
    relativePath: string[] | void = undefined,
    tried: number = -1
  ): string | void {
    const tr = [
      ["umd"],
      ["dist"],
      ["lib", "umd"],
      [],
    ];
    if (!relativePath) {
      if (tried < tr.length) {
        return this._getLinkFromLocal(name, version, isDev, tr[tried + 1], tried + 1);
      } else return
    }
    const path = join(__dirname, "../node_modules", name, ...relativePath)
    if (existsSync(path)) {
      const dir = readdirSync(path);
      if (dir.some(f => /\.min\./.test(f))) {
        const res: IFS = {};
        dir.filter(f => /\.js$/.test(f)).forEach((file) => {
          if (/\.min\..s$/.test(file)) {
            res.prod = file;
          } else {
            res.dev = file;
          }
        })
        return `https://unpkg.com/${name}@${version}/${relativePath.join("/")}${relativePath.length ? "/" : ""}${res[isDev ? "dev" : "prod"]}`
      } else {
        if (tried < tr.length) {
          return this._getLinkFromLocal(name, version, isDev, tr[tried + 1], tried + 1);
        }
      }
    } else {
      if (tried < tr.length) {
        // return this._getLinkFromLocal(name, version, isDev, join(relativePath, ...tr[tried + 1]), tried + 1);
        return this._getLinkFromLocal(name, version, isDev, tr[tried + 1], tried + 1);
      }
    }
  }

  getLink(name: string, version: string, isDev: boolean): string {
    let link: string | void = this._getLinkFromLocal(name, version, isDev);
    if (link) {
      return link;
    } else {
      console.log("UMD not found in local, trying to get from CDN...")
      // @ts-ignore
      link = this._getLinkFromCDN(name, version, isDev);
      if (!link) throw Error("cannnot get link from CDN and local")
      return link;
    }
  }

  async appendExternal(external: IExternal, isDev: boolean) {
    if (external.url) {
      if (typeof external.url === "string") {
        this.requireArray.push({
          name: external.name,
          url: external.url
        })
      } else {
        this.requireArray.push({
          name: external.name,
          url: external.url[isDev ? "dev" : "prod"]
        })
      }
    } else {
      let version: string = external.version
        // @ts-ignore
        || PackageJson.devDependencies[external.name]
        // @ts-ignore
        || PackageJson.dependencies[external.name]
        || "latest";
      const link = this.getLink(external.name, version, isDev)
      this.requireArray.push({
        name: external.name,
        url: link
      })
    }
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
            let ok = false;
            this.options.appendExternal!.forEach((external) => {
              if (data.request && data.request.includes(external.name)) {
                this.appendExternal(external, isDev)
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
      ]
    } else {
      return {}
    }
  }

  fixRequireArray(requireArray: this["requireArray"], isDev: boolean): void {
    const ae = (this.options.appendExternal || []).map(e => e.name)
    const ra = requireArray.map(e => e.name)
    ae.forEach(e => {
      if (!ra.includes(e)) {
        this.appendExternal({
          name: e,
        }, isDev)
      }
    })
  }

  apply(compiler: Compiler) {
    // add external UMD module to require
    compiler.options.externals = this.fixDependencyLink(compiler)
    // change filename to .user.js
    if (typeof compiler.options.output.filename === "string" && !compiler.options.output.filename.endsWith(".user.js")) {
      compiler.options.output.filename = compiler.options.output.filename.replace(/\.js/, ".user.js")
    }
    compiler.hooks.entryOption.tap("UserscriptPlugin", ((path, entries) => {
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
      compilation.hooks.afterOptimizeAssets.tap("UserscriptPlugin", async (assets) => {
        this.fixRequireArray(this.requireArray, compiler.options.mode === "development")
        this.requireArray.forEach((require) => {
          this.addMetadata("require", require.url)
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
