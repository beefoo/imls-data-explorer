import Config from './Config.js';
import Helper from './Helper.js';

export default class Data {
  constructor(options = {}) {
    const defaults = {
      filters: {},
      maxResults: 1000,
      onChangeState: () => {},
      onClickResult: (_index) => {},
      onFilter: () => {},
      sortBy: 'name-asc',
      similarity: 'data/2022-library-data-similarity.json',
      src: 'data/2022-library-data.json',
    };
    this.options = Object.assign(defaults, options);
    this.init();
  }

  init() {
    this.items = [];
    this.sortBy = this.options.sortBy;
    this.filters = this.options.filters;
    this.$results = document.getElementById('tab-results');
    this.$filters = document.getElementById('filters-content');
    this.autoFields = {};
  }

  applyFiltersAndSort() {
    const { filters, sortBy } = this;
    const [sortByField, sortDirection] = sortBy.split('-', 2);
    this.results = this.items.filter((row) => {
      let valid = true;
      for (const [field, value] of Object.entries(filters)) {
        if (!(field in row && row[field] === value)) valid = false;
      }
      return valid;
    });
    const sorter = Helper.where(Config.sortBy, 'field', sortBy);
    this.results.sort((a, b) => {
      if ('isalpha' in sorter) {
        return a[sortByField]
          .toLowerCase()
          .localeCompare(b[sortByField].toLowerCase());
      }
      return sortDirection === 'asc'
        ? a[sortByField] - b[sortByField]
        : b[sortByField] - a[sortByField];
    });
  }

  filterResults() {
    const $filters = document.querySelectorAll('.select-filter');
    const filters = {};
    $filters.forEach(($filter) => {
      let { value } = $filter;
      if (!value || value === 'all') return;
      if (/^\d+$/.test(value)) value = parseInt(value, 10);
      filters[$filter.getAttribute('data-field')] = value;
    });
    this.filters = filters;
    this.applyFiltersAndSort();
    this.renderResults();
    this.renderFacets();
    this.options.onFilter();
    this.options.onChangeState();
  }

  getAutoFieldValues(field) {
    if (field in this.autoFields) return this.autoFields[field];
    const allValues = this.items.map((item) => item[field]);
    const uniqueValues = allValues
      .filter((item, i, arr) => arr.indexOf(item) === i)
      .sort();
    const fieldValues = uniqueValues.map((value) => {
      return {
        label: value,
        value,
      };
    });
    this.autoFields[field] = fieldValues;
    return fieldValues;
  }

  getResultMessage() {
    const { results, totalPopulation } = this;
    const count = results.length;
    const population = Helper.sum(results, 'pop_lsa');
    const popPercent = (population / totalPopulation) * 100;
    const popPecentString =
      popPercent < 100 ? ` (${popPercent.toFixed(2)}% of total served)` : '';
    return `Found <strong>${count.toLocaleString()}</strong> libraries serving <strong>${population.toLocaleString()}${popPecentString}</strong> people`;
  }

  getResults() {
    return this.results.map((result) => result.originalIndex);
  }

  getState() {
    return Object.assign({}, this.filters, { sortBy: this.sortBy });
  }

  async load() {
    const { options } = this;
    const response = await fetch(options.src);
    const table = await response.json();
    const rows = this.constructor.parseTable(table);
    const items = this.constructor.parseItems(rows);
    const similarityResp = await fetch(options.similarity);
    const similarity = await similarityResp.json();
    items.forEach((_item, i) => {
      items[i].similar = similarity[i];
    });
    this.totalPopulation = Helper.sum(items, 'pop_lsa');
    this.items = items;
    this.applyFiltersAndSort();
    this.renderResults();
  }

  loadFilterListeners() {
    const filterSelects = document.querySelectorAll('.select-filter');
    filterSelects.forEach(($select) => {
      $select.onchange = (_event) => this.filterResults();
    });
  }

