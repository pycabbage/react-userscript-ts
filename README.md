# React userscript template with typescript

## Add module to external

for example:

```typescript:webpack.config.ts
    new UserscriptPlugin({
      useCDN: true,
      appendExternal: [{
        name: "@mui/material",
        as: "MaterialUI"
      }]
    }),
```

## Update URL

<https://[username].github.io/[reponame]/main.user.js>
