import * as L from '../vendor/leaflet.js';
import Config from './Config.js';
import Gradient from './Gradient.js';
import Helper from './Helper.js';

export default class Map {
  constructor(options = {}) {
    this.init(options);
  }

  static defaults() {
    return {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      colorBy: 'pop_lsa',
      el: 'map',
      lat: 38.5767,
      lon: -92.1736, // Jefferson City, MO as center
      markerOpacity: [0.5, 0.9],
      markerRadius: [3, 30],
      minZoom: 4,
      maxZoom: 18,
      onChangeState: () => {},
      select: -1,
      strokeColor: '#00db42',
      tileUrlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      zoom: 4,
    };
  }

  init(options) {
    this.options = Object.assign(this.constructor.defaults(), options);
    this.colorOptions = [];
    this.data = [];
    this.markers = [];
    this.selectedMarkerIndex = parseInt(this.options.select);
    this.activeMarkerIndex = this.selectedMarkerIndex;
    this.colorBy = this.options.colorBy;
    this.gradient = new Gradient();
    this.$meta = document.getElementById('meta');
    this.$metaTitle = document.getElementById('meta-title');
    this.$metaDetails = document.getElementById('meta-details');
    this.$metaSimilar = document.getElementById('meta-similar');
    this.$keyLabel = document.getElementById('quant-key-label');
    this.$keyLabelLeft = document.getElementById('quant-key-label-left');
    this.$keyLabelRight = document.getElementById('quant-key-label-right');
    this.loadMap();
  }

  deselectMarker() {
    this.$meta.classList.remove('selected');
    if (this.selectedMarkerIndex >= 0)
      this.markers[this.selectedMarkerIndex].el.setStyle({ stroke: false });
    this.selectedMarkerIndex = -1;
  }

  filter(indices) {
    this.markers.forEach((marker, i) => {
      const wasVisible = marker.visible;
      const isVisible = indices.includes(i);
      this.markers[i].visible = isVisible;
      if (isVisible && !wasVisible) marker.el.addTo(this.markerGroup);
      else if (!isVisible && wasVisible) marker.el.removeFrom(this.markerGroup);
    });
  }

  getCurrentColorOption() {
    return document.querySelector('input[name="color-by"]:checked').value;
  }

  static getElectionString(item) {
    let electionString = 'Unknown';
    if (item.vote_points < 0)
      electionString = `<span style="color: blue">+${Math.abs(item.vote_points)} Dem</span>`;
    else if (item.vote_points > 0)
      electionString = `<span style="color: red">+${item.vote_points} Rep</span>`;
    return electionString;
  }

  getMarkerProperties() {
    const { minZoom, maxZoom, markerOpacity, markerRadius } = this.options;
    const zoom = this.map.getZoom();
    const nzoom = Helper.norm(zoom, minZoom, maxZoom);
    const opacity = Helper.lerp(markerOpacity[0], markerOpacity[1], nzoom);
    const radius = Helper.lerp(markerRadius[0], markerRadius[1], nzoom);
    return { opacity, radius };
  }

  getState() {
    const latlon = this.map.getCenter();
    return {
      colorBy: this.colorBy,
      lat: latlon.lat,
      lon: latlon.lng,
      select: this.selectedMarkerIndex,
      zoom: this.map.getZoom(),
    };
  }

  jumpToMarker(markerIndex) {
    const item = this.data[markerIndex];
    const zoom = Math.max(this.map.getZoom(), 10);
    this.map.flyTo([item.lat, item.lon], zoom);
  }

  loadColorOptions(options) {
    // pre-compute colors
    const { colorBy, gradient, data } = this;
    options.forEach((opt) => {
      if (opt.type === 'quant') {
        const values = data.map((item) => {
          let value = item[opt.field];
          if ('maxValue' in opt) value = Math.min(opt.maxValue, value);
          if ('pow' in opt)
            value = value >= 0 ? Math.pow(value, opt.pow) : value;
          return value;
        });
        const maxValue = Helper.maxList(values);
        const minValue = Helper.minList(values);
        this.markers.forEach((_marker, index) => {
          const value = values[index];
          if ('minValue' in opt && value < opt.minValue) {
            this.markers[index].colors[opt.field] = '#ffffff';
          } else {
            this.markers[index].colors[opt.field] = gradient.colorFromQuant(
              value,
              minValue,
              maxValue,
              true,
            );
          }
        });
      } else {
        const values = opt.values.map((v) => v.value);
        this.markers.forEach((_marker, index) => {
          const value = data[index][opt.field];
          this.markers[index].colors[opt.field] = gradient.colorFromQual(
            value,
            values,
          );
        });
      }
    });
    // render options
    const parent = document.getElementById('colors-content');
    let html = '';
    options.forEach((opt, i) => {
      const checked = opt.field === colorBy ? ' checked' : '';
      html += `<label class="radio-label" for="color-${opt.field}">`;
      html += `  <input type="radio" id="color-${opt.field}" name="color-by" value="${opt.field}" ${checked} />`;
      html += `  ${opt.label}`;
      html += '</label>';
    });
    parent.innerHTML = html;
    this.colorOptions = options;
    this.colorInputs = document.querySelectorAll('input[name="color-by"]');
  }

