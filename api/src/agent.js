import { E } from '@agoric/eventual-send';
import { Far } from '@agoric/marshal';
import { AmountMath } from '@agoric/ertp';

const startAgent = async ({
  zoe,
  akashClient,
  timeAuthority,
  checkInterval = 15n,
  deploymentId,
  maxCount = 2,
  depositValue = 10_000n,
  minimalFundThreshold = 100_000n,
  aktPeg,
  aktBrand,
  aktIssuer,
  pegasus,
  depositFacetP,
  fund,
}) => {
  // terms assertions
  assert.typeof(checkInterval, 'bigint');
  assert(zoe, `zoe is required`);
  assert(akashClient, `An "akashClient" is required`);
  assert(deploymentId, `A "deploymentId" is required`);

  let count = 0;
  let currentFund = fund;

  const depositDeployment = async () => {
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
    // 5m uAKT = 5AKT
    const amount = harden(AmountMath.make(aktBrand, depositValue));

    console.log('Spliting the payment');
    const [payment, remainPayment] = await E(aktIssuer).split(
      currentFund,
      amount,
    );

    const akashAddr = await E(akashClient).getAddress();
    currentFund = remainPayment;

    console.log('Making transfer invitation', aktPeg, akashAddr);
    const transferInvitation = await E(pegasus).makeInvitationToTransfer(
      aktPeg,
      akashAddr,
    );

    const seatP = E(zoe).offer(
      transferInvitation,
      harden({ give: { Transfer: amount } }),
      harden({ Transfer: payment }),
    );

    const pendingDeposit = E(seatP)
      .getPayout('Transfer')
      .then(async (payout) => {
        // get back money if transfer failed
        console.log('Checking payout...');
        await E(depositFacetP).receive(payout);
        console.log('Deposit the payout');

        const remains = await E(seatP).getCurrentAllocation();
        if (AmountMath.isEmpty(remains.Transfer)) {
          console.log('==> Transfer success');
          await depositDeployment();
        } else {
          console.log('==> Transfer failed');
        }
        console.log('Done');
      });

    console.log('Waiting for the result...');
    await E(seatP).getOfferResult();

    console.log('Waiting for payout');
    await pendingDeposit;

    console.log('Done');
  };

  const checkAndNotify = async () => {
    // deployment balance type DecCoin
    const balance = await E(akashClient).getDeploymentFund(deploymentId);
    const amount = BigInt(balance.amount) / 1_000_000_000_000_000_000n;

    console.log('Details here', deploymentId, amount, minimalFundThreshold);

    if (amount < minimalFundThreshold) {
      await fundAkashAccount();
    } else {
      console.log('Current fund is sufficient');
    }
  };

  const registerNextWakeupCheck = async () => {
    count += 1;
    if (count > maxCount) {
      console.log('Max check reached, exiting...');
      console.log('Getting back current fund...');
      await E(depositFacetP).receive(currentFund);
      console.log('Done');
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

  await E(akashClient).initialize();
  // setup first wakeup call
  await registerNextWakeupCheck();
};

harden(startAgent);
export default startAgent;
