export default class Panel {
  constructor(options = {}) {
    const defaults = {};
    this.options = Object.assign(defaults, options);
    this.init();
  }

  init() {
    this.tabButtons = document.querySelectorAll('.tab-button');
    this.loadListeners();
  }

  loadListeners() {
    this.tabButtons.forEach((button) => {
      button.onclick = (event) => this.onClickTab(event);
    });
  }

  onClickTab(event) {
    const currentButton = event.currentTarget;
    const tabId = currentButton.getAttribute('data-tab');
    const tab = document.getElementById(tabId);
    const siblingButtons =
      currentButton.parentNode.querySelectorAll('.tab-button');
    const siblingTabs = tab.parentNode.querySelectorAll('.panel-tab');
    siblingButtons.forEach((button) => {
      if (button.id === currentButton.id) button.classList.add('active');
      else button.classList.remove('active');
    });
    siblingTabs.forEach((tab) => {
      if (tab.id === tabId) tab.classList.add('active');
      else tab.classList.remove('active');
    });
  }
}
