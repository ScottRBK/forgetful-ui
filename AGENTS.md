This is a mockup for ~/development/ai/mcp/forgetful/, however we should still aim for exceptional
standard in terms of quality and functionality.

For now security is not in scope, although once we transition the product to the main repo we will
certainly bring it into scope

We will use the forgetful rest api for the running forgetful instance that can be located at
127.0.0.1:8022, we will have an environment file that allows us to configure where we point
this to however

- React + Typescript with Typescript strict mode enabled
- We will use Tailwind for CSS 4 styling
- We will incorporate a simplified version of the CanvasGraph from forgetful-viz but without the
  voice interaction for now, using react-force-graph-2d

The proposal is to have the following pages:

- Login (deferred for now)
- Dashboard
- Memories
- Projects
- Plans
- Documents
- Code
- Files
- Skills
- Sessions (once added)
- Timeline
- Graph

## Detailed Requirements 

These can be found in [docs/requirements.md](./docs/requirements.md)

## Not in scope

- UI Code Architecture will be defered until we get to the forgetful repo
- Security will be defered until implement in the forgetful repo
- Sessions as these are not fully implemented yet

## Long Term Plan

- Will be built into forgetful as part of the main repo
- Optional feature
- Only available when forgetful operates as a http server (not available to stdio)
- Will serve this as static html
- Use vite to build the static html and serves them in forgetful
- Node.js is only used for development and builds, no server or server-side rendering is required by
  Node.js
- Hash routing so python will just serve up `/ui` and then the client handles what to display
