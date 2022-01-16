import { E } from '@agoric/eventual-send';

async function startAgent({ akashClient }) {
  console.log('=============== Starting function =============');

  console.log('Initializing client =========>');
  await E(akashClient).initialize();
  console.log('Done Initializing client ========>');

  console.log('Querying ballance');
  const balances = await E(akashClient).balance();
  console.log('Balances here ===>', balances);
}

harden(startAgent);
export default startAgent;
