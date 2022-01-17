import { Far } from '@agoric/marshal';
import {
  Akash,
  // SDL,
  // findDeploymentSequence
} from 'akashjs';
import { Secp256k1HdWallet } from '@cosmjs/amino';

const DEFAULT_MNEMONIC =
  'enlist hip relief stomach skate base shallow young switch frequent cry park';
const DEFAULT_AKASH_RPC = 'http://rpc.testnet-1.ewr1.aksh.pw:26657';

const initClient = async (mnemonic, rpcEndpoint) => {
  const offlineSigner = await Secp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: 'akash',
  });
  const accounts = await offlineSigner.getAccounts();
  const address = accounts[0].address;

  const akash = await Akash.connect(
    rpcEndpoint || DEFAULT_AKASH_RPC,
    offlineSigner,
  );
  console.log('==== Akash initialized, address', address);
  return { akash, address };
};

export const bootPlugin = () => {
  // console.error('booting akashClient');
  return Far('plugin', {
    /**
     * @param {Record<string, any>} _opts
     * @returns {AkashClient}
     */
    async start(_opts) {
      let akash = null;
      let address = null;

      const initialize = async () => {
        if (akash) {
          console.warn('Client initialized, ignoring...');
          return;
        }
        const mnemonic = _opts.mnemonic || DEFAULT_MNEMONIC;
        const result = await initClient(mnemonic);
        akash = result.akash;
        address = result.address;
      };

      return Far('akash-client', {
        initialize,
        async balance() {
          assert(akash, 'Client need to be initalized');
          return akash.query.bank.balance(address, 'uakt');
        },
        async getDeploymentList() {
          assert(akash, 'Client need to be initalized');
          return akash.query.deployment.list.params({
            owner: address,
          });
        },
        async getDeploymentDetail(dseq) {
          assert(akash, 'Client need to be initalized');
          await akash.query.deployment.get.params({
            owner: address,
            dseq,
          });
        },
        async depositDeployment(dseq, amount = '5000uakt') {
          assert(akash, 'Client need to be initalized');
          return akash.tx.deployment.deposit.params({
            dseq,
            amount,
          });
        },
      });
    },
  });
};

initClient(DEFAULT_MNEMONIC);