  loadListeners() {
    this.map.on('zoomend', (event) => this.onZoom(event));
    this.map.on('moveend', (event) => this.onMove(event));
    this.colorInputs.forEach((input) => {
      input.onchange = (event) => this.onColorChange(event);
    });
    document.getElementById('close-details').onclick = (event) => {
      this.toggleMeta();
    };
    this.$metaSimilar.onclick = (event) => {
      const $target = event.target.closest('.item-link');
      if ($target) this.onClickItem($target);
    };
  }

  loadMap() {
    const { options } = this;
    const map = L.map(options.el).setView(
      [parseFloat(options.lat), parseFloat(options.lon)],
      parseInt(options.zoom),
    );
    L.tileLayer(options.tileUrlTemplate, {
      minZoom: options.minZoom,
      maxZoom: options.maxZoom,
      attribution: options.attribution,
    }).addTo(map);
    this.map = map;
  }

  loadMarkers() {
    const { data, options } = this;
    const { opacity, radius } = this.getMarkerProperties();
    const markerGroup = new L.LayerGroup();
    this.markers = data.map((item, index) => {
      const marker = L.circleMarker([item.lat, item.lon], {
        fillOpacity: opacity,
        radius,
        stroke: false,
        color: options.strokeColor,
      });
      marker.on('mouseover', (_event) => this.onMarkerOver(index));
      marker.on('click', (_event) => this.onMarkerClick(index));
      marker.addTo(markerGroup);
      return {
        colors: {},
        visible: true,
        el: marker,
      };
    });
    markerGroup.addTo(this.map);
    this.markerGroup = markerGroup;
    if (this.selectedMarkerIndex >= 0)
      this.selectMarker(this.selectedMarkerIndex);
  }

  onClickItem($button) {
    const index = parseInt($button.getAttribute('data-index'), 10);
    this.selectMarker(index);
    this.jumpToMarker(index);
  }

  onColorChange(event) {
    const input = event.currentTarget;
    const { value } = input;
    this.updateColors(value);
  }

  onMarkerClick(markerIndex) {
    this.selectMarker(markerIndex);
    this.options.onChangeState();
  }

  onMarkerOver(markerIndex) {
    const { $meta, $metaTitle } = this;
    if ($meta.classList.contains('selected')) return;
    const item = this.data[markerIndex];
    this.activeMarkerIndex = markerIndex;
    $metaTitle.innerHTML = `${item.name} <small>(${item.city}, ${item.state})</small>`;
    $meta.classList.add('active');
  }

  onMove(_event) {
    this.options.onChangeState();
  }

  onZoom(_event) {
    const { opacity, radius } = this.getMarkerProperties();
    this.markers.forEach((marker) => {
      marker.el.setRadius(radius);
      if (marker.visible) marker.el.setStyle({ fillOpacity: opacity });
      else marker.el.setStyle({ fillOpacity: 0 });
    });
    this.options.onChangeState();
  }

