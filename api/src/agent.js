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
  // demo ibc transfer
  cosmosAddr,
  depositValue = 1000_000n,
  aktPeg,
  aktBrand,
  aktIssuer,
  pegasus,
  purseP,
  fund,
}) => {
  // terms assertions
  assert.typeof(checkInterval, 'bigint');
  assert(akashClient, `An "akashClient" is required`);
  assert(deploymentId, `A "deploymentId" is required`);

  let count = 0;
  let currentFund = fund;

  const fundAkashAccount = async () => {
    console.log('Funding Akash account');
    // 5m uAKT = 5AKT
    const amount = harden(AmountMath.make(aktBrand, depositValue));

    console.log('Spliting the payment');
    const [payment, remainPayment] = await E(aktIssuer).split(
      currentFund,
      amount,
    );

    // const akashAddr = E(akashClient.address);
    const akashAddr = cosmosAddr;
    currentFund = remainPayment;

    console.log('Making transfer invitation', aktPeg, akashAddr);
    const transferInvitation = await E(pegasus).makeInvitationToTransfer(
      aktPeg,
      akashAddr,
    );

    console.log('Sending offer...', amount);
    const seatP = E(zoe).offer(
      transferInvitation,
      harden({ give: { Transfer: amount } }),
      harden({ Transfer: payment }),
    );

    console.log('Waiting for the result...');
    const result = await E(seatP).getOfferResult();
    console.log('Funding, done', result);

    const payout = await E(seatP).getPayout('Transfer');

    // get back money if transfer failed
    console.log('Getting payout', payout);
    await E(purseP).deposit(payout);
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

    if (balance.amount === '0') {
      await fundAkashAccount();
      console.log('Trying to deposit payment');
      await depositDeployment();
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

  await E(akashClient).initialize();
  // setup first wakeup call
  await registerNextWakeupCheck();
};

harden(startAgent);
export default startAgent;
