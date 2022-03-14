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

  const akash = await Akash.connect(rpcEndpoint, offlineSigner);
  console.log('Akash address', address);
  return { akash, address };
};

export const bootPlugin = () => {
  // console.error('booting akashClient');
  return Far('plugin', {
    /**
     * @param {Record<string, any>} opts
     * @returns {AkashClient}
     */
    async start(opts) {
      let akash = null;
      let address = null;

      const initialize = async () => {
        if (akash) {
          console.warn('Client initialized, ignoring...');
          return;
        }
        const mnemonic = opts.mnemonic || DEFAULT_MNEMONIC;
        const rpcEndpoint = opts.rpcEndpoint || DEFAULT_AKASH_RPC;
        const result = await initClient(mnemonic, rpcEndpoint);
        akash = result.akash;
        address = result.address;
      };

      return Far('akash-client', {
        initialize,
        getAddress: () => address,
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
        async getDeploymentFund(dseq) {
          const detail = await this.getDeploymentDetail(dseq);
          return detail.escrow_account.balance;
        },
        async depositDeployment(dseq, amount = '5000000uakt') {
          assert(akash, 'Client need to be initalized');
          return akash.tx.deployment.deposit.params({
            owner: address,
            dseq,
            amount,
          });
        },
      });
    },
  });
};

initClient(DEFAULT_MNEMONIC);