  renderDetails(item) {
    const localeType = Helper.where(
      Config.localeTypes,
      'value',
      item.locale_type,
    );
    const region = Helper.where(Config.regions, 'value', item.region);
    const electionString = this.constructor.getElectionString(item);
    let html = '';
    html += '<dl>';
    html += `  <dt>Address</dt><dd><a href="${item.geo_url}" target="_blank">${item.address}, ${item.city}, ${item.state}</a></dd>`;
    html += `  <dt>Service area population</dt><dd>${item.pop_lsa.toLocaleString()}</dd>`;
    html += `  <dt>Locale type</dt><dd>${localeType.label}, ${region.label}</dd>`;
    html += `  <dt>Median household income (Census)</dt><dd>$${item.income.toLocaleString()} (${item.income_score.toLocaleString()})</dd>`;
    html += `  <dt>Staff</dt><dd>${item.staff.toLocaleString()} (${item.librarians.toLocaleString()} librarians) / ${item.staff_per_capita.toLocaleString()} per 1000 people (${item.staff_per_capita_score})</dd>`;
    html += `  <dt>Revenue (operating)</dt><dd>$${item.op_revenue.toLocaleString()} / $${item.op_revenue_per_capita.toLocaleString()} per capita (${item.op_revenue_per_capita_score})</dd>`;
    html += `  <dt>Revenue (capital)</dt><dd>$${item.cap_revenue.toLocaleString()}</dd>`;
    html += `  <dt>Items</dt><dd>${item.tot_phys_items.toLocaleString()} physical / ${item.tot_e_items.toLocaleString()} electronic</dd>`;
    html += '</dl>';
    html += '<dl>';
    html += `  <dt>Visits</dt><dd>${item.visits.toLocaleString()} / ${item.visits_per_capita.toLocaleString()} per capita (${item.visits_per_capita_score})</dd>`;
    html += `  <dt>Total programs</dt><dd>${item.programs.toLocaleString()} / ${item.programs_per_capita.toLocaleString()} per capita (${item.programs_per_capita_score})</dd>`;
    html += `  <dt>Percent programs on-site</dt><dd>${item.perc_onsite_programs.toFixed(2)}%</dd>`;
    html += `  <dt>Total program attendence</dt><dd>${item.program_attendance.toLocaleString()} / ${item.attendance_per_program.toLocaleString()} per program (${item.attendance_per_program_score})</dd>`;
    html += `  <dt>On-site program attendance</dt><dd>${item.onsite_program_attendance.toLocaleString()} / ${item.onsite_attendance_per_program.toFixed(2)} per program (${item.onsite_attendance_per_program_score})</dd>`;
    html += `  <dt>Computer sessions</dt><dd>${item.computer_sessions.toLocaleString()} / ${item.computer_per_capita.toLocaleString()} per capita (${item.computer_per_capita_score})</dd>`;
    html += `  <dt>Wireless sessions</dt><dd>${item.wireless_sessions.toLocaleString()} / ${item.wifi_per_capita.toLocaleString()} per capita (${item.wifi_per_capita_score})</dd>`;
    html += '</dl>';
    this.$metaDetails.innerHTML = html;
  }

  renderSimilar(item) {
    if (!('similar' in item) || !item.similar) return;
    const { data } = this;
    const rows = [item].concat(item.similar.map((index) => data[index]));
    let html = '<table>';
    html +=
      '<tr><th>&nbsp;</th><th>Name</th><th>Location</th><th>Region</th><th>Locale type</th><th>Household Income</th></tr>';
    rows.forEach((row, i) => {
      const localeType = Helper.where(
        Config.localeTypes,
        'value',
        row.locale_type,
      );
      const region = Helper.where(Config.regions, 'value', row.region);
      const electionString = this.constructor.getElectionString(row);
      html += '<tr>';
      html += `<td>${i}.</td>`;
      html += `<td><button class="item-link" data-index="${row.originalIndex}">${row.name}</button></td>`;
      html += `<td>${row.city}, ${row.state}</td>`;
      html += `<td>${region.label}</td>`;
      html += `<td>${localeType.label}</td>`;
      html += `<td>$${row.income.toLocaleString()}</td>`;
      html += '</tr>';
    });
    html += '</table>';
    this.$metaSimilar.innerHTML = html;
  }

  selectMarker(markerIndex) {
    const { $meta, $metaTitle } = this;
    if (
      $meta.classList.contains('selected') &&
      markerIndex === this.selectedMarkerIndex
    ) {
      this.deselectMarker();
      return;
    }
    if (this.selectedMarkerIndex >= 0)
      this.markers[this.selectedMarkerIndex].el.setStyle({ stroke: false });
    this.markers[markerIndex].el.setStyle({ stroke: true }).bringToFront();
    this.selectedMarkerIndex = markerIndex;
    this.activeMarkerIndex = markerIndex;
    const item = this.data[markerIndex];
    $metaTitle.innerHTML = `${item.name} <small>(${item.city}, ${item.state})</small>`;
    this.renderDetails(item);
    this.renderSimilar(item);
    $meta.classList.add('active', 'selected');
  }

  setData(data) {
    this.data = data;
  }

  toggleMeta() {
    const selected = this.$meta.classList.contains('selected');
    if (selected) this.deselectMarker();
    else this.selectMarker(this.activeMarkerIndex);
  }

  updateColors(colorOptionKey) {
    const colorOption = Helper.where(
      this.colorOptions,
      'field',
      colorOptionKey,
    );
    if (colorOption) {
      this.$keyLabel.innerHTML = colorOption.label;
      this.$keyLabelLeft.innerHTML =
        'labelLeft' in colorOption ? colorOption.labelLeft : 'Less';
      this.$keyLabelRight.innerHTML =
        'labelRight' in colorOption ? colorOption.labelRight : 'More';
    }
    this.markers.forEach((marker) => {
      const color = marker.colors[colorOptionKey];
      marker.el.setStyle({ fillColor: color });
    });
    this.colorBy = colorOptionKey;
    this.options.onChangeState();
  }
}
