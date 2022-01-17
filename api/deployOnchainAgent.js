// @ts-check
// Agoric Dapp api deployment script

import { E } from '@agoric/eventual-send';

import '@agoric/zoe/exported.js';

import installationConstants from '../ui/src/conf/installationConstants.js';

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
export default async function deployApi(homePromise, { installUnsafePlugin }) {
  // Let's wait for the promise to resolve.
  const home = await homePromise;

  // Unpack the references.
  const { zoe, board, chainTimerService } = home;

  console.info('Please allow our unsafe plugins to enable Akash connection');

  const akashClient = await installUnsafePlugin(
    './src/akash.js',
    {},
  ).catch((e) => console.error(`${e}`));

  const { INSTALLATION_BOARD_ID } = installationConstants;
  const installation = await E(board).getValue(INSTALLATION_BOARD_ID);

  const issuerKeywordRecord = harden({});
  const terms = harden({
    akashClient,
    timeAuthority: chainTimerService,
    checkInterval: 15n,
    deploymentId: '1232',
  });

  // start the contract
  const { creatorInvitation } = await E(zoe).startInstance(
    installation,
    issuerKeywordRecord,
    terms,
  );

  assert(creatorInvitation, 'Creator invitation must not be null');
  console.log('Controller instance started');

  const proposal = harden({ give: {} });
  const paymentRecords = harden({});

  const seatP = E(zoe).offer(creatorInvitation, proposal, paymentRecords);

  console.log('Waiting for result...');
  const result = await E(seatP).getOfferResult();

  console.log('Result here', result);
}
