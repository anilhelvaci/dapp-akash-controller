// @ts-check
// Agoric Dapp api deployment script

import { E } from '@agoric/eventual-send';

import '@agoric/zoe/exported.js';

// deploy.js runs in an ephemeral Node.js outside of swingset. The
// spawner runs within ag-solo, so is persistent.  Once the deploy.js
// script ends, connections to any of its objects are severed.

/**
 * @typedef {Object} DeployPowers The special powers that `agoric deploy` gives us
 * @property {(path: string) => { moduleFormat: string, source: string }} bundleSource
 * @property {(path: string, opts?: any) => Promise<any>} installUnsafePlugin
 * @property {(path: string, format?: any) => string} pathResolve
 */

/**
 * @param {any} homePromise A promise for the references
 * available from REPL home
 * @param {DeployPowers} powers
 */
export default async function deployApi(
  homePromise,
  { bundleSource, pathResolve, installUnsafePlugin },
) {
  // Let's wait for the promise to resolve.
  const home = await homePromise;

  // Unpack the references.
  const {
    // The spawner persistently runs scripts within ag-solo, off-chain.
    spawner,
  } = home;

  console.info('Please allow our unsafe plugins to enable Akash connection');

  const akashClient = await installUnsafePlugin(
    './src/akash.js',
    {},
  ).catch((e) => console.error(`${e}`));

  // Bundle up the handler code
  const bundle = await bundleSource(pathResolve('./src/agent.js'));

  // Install it on the spawner
  const installation = E(spawner).install(bundle);

  // Spawn the function
  await E(installation).spawn({
    akashClient,
  });
}
