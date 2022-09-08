# React userscript template with typescript

## Add module to external

for example:

### MaterialUI

```typescript:webpack.config.ts
    new UserscriptPlugin({
      useCDN: true,
      appendExternal: [
        {
          name: "@mui/material",
          as: "MaterialUI"
        },
      ]
    }),
```

### React Bootstrap

Currently only works in production builds.

```typescript:webpack.config.ts
    new UserscriptPlugin({
      useCDN: true,
      appendExternal: [
        {
          name: "react-bootstrap",
          as: "ReactBootstrap"
        },{
          name: "react-is",
          as: "ReactIs"
        },
      ]
    }),
```

### Redux Toolkit

```typescript:webpack.config.ts
    new UserscriptPlugin({
      useCDN: true,
      appendExternal: [
        {
          name: "@reduxjs/toolkit",
          as: "RTK"
        },
        {
          name: "react-redux",
          as: "ReactRedux"
        },
      ]
    }),
```

## Update URL

<https://[username].github.io/[reponame]/main.user.js>
