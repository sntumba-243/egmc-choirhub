export const isMobileDevice = (): boolean => {
  return /Android|iPhone|iPad/i.test(navigator.userAgent);
};
