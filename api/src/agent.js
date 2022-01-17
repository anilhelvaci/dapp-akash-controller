import { E } from '@agoric/eventual-send';
import { Far } from '@agoric/marshal';

const startAgent = async ({
  akashClient,
  timeAuthority,
  checkInterval,
  deploymentId,
  maxCount = 5,
}) => {
  // intializing
  await E(akashClient).initialize();
  let count = 0;

  const checkAndNotify = async () => {
    console.log('Checking deployment detail');
    const details = await E(akashClient).balance();
    console.log('Details here', deploymentId, details);
  };

  const registerNextWakeupCheck = async () => {
    count += 1;
    if (count > maxCount) {
      console.log('Max check reached, exiting');
      return;
    }
    const currentTs = await E(timeAuthority).getCurrentTimestamp();
    const checkAfter = currentTs + checkInterval;
    console.log('Registering next wakeup call at', checkAfter);

    E(timeAuthority)
      .setWakeup(
        checkAfter,
        Far('wakeObj', {
          wake: async () => {
            await checkAndNotify();
            registerNextWakeupCheck();
          },
        }),
      )
      .catch((err) => {
        console.error(
          `Could not schedule the nextWakeupCheck at the deadline ${checkAfter} using this timer ${timeAuthority}`,
        );
        console.error(err);
        throw err;
      });
  };

  // setup first wakeup call
  await registerNextWakeupCheck();
};

harden(startAgent);
export default startAgent;
