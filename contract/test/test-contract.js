// @ts-check
import { test } from '@agoric/zoe/tools/prepare-test-env-ava.js';

import bundleSource from '@endo/bundle-source';

import { Far } from '@agoric/marshal';
import { E } from '@agoric/eventual-send';
import { makeIssuerKit, AmountMath } from '@agoric/ertp';
import buildManualTimer from '@agoric/zoe/tools/manualTimer.js';
import { assertProposalShape } from '@agoric/zoe/src/contractSupport/index.js';
import { setupZCFTest } from '@agoric/zoe/test/unitTests/zcf/setupZcfTest.js';

const contractPath = new URL('../src/contract.js', import.meta.url).pathname;

const akash = harden({
  peg: {
    name: 'peg-channel-0-uakt',
  },
  dest: {
    address: 'akash-address-hash',
  },
  deployment: {
    id: '_watched_deployment_id_',
    value: 20_000n,
  },
});

const makeFakeAkashClient = (t) => {
  let aktAmount = 0n;

  return Far('fakeAkashClient', {
    initialize() {
      return Promise.resolve('initialized');
    },
    getAddress() {
      return Promise.resolve(akash.dest.address);
    },
    getDeploymentFund() {
      return Promise.resolve({
        denom: 'uakt',
        amount: `${aktAmount}`,
      });
    },
    depositDeployment(dseq, amount) {
      t.is(
        dseq,
        akash.deployment.id,
        'Deposited deployment id did not match watched one',
      );
      t.is(
        amount,
        `${akash.deployment.value}uakt`,
        'Deposit amount did not match',
      );
      return Promise.resolve('deposited');
    },
    /**
     * Set current AKT balance for this fake client
     * (XXX not in real client)
     *
     * @param {bigint} val
     */
    setTestAmount(val) {
      aktAmount = val;
    },
  });
};

/**
 * @param {any} t
 * @param {ContractFacet} zcf
 * @param {boolean} shouldSucceed
 */
const makeFakePegasus = (t, zcf, shouldSucceed) => {
  const { zcfSeat: poolSeat } = zcf.makeEmptySeatKit();

  return Far('fakePegasus', {
    /**
     *
     * @param {any} peg
     * @param {string} remoteAddr
     */
    async makeInvitationToTransfer(peg, remoteAddr) {
      assert(peg, 'a Peg is required');
      assert(remoteAddr, 'a remoteAddr is required');

      t.is(remoteAddr, akash.dest.address, 'Remote akash addr does not match');

      /**
       * @param {ZCFSeat} seat
       */
      const offerHandler = (seat) => {
        console.log('Checking proposal');
        assertProposalShape(seat, {
          give: {
            Transfer: null,
          },
        });

        if (shouldSucceed) {
          console.log('Should succeed, transfering to pool...');
          const { give } = seat.getProposal();

          // transfer
          seat.decrementBy(give);
          poolSeat.incrementBy(give);
          zcf.reallocate(poolSeat, seat);
        } else {
          console.log('Nothing to send');
        }
        seat.exit();
      };

      return zcf.makeInvitation(offerHandler, 'fake pegasus transfer');
    },
    getPoolSeat() {
      return poolSeat;
    },
  });
};

test('zoe - watch Akash deployment, maxCheck=1, IBC transfer failed', async (t) => {
  t.plan(2);
  const { mint: aktMint, issuer: aktIssuer, brand: aktBrand } = makeIssuerKit(
    'fakeAkt',
  );
  const issuerKeywordRecord = harden({
    Fund: aktIssuer,
  });

  const { zoe, zcf } = await setupZCFTest(issuerKeywordRecord);
  const bundle = await bundleSource(contractPath);
  const installation = await E(zoe).install(bundle);

  const pegasus = makeFakePegasus(t, zcf, false);
  const akashClient = makeFakeAkashClient(t);
  const timer = buildManualTimer(console.log);
  const aktPeg = Far('fakeAktPeg', {});

  const contractTerms = harden({
    akashClient,
    timeAuthority: timer,
    checkInterval: 1n,
    maxCheck: 1,
    deploymentId: akash.deployment.id,
    pegasus,
    aktPeg,
  });

  const { creatorInvitation } = await E(zoe).startInstance(
    installation,
    issuerKeywordRecord,
    contractTerms,
  );

  const amount = harden(AmountMath.make(aktBrand, 5_000_000n));
  const payment = await E(aktMint).mintPayment(amount);
  const proposal = harden({
    give: {
      Fund: amount,
    },
  });
  const paymentRecords = harden({
    Fund: payment,
  });

  assert(creatorInvitation);

  console.log('Sending offer...');
  const seatP = E(zoe).offer(creatorInvitation, proposal, paymentRecords);

  console.log('Waiting for result...');
  await E(seatP).getOfferResult();

  await timer.tick();

  console.log('Waiting for payout');
  const payout = await E(seatP).getPayout('Fund');

  const remain = await E(aktIssuer).getAmountOf(payout);
  console.log('Payout here', remain);

  // IBC transfer failed, Fund is not affected
  t.is(remain.value, 5_000_000n, 'The fund should be preserved');
});

