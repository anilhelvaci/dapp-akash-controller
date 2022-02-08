// @ts-check
import { test } from '@agoric/zoe/tools/prepare-test-env-ava.js';

import bundleSource from '@agoric/bundle-source';

import { Far } from '@agoric/marshal';
import { E } from '@agoric/eventual-send';
import { makeIssuerKit, AmountMath } from '@agoric/ertp';
import buildManualTimer from '@agoric/zoe/tools/manualTimer.js';
import { assertProposalShape } from '@agoric/zoe/src/contractSupport/index.js';
import { setupZCFTest } from '@agoric/zoe/test/unitTests/zcf/setupZcfTest.js';

const contractPath = new URL('../src/contract.js', import.meta.url).pathname;

/**
 * @param {bigint} aktAmount
 */
const makeFakeAkashClient = (aktAmount) => {
  return Far('fakeAkashClient', {
    initialize() {
      return Promise.resolve('Initialized');
    },
    getAddress() {
      return Promise.resolve('akash-adress-hash');
    },
    balance() {
      return Promise.resolve({
        denom: 'uakt',
        amount: `${aktAmount}`,
      });
    },
    depositDeployment() {
      return Promise.resolve('deposited');
    },
  });
};

/**
 * @param {*} zcf
 * @param {boolean} shouldSucceed
 */
const makeFakePegasus = (zcf, shouldSucceed) => {
  const { zcfSeat: poolSeat } = zcf.makeEmptySeatKit();

  return Far('fakePegasus', {
    /**
     *
     * @param {any} peg
     * @param {String} remoteAddr
     */
    async makeInvitationToTransfer(peg, remoteAddr) {
      assert(peg, 'a Peg is required');
      assert(remoteAddr, 'a remoteAddr is required');

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

test('zoe - watch Akash deployment, maxCount=1', async (t) => {
  t.plan(5);
  const { mint: aktMint, issuer: aktIssuer, brand: aktBrand } = makeIssuerKit(
    'fakeAkt',
  );
  const issuerKeywordRecord = harden({
    Fund: aktIssuer,
  });

  const { zoe, zcf } = await setupZCFTest(issuerKeywordRecord);
  const bundle = await bundleSource(contractPath);
  const installation = await E(zoe).install(bundle);

  const pegasus = makeFakePegasus(zcf, true);
  const akashClient = makeFakeAkashClient(0n);
  const timer = buildManualTimer(console.log);

  const aktPeg = Far('fakeAktPeg', {});

  const contractTerms = harden({
    akashClient,
    timeAuthority: timer,
    checkInterval: 1n,
    maxCount: 1,
    deploymentId: '1232',
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

  assert(creatorInvitation, 'Creator invitation must not be null');

  console.log('Sending offer...');
  const seatP = E(zoe).offer(creatorInvitation, proposal, paymentRecords);

  console.log('Waiting for result...');
  await E(seatP).getOfferResult();

  timer.tick();

  console.log('Waiting for payout');
  const payout = await E(seatP).getPayout('Fund');

  const remain = await E(aktIssuer).getAmountOf(payout);
  console.log('Payout here', remain);

  // XXX assertion
});
