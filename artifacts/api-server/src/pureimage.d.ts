// pureimage ships no type definitions. We use a small ambient declaration so
// the server-side image-overlay code typechecks. The library is a pure-JS
// canvas implementation used to bake crisp text hooks + logos onto generated
// images on the server (the browser canvas path can't run inside the scheduler).
declare module "pureimage";
