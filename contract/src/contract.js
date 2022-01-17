// @ts-check
import '@agoric/zoe/exported';

import { Far } from '@agoric/marshal';
import { E } from '@agoric/eventual-send';
import { assert, details as X } from '@agoric/assert';
import {
  defaultAcceptanceMsg,
  // assertProposalShape,
  // assertIssuerKeywords,
} from '@agoric/zoe/src/contractSupport/index.js';

const start = (zcf) => {
  // assertIssuerKeywords(zcf, harden(['Fund']));

  const {
    akashClient,
    timeAuthority,
    checkInterval = 15n,
    deploymentId,
    maxCount = 2,
  } = zcf.getTerms();

  // terms assertions
  assert.typeof(checkInterval, 'bigint');
  assert(akashClient, X`An "akashClient" is required`);
  assert(deploymentId, X`A "deploymentId" is required`);

  let count = 0;
  // const { zcfSeat: controllerSeat } = zcf.makeEmptySeatKit();

  const checkAndNotify = async () => {
    console.log('Checking deployment detail');
    const details = await E(akashClient).balance();
    console.log('Details here', deploymentId, details);
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

  const watchAkashDeployment = (seat) => {
    // assertProposalShape(seat, {
    //   give: { Fund: null },
    // });

    // // fund the controller seat
    // controllerSeat.incrementBy(seat.decrementBy(seat.getCurrentAllocation()));
    // zcf.reallocate(controllerSeat, seat);
    seat.exit();

    // start watching deployment
    registerNextWakeupCheck();

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