test('zoe - watch Akash deployment, maxCheck=1, IBC transfer succeeded', async (t) => {
  t.plan(4);
  const { mint: aktMint, issuer: aktIssuer, brand: aktBrand } = makeIssuerKit(
    'fakeAkt',
  );
  const issuerKeywordRecord = harden({
    Fund: aktIssuer,
  });

  const { zoe, zcf } = await setupZCFTest(issuerKeywordRecord);
  const bundle = await bundleSource(contractPath);
  const installation = await E(zoe).install(bundle);

  const pegasus = makeFakePegasus(t, zcf, true);
  const akashClient = makeFakeAkashClient(t);
  const timer = buildManualTimer(console.log);
  const aktPeg = Far('fakeAktPeg', {});

  const contractTerms = harden({
    akashClient,
    timeAuthority: timer,
    checkInterval: 1n,
    maxCheck: 1,
    deploymentId: akash.deployment.id,
    depositValue: akash.deployment.value,
    pegasus,
    aktPeg,
  });

  const { creatorInvitation } = await E(zoe).startInstance(
    installation,
    issuerKeywordRecord,
    contractTerms,
  );

  const amount = harden(AmountMath.make(aktBrand, 5_000_000n));
  const payment = await E(aktMint).mintPayment(amount);
  const proposal = harden({
    give: {
      Fund: amount,
    },
  });
  const paymentRecords = harden({
    Fund: payment,
  });

  assert(creatorInvitation);

  console.log('Sending offer...');
  const seatP = E(zoe).offer(creatorInvitation, proposal, paymentRecords);

  console.log('Waiting for result...');
  await E(seatP).getOfferResult();

  await timer.tick();

  console.log('Waiting for payout');
  const payout = await E(seatP).getPayout('Fund');

  const remain = await E(aktIssuer).getAmountOf(payout);

  // IBC transfer succeeded, Fund is not deducted
  t.is(remain.value, 4_980_000n, 'The fund should be deducted');
});

test('zoe - watch Akash deployment, maxCheck=1, current Fund is sufficient', async (t) => {
  t.plan(1);
  const { mint: aktMint, issuer: aktIssuer, brand: aktBrand } = makeIssuerKit(
    'fakeAkt',
  );
  const issuerKeywordRecord = harden({
    Fund: aktIssuer,
  });

  const { zoe, zcf } = await setupZCFTest(issuerKeywordRecord);
  const bundle = await bundleSource(contractPath);
  const installation = await E(zoe).install(bundle);

  const pegasus = makeFakePegasus(t, zcf, true);
  const akashClient = makeFakeAkashClient(t);
  const timer = buildManualTimer(console.log);
  const aktPeg = Far('fakeAktPeg', {});

  const contractTerms = harden({
    akashClient,
    timeAuthority: timer,
    checkInterval: 1n,
    maxCheck: 1,
    deploymentId: akash.deployment.id,
    depositValue: akash.deployment.value,
    pegasus,
    aktPeg,
  });

  const { creatorInvitation } = await E(zoe).startInstance(
    installation,
    issuerKeywordRecord,
    contractTerms,
  );

  const amount = harden(AmountMath.make(aktBrand, 5_000_000n));
  const payment = await E(aktMint).mintPayment(amount);
  const proposal = harden({
    give: {
      Fund: amount,
    },
  });
  const paymentRecords = harden({
    Fund: payment,
  });

  assert(creatorInvitation);

  console.log('Sending offer...');
  const seatP = E(zoe).offer(creatorInvitation, proposal, paymentRecords);

  console.log('Waiting for result...');
  await E(seatP).getOfferResult();

  // this will ignore depsoiting
  akashClient.setTestAmount(10_000_000n);
  await timer.tick();

  console.log('Waiting for payout');
  const payout = await E(seatP).getPayout('Fund');

  const remain = await E(aktIssuer).getAmountOf(payout);

  // IBC transfer succeeded, Fund is not deducted
  t.is(remain.value, 5_000_000n, 'The fund should be deducted');
});

// XXX currently, we do not have any way to know the scheduled task is completed
// So we don't know when to trigger timer.tick to simulate multiple calls case.
// We may need to change the contract code to achieve this
