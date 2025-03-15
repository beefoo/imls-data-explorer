export default class Helper {
  static ceilToNearest(value, nearest) {
    return Math.ceil(value / nearest) * nearest;
  }

  static clamp(value, min = 0, max = 1) {
    const minCheckValue = Math.min(value, max);
    const maxCheckValue = Math.max(minCheckValue, min);
    return maxCheckValue;
  }

  static distance(x1, y1, x2, y2) {
    const y = x2 - x1;
    const x = y2 - y1;
    return Math.sqrt(x * x + y * y);
  }

  static ease(n) {
    return (Math.sin((n + 1.5) * Math.PI) + 1.0) / 2.0;
  }

  static floorToNearest(value, nearest) {
    return Math.floor(value / nearest) * nearest;
  }

  static lerp(a, b, percent) {
    return (1.0 * b - a) * percent + a;
  }

  static maxList(arr) {
    return arr.reduce((a, b) => Math.max(a, b), -Infinity);
  }

  static meanList(values) {
    if (values.length === 0) return 0;
    const n = values.length;
    return values.reduce((a, b) => a + b) / n;
  }

  static medianList(values) {
    if (values.length === 0) return 0;

    // Sorting values, preventing original array
    // from being mutated.
    values = [...values].sort((a, b) => a - b);

    const half = Math.floor(values.length / 2);

    return values.length % 2
      ? values[half]
      : (values[half - 1] + values[half]) / 2;
  }

  static minList(arr) {
    return arr.reduce((a, b) => Math.min(a, b), Infinity);
  }

  static mod(n, m) {
    return ((n % m) + m) % m;
  }

  static norm(value, a, b) {
    const denom = b - a;
    if (denom > 0 || denom < 0) return (1.0 * value - a) / denom;
    return 0;
  }

  static pad(num, size, padWith = '0') {
    return String(num).padStart(size, padWith);
  }

  static parseNumber(value) {
    const string = `${value}`;
    if (!isNaN(string) && !isNaN(parseFloat(string))) {
      if (string.includes('.')) return parseFloat(string);
      else return parseInt(string, 10);
    }
    return value;
  }

  static pushURLState(data, replace = false) {
    if (window.history.pushState) {
      const baseUrl = window.location.href.split('?')[0];
      const currentState = window.history.state;
      const searchParams = new URLSearchParams(data);
      const urlEncoded = searchParams.toString();
      const newUrl = `${baseUrl}?${urlEncoded}`;

      // ignore if state is the same
      if (currentState) {
        const currentSearchParams = new URLSearchParams(currentState);
        const currentEncoded = currentSearchParams.toString();
        const currentUrl = `${baseUrl}?${currentEncoded}`;
        if (newUrl === currentUrl) return;
      }

      window.historyInitiated = true;
      if (replace === true) window.history.replaceState(data, '', newUrl);
      else window.history.pushState(data, '', newUrl);
    }
  }

  static queryParams() {
    const searchString = window.location.search;
    if (searchString.length <= 0) return {};
    const searchParams = new URLSearchParams(searchString.substring(1));
    const parsed = {};
    for (const [key, value] of searchParams.entries()) {
      parsed[key] = Helper.parseNumber(value);
    }
    return parsed;
  }

  // range: (-PI, PI]
  // 3 o'clock is zero
  // clockwise goes to PI
  // counter-clockwise goes to -PI
  static radiansBetweenPoints(x1, y1, x2, y2) {
    const dy = y2 - y1;
    const dx = x2 - x1;
    return Math.atan2(dy, dx);
  }

  static round(value, precision) {
    return Number(value).toFixed(precision);
  }

  static roundToNearest(value, nearest) {
    return Math.round(value / nearest) * nearest;
  }

  static stdList(values, calculatedMean = false) {
    if (values.length <= 0) return 0;
    const n = values.length;
    const mean = calculatedMean
      ? calculatedMean
      : values.reduce((a, b) => a + b) / n;
    return Math.sqrt(
      values.map((x) => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n,
    );
  }

  static sum(arr, key = false) {
    return arr.reduce(
      (accumulator, item) =>
        key ? accumulator + item[key] : accumulator + item,
      0,
    );
  }

  static where(arr, key, value) {
    return arr.find((item) => (key in item ? item[key] === value : false));
  }

  static whereObj(obj, condition) {
    const filtered = {};
    for (const [key, value] of Object.entries(obj)) {
      if (condition(key, value)) filtered[key] = value;
    }
    return filtered;
  }

  static within(num, min, max) {
    return num >= min && num <= max;
  }

  static wrap(num, min, max) {
    if (num >= min && num < max) return num;
    const delta = max - min;
    if (delta < 1) return 0;
    if (num < min) return max - ((min - num) % delta);
    return ((num - min) % delta) + min;
  }
}