  loadListeners() {
    this.$results.onclick = (event) => {
      const $target = event.target.closest('.result-button');
      if ($target) this.onClickResult($target);
    };

    this.$results.onchange = (event) => {
      const $target = event.target.closest('#sort-by');
      if ($target) this.onChangeSort();
    };
  }

  onChangeSort() {
    const $sortBy = document.getElementById('sort-by');
    this.sortBy = $sortBy.value;
    this.applyFiltersAndSort();
    this.renderResults();
    this.options.onChangeState();
  }

  onClickResult($button) {
    const index = parseInt($button.getAttribute('data-index'), 10);
    this.options.onClickResult(index);
  }

  static parseItems(rows) {
    const { filterBy } = Config;
    // calculate value ranges for percent ranges
    const ranges = {};
    filterBy.forEach((filter) => {
      const { type, field } = filter;
      if (type === 'perc_range') {
        const values = rows.map((row) => (field in row ? row[field] : -1));
        const minValue = Helper.minList(values);
        const maxValue = Helper.maxList(values);
        ranges[field] = [minValue, maxValue];
      }
    });
    const items = rows.map((row, i) => {
      const item = structuredClone(row);
      item.originalIndex = i;
      item.perc_onsite_programs =
        item.programs > 0 ? (item.onsite_programs / item.programs) * 100 : 0;
      item.onsite_attendance_per_program =
        item.onsite_programs > 0
          ? item.onsite_program_attendance / item.onsite_programs
          : 0;
      // add new fields for filters that are ranges
      filterBy.forEach((filter) => {
        const { field, type, values } = filter;
        let itemValue = field in row ? row[field] : -1;
        if (type === 'perc_range') {
          const [minValue, maxValue] = ranges[field];
          itemValue = Helper.norm(itemValue, minValue, maxValue) * 100;
        }
        if (type === 'range' || type === 'perc_range') {
          let found = false;
          values.forEach((v) => {
            if (found) return;
            if (
              'minValue' in v &&
              'maxValue' in v &&
              itemValue >= v.minValue &&
              itemValue < v.maxValue
            ) {
              item[`filter-${field}`] = v.label;
              found = true;
              return;
            } else if (
              'minValue' in v &&
              !('maxValue' in v) &&
              itemValue >= v.minValue
            ) {
              item[`filter-${field}`] = v.label;
              found = true;
              return;
            } else if (
              'maxValue' in v &&
              !('minValue' in v) &&
              itemValue < v.maxValue
            ) {
              item[`filter-${field}`] = v.label;
              found = true;
              return;
            }
          });
        }
      });
      return item;
    });
    // calculate +/- median values
    const scoreColumns = [
      'income',
      'perc_white',
      'perc_black',
      'perc_indigenous',
      'perc_api',
      'perc_hispanic',
      'perc_minor',
      'perc_senior',
      'median_age',
      'op_revenue_per_capita',
      'visits_per_capita',
      'programs_per_capita',
      'attendance_per_program',
      'onsite_attendance_per_program',
      'computer_per_capita',
      'wifi_per_capita',
      'staff_per_capita',
    ];
    const medianValues = {};
    const stdValues = {};
    scoreColumns.forEach((col) => {
      medianValues[col] = Helper.medianList(items.map((item) => item[col]));
      stdValues[col] = Helper.stdList(items.map((item) => item[col]));
    });
    items.forEach((item, i) => {
      scoreColumns.forEach((col) => {
        const delta = item[col] - medianValues[col];
        items[i][`${col}_score`] = Data.toPlusMinus(delta, stdValues[col], 2);
      });
    });

    return items;
  }

  static parseTable(table) {
    const { rows, cols } = table;
    return rows.map((row) => {
      const item = {};
      cols.forEach((col, i) => {
        item[col] = row[i];
      });
      return item;
    });
  }

