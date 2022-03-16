import { Far } from '@agoric/marshal';
import { Akash } from 'akashjs';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';

const DEFAULT_MNEMONIC =
  'enlist hip relief stomach skate base shallow young switch frequent cry park';
const DEFAULT_AKASH_RPC = 'http://rpc.edgenet-1.ewr1.aksh.pw:26657';

const initClient = async (mnemonic, rpcEndpoint) => {
  const offlineSigner = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
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
          console.log('Getting deployment list');
          return akash.query.deployment.list.params({
            owner: address,
          });
        },
        async getDeploymentDetail(dseq) {
          console.log('Getting deployment detail', dseq);
          assert(akash, 'Client need to be initalized');
          return akash.query.deployment.get.params({
            owner: address,
            dseq,
          });
        },
        async getDeploymentFund(dseq) {
          console.log('Getting deployment fund', dseq);
          const detail = await this.getDeploymentDetail(dseq);
          return detail.escrowAccount.balance;
        },
        async depositDeployment(dseq, amount) {
          assert(akash, 'Client need to be initalized');
          console.log('Depositing deployment', dseq, amount);
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
