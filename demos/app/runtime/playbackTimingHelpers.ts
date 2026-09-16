/** Let DOM effects settle even when Chromium throttles an offscreen iframe's RAF.
 * This is a bounded preparation/action yield, never the autoplay clock.
 */
export function waitForPlaybackFrame(): Promise<void> {
  return new Promise((resolve) => {
    let animation = 0;
    const finish = () => {
      clearTimeout(timer);
      cancelAnimationFrame(animation);
      resolve();
    };
    const timer = setTimeout(finish, 32);
    animation = requestAnimationFrame(finish);
  });
}
