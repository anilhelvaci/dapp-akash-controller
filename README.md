# Akash controller Dapp

TL;DR:

Demo app controls an Akash account, watches for deployment fund, deposit to it when needed.

## Demo Setup

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
