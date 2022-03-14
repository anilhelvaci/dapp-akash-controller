import { E } from '@agoric/eventual-send';
import { observeNotifier } from '@agoric/notifier';
import { AmountMath } from '@agoric/ertp';

const the = harden({
  peg: {
    name: 'peg-channel-0-uakt',
  },
  dest: {
    address: 'akash1w82000mdkth3kqn00623wgtwxu4s7kkq75cl5j',
  },
  wallet: {
    pursePetName: 'Akash Deployment Fund',
  },
  payment: {
    value: 1000_000n,
  },
});

const deployIBCSend = async (homeP, _powers) => {
  console.log('awaiting home...');
  const home = await homeP;
  const purseP = E(E(home.wallet).getAdminFacet()).getPurse(
    the.wallet.pursePetName,
  );

  console.log('await peg, instance...');
  const [peg, instance] = await Promise.all([
    E(home.scratch).get(the.peg.name),
    E(home.agoricNames).lookup('instance', 'Pegasus'),
  ]);
  const pegPub = E(home.zoe).getPublicFacet(instance);

  console.log('await transferInvitation, brand, balance...');
  const [transferInvitation, brand, gross] = await Promise.all([
    E(pegPub).makeInvitationToTransfer(peg, the.dest.address),
    E(purseP).getAllegedBrand(),
    E(purseP).getCurrentAmount(),
  ]);
  const issuer = await E(pegPub).getLocalIssuer(brand);
  const amount = harden({ brand, value: the.payment.value });
  console.log('await payment...', { gross, amount });
  const pmt = await E(purseP).withdraw(amount);
  const seatP = E(home.zoe).offer(
    transferInvitation,
    harden({ give: { Transfer: amount } }),
    harden({ Transfer: pmt }),
  );

  observeNotifier(
    E(seatP).getNotifier(),
    harden({
      fail: (reason) => {
        console.log('Contract failed', reason);
      },
    }),
  );

  console.log('await result...');
  const [result, net] = await Promise.all([
    E(seatP).getOfferResult(),
    E(purseP).getCurrentAmount(),
  ]);
  console.log({ result, net });

  console.log('Waiting for payout');
  const payout = await E(seatP).getPayout('Transfer');
  const remain = await E(issuer).getAmountOf(payout);

  console.log('Transfer failed, remain amount', remain);

  if (AmountMath.isEmpty(remain)) {
    console.log('Transfer success');
  } else {
    await E(purseP).deposit(payout);
    console.log('Deposit back');
  }
};

harden(deployIBCSend);
export default deployIBCSend;
