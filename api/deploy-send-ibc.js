import { E } from '@agoric/eventual-send';

const the = harden({
  peg: {
    name: 'peg-channel-0-uphoton',
  },
  dest: {
    address: 'cosmos1p26rc0ytxvc9lhxv825ekxw43vc3ucqp4cektr',
  },
  wallet: {
    pursePetName: 'PhotonPurse',
  },
  payment: {
    value: 1000_000n / 4n,
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
  const amount = harden({ brand, value: the.payment.value });
  console.log('await payment...', { gross, amount });
  const pmt = await E(purseP).withdraw(amount);
  const seatP = E(home.zoe).offer(
    transferInvitation,
    harden({ give: { Transfer: amount } }),
    harden({ Transfer: pmt }),
  );
  console.log('await result...');
  const [result, net] = await Promise.all([
    E(seatP).getOfferResult(),
    E(purseP).getCurrentAmount(),
  ]);
  console.log({ result, net });
};

harden(deployIBCSend);
export default deployIBCSend;