document.addEventListener('DOMContentLoaded', () => {
  const openSettingsButton = document.getElementById(
    'open-settings'
  ) as HTMLButtonElement | null;

  if (!openSettingsButton) {
    return;
  }

  openSettingsButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });
});

