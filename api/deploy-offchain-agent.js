// @ts-check
/* eslint-env node */
// Agoric Dapp api deployment script

import { E } from '@agoric/eventual-send';
import { AmountMath } from '@agoric/ertp';

import '@agoric/zoe/exported.js';

const akt = harden({
  peg: {
    name: 'peg-channel-0-uakt',
  },
  wallet: {
    pursePetName: 'Akash Deployment Fund',
  },
  payment: {
    value: 20_000n,
  },
});

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
    zoe,
    wallet,
    chainTimerService,
    scratch,
    agoricNames,
    spawner,
  } = home;

  console.log('Finding the akt fund purse');
  const purseP = E(E(wallet).getAdminFacet()).getPurse(akt.wallet.pursePetName);
  const depositFacetP = E(purseP).getDepositFacet();

  console.log('Finding the aktPeg, pegasus instance...');
  const [aktPeg, aktBrand, instance] = await Promise.all([
    E(scratch).get(akt.peg.name),
    E(purseP).getAllegedBrand(),
    E(agoricNames).lookup('instance', 'Pegasus'),
  ]);

  assert(aktPeg, 'You may need to peg the `uakt` first');
  assert(aktBrand, `No purse ${akt.wallet.pursePetName} found`);
  const pegasus = await E(home.zoe).getPublicFacet(instance);
  const aktIssuer = await E(pegasus).getLocalIssuer(aktBrand);

  const mnemonic = process.env.AKASH_MNEMNONIC;
  const rpcEndpoint = process.env.AKASH_RPC_ENDPOINT;
  const deploymentId = process.env.AKASH_WATCHED_DSEQ;

  assert(mnemonic, 'AKASH_MNEMNONIC env variables must not be empty');
  assert(rpcEndpoint, 'AKASH_RPC_ENDPOINT env variables must not be empty');
  assert(deploymentId, 'AKASH_WATCHED_DSEQ env variables must not be empty');

  // setup the Fund for this contract
  const amount = harden(AmountMath.make(aktBrand, akt.payment.value));
  const fund = await E(purseP).withdraw(amount);

  const akashClient = await installUnsafePlugin('./src/akash.js', {
    mnemonic,
    rpcEndpoint,
  }).catch((e) => console.error(`${e}`));

  // Bundle up the handler code
  const bundle = await bundleSource(pathResolve('./src/agent.js'));

  // Install it on the spawner
  const installation = E(spawner).install(bundle);

  // Spawn the function
  await E(installation).spawn({
    akashClient,
    timeAuthority: chainTimerService,
    checkInterval: 15n,
    deploymentId,
    minimalFundThreshold: 6_000_000n,
    pegasus,
    aktPeg,
    aktIssuer,
    aktBrand,
    depositFacetP,
    fund,
    zoe,
  });
}
