import { E } from '@endo/far';

const deployPlugin = async (homeP, { installUnsafePlugin }) => {
  const akashClient = await installUnsafePlugin('./src/akash.js', {
    mnemonic: 'flash street nose country hill fix tide ridge humble finish harbor wide',
    rpcEndpoint: 'http://rpc.testnet-02.aksh.pw:26657',
  }).catch((e) => console.error(`${e}`));

  const { scratch } = E.get(homeP);

  await E(scratch).set('akash-client-1', akashClient);
  console.log('Done');
};

export default deployPlugin;