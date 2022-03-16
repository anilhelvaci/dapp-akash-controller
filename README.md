# Akash controller Dapp

TL;DR:

Demo dapp keeps a fund of AKT, watches for Akash deployment, if it is about to expire or over spent, then deposit some amount to it, avoid deployment from being termniated.

## Demo Setup

1. Create IBC channel between Akash(testnet) <-> Agoric(local)
   a. Run an Akash node (current running node does not support gRPC)
   b. Setup hermes accordingly
   c. Run task to create channel

2. Peg AKT from IBC connection to Agoric, by Pegasus
   a. Provision a Agoric account with sufficient permission
   b. Peg the AKT (as the Pegasus documentation)
   c. Import the issuer
   d. Create the fund `purse`

3. Send some AKT to Agoric wallet (the pegged coin)
   a. Run the relayer
   b. Setup Akash wallet correctly in keychains
   c. Send by CLI with correct channel setup

4. Create a deployment in Akash side (off topic)
   a. Create an Akash account, get some AKT from faucet
   b. Create cert, bid, deployment SDL as documentation
   c. Create the deployment

5. Start the contract with Akash secrets, created deploymentId
   a. Export the env variables
   b. Deploy the `contract`
   c. Deploy the api `on-chain` or `off-chain`

6. Check for changes in Akash deployment
   a. Take a note before transfering
   b. Check the change
