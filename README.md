# Akash controller Dapp

## Notice
This app is outdated as of today. The behaviours expected from this app has to be tested and the
problems related to the deprecated dependencies should be fixed. This goes for both Agoric and Akash.

As of 2023-05-31, the code is updated so that unit tests are working with
[mainnet1B-rc1](https://github.com/Agoric/agoric-sdk/releases/tag/mainnet1B-rc1) release of `agoric-sdk`.

To run the tests;

```shell
cd dapp-akash-controller
yarn test
```

### Experimental features
I've added an experimental feature to the repo called `deploy-plugin.js` which deploys an akash plugin
to the `ag-solo` so that we can learn the state of the `akash deployment` on the Akash network. I use 
this script to test the `akashjs` library but didn't have any luck with it. I suspect that the problem
is related to the proto message formats the library is using. Anyways, I'll put the command to test this
feature out in case anybody wants to try it out themselves.

#### Terminal One

````shell
cd agoric-sdk/packages/cosmic-swingset
make scenario2-setup && make scenario2-run-chain
````


#### Terminal Two

````shell
cd agoric-sdk/packages/cosmic-swingset
make scenario2-run-client
````

#### Terminal Three

````shell
cd agoric-sdk/packages/cosmic-swingset
agoric open --repl
````

#### Terminal Four

````shell
cd dapp-akash-controller
agoric deploy api/deploy-plugin.js --allow-unsafe-plugings
````

Then go the repl and try out the plugin.

> Here's a link to a  [testnet faucet](https://faucet.testnet-02.aksh.pw/#)

Demo app controls an Akash account, watches for deployment fund, deposit to it when needed.

## (Legacy) Demo Setup

1. Create IBC channel between Akash(testnet) <-> Agoric(local)

- Run an Akash node (current running node does not support gRPC)
- Setup hermes accordingly
- Run task to create channel

2. Peg AKT from IBC connection to Agoric, by Pegasus

- Provision a Agoric account with sufficient permission
- Peg the AKT (as the Pegasus documentation)
- Import the issuer
- Create the fund `purse`

3. Send some AKT to Agoric wallet (the pegged coin)

- Run the relayer
- Setup Akash wallet correctly in keychains
- Send by CLI with correct channel setup

4. Create a deployment in Akash side (off topic)

- Create an Akash account, get some AKT from faucet
- Create cert, bid, deployment SDL as documentation
- Create the deployment

5. Start the contract with Akash secrets, created deploymentId

- Export the env variables
- Deploy the `contract`
- Deploy the api `on-chain` or `off-chain`

6. Check for changes in Akash deployment

- Take a note before transfering
- Check the change
