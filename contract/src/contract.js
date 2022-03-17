// @ts-check
import '@agoric/zoe/exported';

import { Far } from '@agoric/marshal';
import { E } from '@agoric/eventual-send';
import { assert, details as X } from '@agoric/assert';
import {
  defaultAcceptanceMsg,
  assertProposalShape,
  assertIssuerKeywords,
  offerTo,
} from '@agoric/zoe/src/contractSupport/index.js';
import { AmountMath } from '@agoric/ertp';

/**
 * @type {ContractStartFn}
 */
const start = (zcf) => {
  assertIssuerKeywords(zcf, harden(['Fund']));

  const {
    akashClient,
    timeAuthority,
    checkInterval = 15n,
    deploymentId,
    maxCheck = 2,
    depositValue = 5_000n,
    minimalFundThreshold = 100_000n,
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
  let pendingDeposit = null;

  // 5m uAKT = 5AKT
  const aktDepositAmount = harden(AmountMath.make(brands.Fund, depositValue));

  const waitForPendingDeposit = async () => {
    try {
      console.log('Waiting for pending deposit');
      await pendingDeposit;
    } catch (err) {
      // always exit if exception occur
      console.log('Error while depositing', err);
      controllerSeat.exit();
    }
  };

  const depositAkashDeployment = async () => {
    console.log('Depositing akash deployment', deploymentId);
    const response = await E(akashClient).depositDeployment(deploymentId, {
      // amount type Coin
      amount: String(depositValue),
      denom: 'uakt',
    });
    console.log('Deposit, done', response);
  };

  const fundAkashAccount = async () => {
    console.log('Funding Akash account');
    const akashAddr = await E(akashClient).getAddress();
    const transferInvitation = await E(pegasus).makeInvitationToTransfer(
      aktPeg,
      akashAddr,
    );

    console.log('Offering transfer invitation...');
    const { userSeatPromise: transferSeatP, deposited } = await offerTo(
      zcf,
      transferInvitation,
      harden({
        Fund: 'Transfer',
      }),
      harden({
        give: {
          Transfer: aktDepositAmount,
        },
      }),
      controllerSeat,
      controllerSeat,
    );

    // register callback for deposited promise
    pendingDeposit = deposited.then(async () => {
      console.log('Transfer completed, checking result...');
      const remains = await E(transferSeatP).getCurrentAllocation();
      const transferOk = AmountMath.isEmpty(remains.Transfer);

      if (transferOk) {
        console.log('IBC transfer completed');
        // XXX should we recheck the ballance?
        await depositAkashDeployment();
      } else {
        console.log('IBC transfer failed');
      }
    });

    const result = await E(transferSeatP)
      .getOfferResult()
      .catch((err) => {
        console.error('Error while offering result', err);
        throw err;
      });
    console.log('Offer completed, result:', result);

    await waitForPendingDeposit();
    console.log('Done');
  };

  const checkAndFund = async () => {
    // deployment balance type DecCoin
    const balance = await E(akashClient).getDeploymentFund(deploymentId);
    const amount = BigInt(balance.amount) / 1_000_000_000_000_000_000n;

    console.log('Details here', deploymentId, amount, minimalFundThreshold);

    if (amount < minimalFundThreshold) {
      // funding account and deposit the watch deployment
      await fundAkashAccount();
    }
  };

  const registerNextWakeupCheck = async () => {
    count += 1;
    if (count > maxCheck) {
      console.log('Max check reached, exiting');
      controllerSeat.exit();
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
            await checkAndFund();
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
    await registerNextWakeupCheck().catch((err) => {
      controllerSeat.fail(err);
    });
  };

  /**
   * @type {OfferHandler}
   */
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