  renderFacets() {
    const { filters, results } = this;
    const { filterBy } = Config;
    const { $filters } = this;
    const filtersWithCounts = filterBy.map((item) => {
      const newItem = structuredClone(item);
      if (newItem.values === 'auto') {
        newItem.values = this.getAutoFieldValues(item.field);
      }
      return newItem;
    });

    // initialize counts
    filtersWithCounts.forEach((filter, i) => {
      filter.values.forEach((v, j) => {
        filtersWithCounts[i].values[j].count = 0;
      });
    });

    // calculate counts from results
    results.forEach((result) => {
      filtersWithCounts.forEach((filter, i) => {
        const { values, field, type } = filter;
        const itemField = type === 'value' ? field : `filter-${field}`;
        const itemValue = itemField in result ? result[itemField] : false;
        let found = false;
        values.forEach((v, j) => {
          if (found) return;
          const value = type === 'value' ? v.value : v.label;
          if (value === itemValue) {
            filtersWithCounts[i].values[j].count += 1;
            found = true;
            return;
          }
        });
      });
    });

    // render the results
    let html = '';
    html += `<p>${this.getResultMessage()}</p>`;
    filtersWithCounts.forEach((filter) => {
      const { label, field, type, values } = filter;
      const fieldName = type === 'value' ? field : `filter-${field}`;
      html += `<label for="filter-${field}">${label}</label>`;
      html += `<select id="filter-${field}" name="filter-${field}" data-field="${fieldName}" class="select-filter">`;
      html += '  <option value="all">All</option>';
      values.forEach((v) => {
        const value = 'value' in v ? v.value : v.label;
        const selected =
          fieldName in filters && filters[fieldName] === value
            ? 'selected'
            : '';
        html += `  <option value="${value}" ${selected}>${v.label}`;
        if (v.count > 0) html += `(${v.count.toLocaleString()})`;
        html += '</option>';
      });
      html += '</select>';
    });
    $filters.innerHTML = html;

    this.loadFilterListeners();
  }

  renderResults() {
    const { maxResults } = this.options;
    let { results, $results, filters, sortBy } = this;
    const count = results.length;
    if (count > maxResults) results = results.slice(0, maxResults);
    // result message
    let html = '';
    html += `<p>${this.getResultMessage()}`;

    // filter list
    if (Object.keys(filters).length > 0) {
      html += ' with filters: ';
      let filterStrings = [];
      for (const [field, value] of Object.entries(filters)) {
        const fieldLookup = field.replace('filter-', '');
        const filter = Helper.where(Config.filterBy, 'field', fieldLookup);
        let label = value;
        if (filter.type === 'value' && filter.values !== 'auto') {
          const v = Helper.where(filter.values, 'value', value);
          label = v.label;
        }
        filterStrings.push(
          `<span class="filter-label">${filter.label} = "${label}"</span>`,
        );
      }
      html += filterStrings.join(', ');
    }
    html += '.</p>';

    // Sort by
    html += '<label for="sort-by">Sort by:</label>';
    html += '<select id="sort-by" name="sort-by">';
    Config.sortBy.forEach((s) => {
      const selected = s.field === sortBy ? 'selected' : '';
      html += `<option value="${s.field}" ${selected}>${s.label}</option>`;
    });
    html += '</select>';

    // Result list
    html += '<ul class="result-list">';
    results.forEach((item, i) => {
      html += `<li><button data-index="${item.originalIndex}" class="result-button">${i + 1}. ${item.name} <small>(${item.city}, ${item.state})</small></button></li>`;
    });
    html += '</ul>';
    $results.innerHTML = html;
    $results.scrollTop = 0;
  }

  static toPlusMinus(value, std, precision = 3) {
    const symbol = value > 0 ? '↑' : '↓';
    const valueString = parseFloat(
      Math.abs(value).toFixed(precision),
    ).toLocaleString();
    const stds = Math.ceil(Math.abs(value) / std);
    let string = '';
    for (let i = 0; i < stds; i += 1) {
      string += symbol;
    }
    string += ` ${valueString}`;
    return string;
  }
}
