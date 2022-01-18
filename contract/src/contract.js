// @ts-check
import '@agoric/zoe/exported';

import { Far } from '@agoric/marshal';
import { E } from '@agoric/eventual-send';
import { assert, details as X } from '@agoric/assert';
import {
  defaultAcceptanceMsg,
  assertProposalShape,
  assertIssuerKeywords,
} from '@agoric/zoe/src/contractSupport/index.js';
import { AmountMath } from '@agoric/ertp';

const start = (zcf) => {
  assertIssuerKeywords(zcf, harden(['Fund']));

  const {
    akashClient,
    timeAuthority,
    checkInterval = 15n,
    deploymentId,
    maxCount = 2,
    // demo ibc transfer
    cosmosAddr,
    depositValue = 5_000n,
    aktPeg,
    pegasus,
    brands,
  } = zcf.getTerms();

  // terms assertions
  assert.typeof(checkInterval, 'bigint');
  assert(akashClient, X`An "akashClient" is required`);
  assert(deploymentId, X`A "deploymentId" is required`);

  let count = 0;
  let controllerSeat;
  const zoeService = zcf.getZoeService();

  const fundAkashAccount = async () => {
    console.log('Funding Akash account');
    // 5m uAKT = 5AKT
    const amount = harden(AmountMath.make(brands.Fund, depositValue));
    const payment = zcf.decrementBy(controllerSeat, amount);
    // const akashAddr = E(akashClient.address);
    const akashAddr = cosmosAddr;

    const transferInvitation = await E(pegasus).makeInvitationToTransfer(
      aktPeg,
      akashAddr,
    );

    const seatP = E(zoeService).offer(
      transferInvitation,
      harden({ give: { Transfer: amount } }),
      harden({ Transfer: payment }),
    );

    const result = await E(seatP).getOfferResult();
    console.log('Funding, done', result);

    const payout = await E(seatP).getPayout('Transfer');

    // get back money if transfer failed
    zcf.incrementBy(payout);
  };

  const depositDeployment = async () => {
    console.log('Depositing akash deployment', deploymentId);
    const response = await E(akashClient).depositDeployment(
      deploymentId,
      '5000000uakt',
    );
    console.log('Deposit, done', response);
  };

  const checkAndNotify = async () => {
    console.log('Checking deployment detail');
    const balance = await E(akashClient).balance();
    console.log('Details here', deploymentId, balance);

    if (!balance.amount) {
      await fundAkashAccount();
      console.log('Trying to deposit payment');
      // await depositDeployment();
    }
  };

  const registerNextWakeupCheck = async () => {
    count += 1;
    if (count > maxCount) {
      console.log('Max check reached, exiting');
      return;
    }
    const currentTs = await E(timeAuthority).getCurrentTimestamp();
    const checkAfter = currentTs + checkInterval;
    console.log('Registering next wakeup call at', checkAfter);

    E(timeAuthority)
      .setWakeup(
        checkAfter,
        Far('wakeObj', {
          wake: async () => {
            await checkAndNotify();
            registerNextWakeupCheck();
          },
        }),
      )
      .catch((err) => {
        console.error(
          `Could not schedule the nextWakeupCheck at the deadline ${checkAfter} using this timer ${timeAuthority}`,
        );
        console.error(err);
        throw err;
      });
  };

  const startWatchingDeployment = async () => {
    // init the client
    await E(akashClient).initialize();

    // register next call
    registerNextWakeupCheck();
  };

  const watchAkashDeployment = (seat) => {
    assertProposalShape(seat, {
      give: { Fund: null },
    });

    controllerSeat = seat;
    // start watching deployment
    startWatchingDeployment();

    return defaultAcceptanceMsg;
  };

  const creatorInvitation = zcf.makeInvitation(
    watchAkashDeployment,
    'watchAkashDeployment',
  );

  return harden({
    creatorInvitation,
  });
};

harden(start);
export { start };
