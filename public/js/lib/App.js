import Config from './Config.js';
import Data from './Data.js';
import Helper from './Helper.js';
import Map from './Map.js';
import Panel from './Panel.js';
import Search from './Search.js';

export default class App {
  constructor(options = {}) {
    const defaults = {};
    this.options = Object.assign(defaults, options);
    this.init();
  }

  async init() {
    this.setResetButton();
    const { mapState, dataState } = this.getStateFromURL();
    const mapOptions = Object.assign(mapState, {
      onChangeState: () => {
        this.updateURL();
      },
    });
    this.map = new Map(mapOptions);
    const dataOptions = Object.assign(dataState, {
      onClickResult: (index) => {
        this.map.selectMarker(index);
        this.map.jumpToMarker(index);
      },
      onFilter: () => {
        this.map.filter(this.data.getResults());
      },
      onChangeState: () => {
        this.updateURL();
      },
    });
    this.data = new Data(dataOptions);
    this.panel = new Panel();
    this.search = new Search({
      onClickResult: (index) => {
        this.map.selectMarker(index);
        this.map.jumpToMarker(index);
      },
    });
    await this.data.load();
    this.data.renderFacets();
    this.search.setData(this.data.items);
    this.map.setData(this.data.items);
    this.map.loadMarkers();
    this.map.loadColorOptions(Config.colorBy);
    const colorOption = this.map.getCurrentColorOption();
    this.map.updateColors(colorOption);
    this.map.filter(this.data.getResults());
    this.map.loadListeners();
    this.data.loadListeners();
  }

  getStateFromURL() {
    const state = Helper.queryParams();
    const mapDefaults = Map.defaults();
    const mapKeys = Object.keys(mapDefaults);
    const mapState = Helper.whereObj(state, (key, value) =>
      mapKeys.includes(key),
    );
    let dataFilters = Helper.whereObj(
      state,
      (key, value) => !mapKeys.includes(key),
    );
    const dataState = {};
    if ('sortBy' in dataFilters) {
      const sortBy = dataFilters.sortBy;
      delete dataFilters.sortBy;
      dataState.filters = dataFilters;
      dataState.sortBy = sortBy;
    } else {
      dataState.filters = dataFilters;
    }
    return {
      mapState,
      dataState,
    };
  }

  setResetButton() {
    const $link = document.getElementById('reset-link');
    const url = new URL(window.location);
    $link.setAttribute('href', url.pathname);
  }

  updateURL() {
    const dataState = this.data.getState();
    const mapState = this.map.getState();
    Helper.pushURLState(Object.assign({}, dataState, mapState));
  }
}
