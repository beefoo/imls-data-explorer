import FlexSearch from '../vendor/flexsearch.light.module.min.js';

export default class Search {
  constructor(options = {}) {
    const defaults = {
      onClickResult: (_index) => {},
    };
    this.options = Object.assign(defaults, options);
    this.init();
  }

  init() {
    this.data = [];
    this.dataIndexed = false;
    this.index = FlexSearch.Index({
      tokenize: 'full',
    });
    this.$form = document.getElementById('search-form');
    this.$input = document.getElementById('search-input');
    this.$results = document.getElementById('search-result-list');
    this.loadListeners();
  }

  loadListeners() {
    this.$form.onsubmit = (event) => this.onSearch(event);

    this.$results.onclick = (event) => {
      const $target = event.target.closest('.result-button');
      if ($target) this.onClickResult($target);
    };
  }

  onClickResult($button) {
    const index = parseInt($button.getAttribute('data-index'), 10);
    this.options.onClickResult(index);
  }

  onSearch(event) {
    event.preventDefault();

    if (!this.dataIndexed) return;

    const query = this.$input.value.trim();
    let html = `<li>No results found</li>`;

    if (query.length <= 0) {
      this.$results.innerHTML = html;
      return;
    }

    const results = this.index.search(query);
    if (results.length <= 0) {
      this.$results.innerHTML = html;
      return;
    }

    const { data } = this;
    html = '';
    results.forEach((index, i) => {
      const item = data[index];
      html += `<li><button data-index="${item.originalIndex}" class="result-button">${i + 1}. ${item.name} <small>(${item.city}, ${item.state})</small></button></li>`;
    });
    this.$results.innerHTML = html;
  }

  setData(data) {
    data.forEach((item) => {
      const text = `${item.name}, ${item.city}, ${item.state}`;
      this.index.add(item.originalIndex, text);
    });
    this.data = data;
    this.dataIndexed = true;
  }
}
