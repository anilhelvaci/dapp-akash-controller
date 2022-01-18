// @ts-check
// Agoric Dapp api deployment script

import { E } from '@agoric/eventual-send';
import { AmountMath } from '@agoric/ertp';

import '@agoric/zoe/exported.js';

import installationConstants from '../ui/src/conf/installationConstants.js';

const akt = harden({
  peg: {
    name: 'peg-channel-0-uphoton',
  },
  wallet: {
    pursePetName: 'PhotonPurse',
  },
  payment: {
    value: 1000000n / 4n,
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
export default async function deployApi(homePromise, { installUnsafePlugin }) {
  // Let's wait for the promise to resolve.
  const home = await homePromise;

  // Unpack the references.
  const { zoe, wallet, board, chainTimerService, scratch, agoricNames } = home;

  console.log('Finding the akt fund purse');
  const purseP = E(E(wallet).getAdminFacet()).getPurse(akt.wallet.pursePetName);

  console.log('Finding the aktPeg, pegasus instance...');
  const [aktPeg, aktBrand, instance] = await Promise.all([
    E(scratch).get(akt.peg.name),
    E(purseP).getAllegedBrand(),
    E(agoricNames).lookup('instance', 'Pegasus'),
  ]);

  assert(aktPeg, 'You may need to peg the `uakt` first');
  assert(aktBrand, `No purse ${akt.wallet.pursePetName} found`);
  const pegasus = E(home.zoe).getPublicFacet(instance);

  console.info('Please allow our unsafe plugins to enable Akash connection');

  const akashClient = await installUnsafePlugin(
    './src/akash.js',
    {},
  ).catch((e) => console.error(`${e}`));

  const { INSTALLATION_BOARD_ID } = installationConstants;
  const installation = await E(board).getValue(INSTALLATION_BOARD_ID);

  const issuerKeywordRecord = harden({
    Fund: aktBrand,
  });
  const terms = harden({
    akashClient,
    timeAuthority: chainTimerService,
    checkInterval: 15n,
    deploymentId: '1232',
    pegasus,
    aktPeg,
  });

  // start the contract
  const { creatorInvitation } = await E(zoe).startInstance(
    installation,
    issuerKeywordRecord,
    terms,
  );

  assert(creatorInvitation, 'Creator invitation must not be null');
  console.log('Controller instance started');

  // set the Fund for this contract
  const amount = harden(AmountMath.make(aktBrand, akt.payment.value));
  const payment = await E(purseP).withdraw(amount);
  const proposal = harden({
    give: {
      Fund: amount,
    },
  });
  const paymentRecords = harden({
    Fund: payment,
  });

  const seatP = E(zoe).offer(creatorInvitation, proposal, paymentRecords);

  console.log('Waiting for result...');
  const result = await E(seatP).getOfferResult();

  console.log('Result here', result);
}
